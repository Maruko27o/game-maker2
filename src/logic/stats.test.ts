import { describe, it, expect } from 'vitest';
import { rollStats, rollStatsTotal, statTotal, mulberry32, rngFromId } from './stats';
import { STAT_KEYS } from '../types';

describe('rollStats', () => {
  it('always sums to 10..30 with each stat 0..10', () => {
    for (let seed = 0; seed < 500; seed++) {
      const s = rollStats(mulberry32(seed));
      const total = statTotal(s);
      expect(total).toBeGreaterThanOrEqual(10);
      expect(total).toBeLessThanOrEqual(30);
      for (const k of STAT_KEYS) {
        expect(s[k]).toBeGreaterThanOrEqual(0);
        expect(s[k]).toBeLessThanOrEqual(10);
      }
    }
  });

  it('is reproducible for a fixed seed', () => {
    expect(rollStats(mulberry32(42))).toEqual(rollStats(mulberry32(42)));
  });

  it('produces uneven spreads (not all equal)', () => {
    let uneven = 0;
    for (let seed = 0; seed < 50; seed++) {
      const s = rollStats(mulberry32(seed));
      const vals = STAT_KEYS.map((k) => s[k]);
      if (new Set(vals).size > 1) uneven++;
    }
    expect(uneven).toBeGreaterThan(45);
  });

  it('rngFromId is stable per id', () => {
    expect(rollStats(rngFromId('horse-abc'))).toEqual(rollStats(rngFromId('horse-abc')));
    expect(rollStats(rngFromId('horse-abc'))).not.toEqual(rollStats(rngFromId('horse-xyz')));
  });
});

describe('rollStatsTotal', () => {
  it('respects the target band and per-stat cap', () => {
    for (let seed = 0; seed < 300; seed++) {
      const s = rollStatsTotal(mulberry32(seed), 32, 44);
      expect(statTotal(s)).toBeGreaterThanOrEqual(32);
      expect(statTotal(s)).toBeLessThanOrEqual(44);
      for (const k of STAT_KEYS) expect(s[k]).toBeLessThanOrEqual(10);
    }
  });
});
