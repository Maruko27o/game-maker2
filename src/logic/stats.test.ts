import { describe, it, expect } from 'vitest';
import { allocate, rescaleTo40, rollStatsForStyle, statTotal, mulberry32 } from './stats';
import { STAT_KEYS, STAT_ALLOC_TOTAL, STAT_CAP } from '../types';
import type { RunStyle, StatKey } from '../types';

const EVEN: Record<StatKey, number> = { spd: 1, sta: 1, pwr: 1, jmp: 1, gut: 1, wit: 1 };

describe('allocate', () => {
  it('distributes exactly `total`, each stat within [1, 10]', () => {
    for (const total of [6, 20, 40, 48, 60]) {
      const s = allocate(EVEN, total);
      expect(statTotal(s)).toBe(total);
      for (const k of STAT_KEYS) {
        expect(s[k]).toBeGreaterThanOrEqual(1);
        expect(s[k]).toBeLessThanOrEqual(STAT_CAP);
      }
    }
  });

  it('is deterministic (no RNG)', () => {
    const w = { spd: 3, sta: 1, pwr: 2, jmp: 0.5, gut: 1, wit: 1 };
    expect(allocate(w, 40)).toEqual(allocate(w, 40));
  });

  it('sends more points to heavier weights', () => {
    const s = allocate({ spd: 5, sta: 1, pwr: 1, jmp: 1, gut: 1, wit: 1 }, 40);
    expect(s.spd).toBeGreaterThan(s.sta);
    expect(s.spd).toBeGreaterThan(s.jmp);
  });

  it('能力の並び順で有利不利が出ない（重みを入れ替えたら結果も入れ替わる）', () => {
    // 以前は理想値を「配る前の総量」ではなく「残り」で計算していたため、
    // ループの途中で残りが減るぶん後ろの能力ほど取り分が小さくなり、
    // STAT_KEYS の並び（spd→sta→pwr→jmp→gut→wit）がそのまま強さの順に
    // なっていた（同じ重み分布なのに実測 spd 8.18 対 wit 5.38）。
    const w = { spd: 3, sta: 2.5, pwr: 2, jmp: 1.5, gut: 1, wit: 0.5 };
    const a = allocate(w, 40);
    const rev = { spd: 0.5, sta: 1, pwr: 1.5, jmp: 2, gut: 2.5, wit: 3 };
    const b = allocate(rev, 40);
    expect([b.wit, b.gut, b.jmp, b.pwr, b.sta, b.spd]).toEqual([a.spd, a.sta, a.pwr, a.jmp, a.gut, a.wit]);

    // ランダムな重みを大量に振っても、6能力の平均は横並びになる。
    const rng = mulberry32(20260801);
    const sum: Record<StatKey, number> = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 };
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const rw = {} as Record<StatKey, number>;
      for (const k of STAT_KEYS) rw[k] = 0.5 + rng() * 1.5;
      const s = allocate(rw, 40);
      for (const k of STAT_KEYS) sum[k] += s[k];
    }
    const means = STAT_KEYS.map((k) => sum[k] / N);
    expect(Math.max(...means) - Math.min(...means)).toBeLessThan(0.25); // 修正前は 2.8 開いていた
  });
});

describe('rescaleTo40 (v3→v4 migration)', () => {
  it('always yields a valid 40-point spread', () => {
    for (let seed = 0; seed < 300; seed++) {
      const rng = mulberry32(seed);
      const src = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 } as Record<StatKey, number>;
      const total = 10 + Math.floor(rng() * 21); // old 10..30 spread
      for (let i = 0; i < total; i++) {
        const k = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)];
        if (src[k] < 10) src[k]++;
      }
      const out = rescaleTo40(src);
      expect(statTotal(out)).toBe(STAT_ALLOC_TOTAL);
      for (const k of STAT_KEYS) {
        expect(out[k]).toBeGreaterThanOrEqual(1);
        expect(out[k]).toBeLessThanOrEqual(10);
      }
    }
  });

  it('handles all-zero input (gives an even 40)', () => {
    const out = rescaleTo40({ spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 });
    expect(statTotal(out)).toBe(40);
  });
});

describe('rollStatsForStyle (CPU)', () => {
  const styles: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
  it('respects the target total and per-stat cap for every style', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed);
      const style = styles[seed % 4];
      const total = 38 + (seed % 11); // 38..48
      const s = rollStatsForStyle(rng, total, style);
      expect(statTotal(s)).toBe(total);
      for (const k of STAT_KEYS) {
        expect(s[k]).toBeGreaterThanOrEqual(1);
        expect(s[k]).toBeLessThanOrEqual(10);
      }
    }
  });

  it('nige leans on spd; oikomi leans on gut (on average)', () => {
    let nigeSpd = 0, oikomiGut = 0, nigeGut = 0, oikomiSpd = 0;
    for (let seed = 0; seed < 200; seed++) {
      const n = rollStatsForStyle(mulberry32(seed), 40, 'nige');
      const o = rollStatsForStyle(mulberry32(seed + 999), 40, 'oikomi');
      nigeSpd += n.spd; nigeGut += n.gut;
      oikomiGut += o.gut; oikomiSpd += o.spd;
    }
    expect(nigeSpd).toBeGreaterThan(nigeGut);
    expect(oikomiGut).toBeGreaterThan(oikomiSpd);
  });
});
