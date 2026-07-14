// Ability stat generation. From RACE_V3 §3 the player point-buys 40 across the
// six stats (each 1..10); random birth stats are gone. What remains here is the
// point allocator (shared by the create screen, CPU generation and migration).
import type { Stats, StatKey, RunStyle } from '../types';
import { STAT_KEYS, STAT_CAP, STAT_ALLOC_TOTAL, STAT_ALLOC_MIN } from '../types';

export type RNG = () => number;

/** mulberry32 PRNG — deterministic for a given numeric seed. */
export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, for deriving a seed from an id. */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFromId(id: string): RNG {
  return mulberry32(hashString(id) ^ 0x9e3779b9);
}

export function statTotal(s: Stats): number {
  return STAT_KEYS.reduce((n, k) => n + s[k], 0);
}

/**
 * Distribute `total` points across the 6 stats proportional to `weights`,
 * each stat clamped to [STAT_ALLOC_MIN, STAT_CAP] and the sum exactly `total`.
 * Deterministic (largest-remainder / Hamilton method) — no RNG.
 */
export function allocate(weights: Record<StatKey, number>, total: number): Stats {
  const s: Stats = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 };
  for (const k of STAT_KEYS) s[k] = STAT_ALLOC_MIN; // everyone starts at the floor
  let pool = total - STAT_ALLOC_MIN * STAT_KEYS.length;
  if (pool <= 0) return s;

  const wsum = STAT_KEYS.reduce((n, k) => n + Math.max(0, weights[k]), 0) || 1;
  const ideal: Record<StatKey, number> = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 };
  const rema: { k: StatKey; frac: number }[] = [];
  for (const k of STAT_KEYS) {
    ideal[k] = (Math.max(0, weights[k]) / wsum) * pool;
    const whole = Math.min(Math.floor(ideal[k]), STAT_CAP - STAT_ALLOC_MIN);
    s[k] += whole;
    pool -= whole;
    rema.push({ k, frac: ideal[k] - Math.floor(ideal[k]) });
  }
  // Hand out the remainder to the largest fractional parts (that still have room).
  rema.sort((a, b) => b.frac - a.frac);
  let guard = 0;
  while (pool > 0 && guard < 100) {
    let progressed = false;
    for (const { k } of rema) {
      if (pool === 0) break;
      if (s[k] < STAT_CAP) { s[k]++; pool--; progressed = true; }
    }
    if (!progressed) break;
    guard++;
  }
  return s;
}

/** Re-scale existing stats to sum exactly STAT_ALLOC_TOTAL (40), preserving the
 *  distribution shape. Used by the v3→v4 migration (RACE_V3 §3.6). */
export function rescaleTo40(src: Stats): Stats {
  const total = statTotal(src);
  const weights = total > 0 ? src : { spd: 1, sta: 1, pwr: 1, jmp: 1, gut: 1, wit: 1 };
  return allocate(weights, STAT_ALLOC_TOTAL);
}

// Rough per-style weighting so CPU horses feel like a real 逃げ/差し… type
// rather than random scatter (RACE_V3 §3.5).
const STYLE_WEIGHTS: Record<RunStyle, Record<StatKey, number>> = {
  nige: { spd: 3.0, pwr: 2.0, sta: 1.5, wit: 1.0, jmp: 1.0, gut: 0.8 },
  senko: { spd: 2.5, pwr: 1.8, sta: 1.8, wit: 1.3, gut: 1.2, jmp: 1.0 },
  sashi: { sta: 2.5, gut: 2.0, spd: 1.8, wit: 1.5, pwr: 1.2, jmp: 1.0 },
  oikomi: { gut: 3.0, sta: 2.5, spd: 1.5, wit: 1.5, pwr: 1.0, jmp: 1.0 },
};

/** CPU stats: `total` points laid down along a style template with light RNG
 *  jitter so same-style CPUs still differ. Each stat stays within [1, 10]. */
export function rollStatsForStyle(rng: RNG, total: number, style: RunStyle): Stats {
  const base = STYLE_WEIGHTS[style];
  const w: Record<StatKey, number> = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 };
  for (const k of STAT_KEYS) w[k] = base[k] * (0.75 + rng() * 0.5); // ±25% jitter
  return allocate(w, total);
}
