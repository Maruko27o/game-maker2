// Training rules (RACE.md §9.3). The UI MUST go through these — never bump a
// stat directly — so the caps are enforced at the logic level.
import type { Stats, StatKey } from '../types';
import { STAT_CAP, STAT_TOTAL_CAP } from '../types';
import { statTotal } from './stats';

/** A stat can be trained only if it's below 10 and the total is below 48. */
export function canApply(stats: Stats, key: StatKey): boolean {
  return stats[key] < STAT_CAP && statTotal(stats) < STAT_TOTAL_CAP;
}

/** Returns the stats with `key` raised by 1, or null when not allowed. */
export function applyTraining(stats: Stats, key: StatKey): Stats | null {
  if (!canApply(stats, key)) return null;
  return { ...stats, [key]: stats[key] + 1 };
}
