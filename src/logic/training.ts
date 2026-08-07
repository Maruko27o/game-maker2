// Training rules (RACE.md §9.3). The UI MUST go through these — never bump a
// stat directly — so the caps are enforced at the logic level.
import type { Stats, StatKey } from '../types';
import { STAT_CAP, STAT_TOTAL_CAP } from '../types';
import { statTotal } from './stats';

/** A stat can be trained only if it's below 10 and the total is below 48. */
export function canApply(stats: Stats, key: StatKey): boolean {
  return stats[key] < STAT_CAP && statTotal(stats) < STAT_TOTAL_CAP;
}

/** その項目にあと何ポイント入るか（1項目の上限10と、合計48の上限の小さい方）。 */
export function trainingRoom(stats: Stats, key: StatKey): number {
  return Math.max(0, Math.min(STAT_CAP - stats[key], STAT_TOTAL_CAP - statTotal(stats)));
}

/**
 * Returns the stats with `key` raised by `gain`, or null when not allowed.
 * gain は上限（1項目10・合計48）でかならず切り詰める。火曜のトレーニングデーで
 * まぐれの +2 を渡しても、上限を超えることはない。
 */
export function applyTraining(stats: Stats, key: StatKey, gain = 1): Stats | null {
  if (!canApply(stats, key)) return null;
  const add = Math.min(Math.max(1, Math.floor(gain)), trainingRoom(stats, key));
  if (add <= 0) return null;
  return { ...stats, [key]: stats[key] + add };
}
