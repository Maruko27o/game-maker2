import { describe, it, expect } from 'vitest';
import { pickCount, pickOne, drawParts, spawn, COUNT_TABLE, RARITY_WEIGHT, type Poolable } from './gacha';
import type { Rarity } from '../types';

// Deterministic RNG that cycles through a fixed sequence.
function seq(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

// A mulberry32 PRNG for statistical (many-sample) tests.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pool: Poolable[] = [];
for (let i = 0; i < 40; i++) pool.push({ id: `n${i}`, rarity: 'N' });
for (let i = 0; i < 15; i++) pool.push({ id: `r${i}`, rarity: 'R' });
for (let i = 0; i < 5; i++) pool.push({ id: `s${i}`, rarity: 'SR' });

describe('pickCount', () => {
  it('maps rng bands to 1..4 per the 50/40/7/3 table', () => {
    expect(pickCount(seq([0.0]))).toBe(1);
    expect(pickCount(seq([0.49]))).toBe(1);
    expect(pickCount(seq([0.5]))).toBe(2);
    expect(pickCount(seq([0.89]))).toBe(2);
    expect(pickCount(seq([0.9]))).toBe(3);
    expect(pickCount(seq([0.96]))).toBe(3);
    expect(pickCount(seq([0.97]))).toBe(4);
    expect(pickCount(seq([0.999]))).toBe(4);
    expect(pickCount(seq([1]))).toBe(4); // r ~= 1 fallback
  });

  it('COUNT_TABLE probabilities sum to 1', () => {
    const sum = COUNT_TABLE.reduce((s, e) => s + e.p, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('empirical distribution roughly matches the table', () => {
    const rng = mulberry32(12345);
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const N = 200000;
    for (let i = 0; i < N; i++) counts[pickCount(rng)]++;
    expect(counts[1] / N).toBeCloseTo(0.5, 1);
    expect(counts[2] / N).toBeCloseTo(0.4, 1);
    expect(counts[3] / N).toBeCloseTo(0.07, 1);
    expect(counts[4] / N).toBeCloseTo(0.03, 1);
  });
});

describe('pickOne rarity weighting', () => {
  it('lowest rng picks the first entry, boundary respected', () => {
    // total weight = 40*70 + 15*25 + 5*5 = 2800+375+25 = 3200
    expect(pickOne(seq([0]), pool).id).toBe('n0');
  });

  it('empirical rarity share tracks the weights', () => {
    const rng = mulberry32(999);
    const byRarity: Record<Rarity, number> = { N: 0, R: 0, SR: 0 };
    const N = 200000;
    for (let i = 0; i < N; i++) byRarity[(pickOne(rng, pool).rarity as Rarity)]++;
    // Expected: N = 2800/3200 = .875, R = 375/3200 = .117, SR = 25/3200 = .0078
    expect(byRarity.N / N).toBeCloseTo(0.875, 1);
    expect(byRarity.R / N).toBeCloseTo(0.117, 1);
    expect(byRarity.SR / N).toBeCloseTo(0.008, 1);
  });
});

describe('drawParts', () => {
  it('returns the requested number of parts', () => {
    const rng = mulberry32(7);
    expect(drawParts(rng, pool, 4)).toHaveLength(4);
  });

  it('never repeats a part within a single draw', () => {
    const rng = mulberry32(1);
    for (let t = 0; t < 5000; t++) {
      const got = drawParts(rng, pool, 4);
      expect(new Set(got).size).toBe(got.length);
    }
  });

  it('caps at the pool size when count exceeds it', () => {
    const tiny: Poolable[] = [
      { id: 'a', rarity: 'N' },
      { id: 'b', rarity: 'R' },
    ];
    expect(drawParts(mulberry32(3), tiny, 4)).toHaveLength(2);
  });
});

describe('spawn', () => {
  it('yields 1..4 distinct valid part ids', () => {
    const rng = mulberry32(42);
    const ids = new Set(pool.map((p) => p.id));
    for (let t = 0; t < 2000; t++) {
      const got = spawn(rng, pool);
      expect(got.length).toBeGreaterThanOrEqual(1);
      expect(got.length).toBeLessThanOrEqual(4);
      expect(new Set(got).size).toBe(got.length);
      for (const id of got) expect(ids.has(id)).toBe(true);
    }
  });
});

describe('RARITY_WEIGHT', () => {
  it('matches the spec weights', () => {
    expect(RARITY_WEIGHT).toEqual({ N: 70, R: 25, SR: 5 });
  });
});
