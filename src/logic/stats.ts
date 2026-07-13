// Ability stat generation (RACE.md §1.1). Pure and seedable so results are
// reproducible (migration seeds from horse.id, so re-reads never change stats).
import type { Stats, StatKey } from '../types';
import { STAT_KEYS, STAT_CAP } from '../types';

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
 * Distribute a random total (10..30) across the 6 stats, each capped at 10.
 * Intentionally uneven — points land on random open stats one at a time.
 */
export function rollStats(rng: RNG): Stats {
  const total = 10 + Math.floor(rng() * 21); // 10..30
  const s: Stats = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 };
  for (let i = 0; i < total; i++) {
    const open = STAT_KEYS.filter((k) => s[k] < STAT_CAP);
    if (open.length === 0) break;
    const k = open[Math.floor(rng() * open.length)] as StatKey;
    s[k]++;
  }
  return s;
}

/** Roll stats for a target sum band (used for CPU difficulty by grade). */
export function rollStatsTotal(rng: RNG, min: number, max: number): Stats {
  const target = min + Math.floor(rng() * (max - min + 1));
  const s: Stats = { spd: 0, sta: 0, pwr: 0, jmp: 0, gut: 0, wit: 0 };
  for (let i = 0; i < target; i++) {
    const open = STAT_KEYS.filter((k) => s[k] < STAT_CAP);
    if (open.length === 0) break;
    const k = open[Math.floor(rng() * open.length)] as StatKey;
    s[k]++;
  }
  return s;
}
