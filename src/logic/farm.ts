// 牧場の放置収入（idle income）と 引退（retire for coins）の純粋計算。
import { statTotal } from './stats';
import { STAT_ALLOC_TOTAL } from '../types';
import type { Horse, Trophy, Badge } from '../types';
import {
  FARM_BASE_PER_HORSE,
  FARM_PER_STAT,
  FARM_PER_TROPHY,
  FARM_CAP_HOURS,
  RETIRE_BASE,
  RETIRE_PER_TRAINED,
  RETIRE_PER_TROPHY,
  RETIRE_PER_BADGE,
} from '../data/coins';

/** 1頭あたりの時給（coins/時）。総合力＋トロフィー数で決まる。 */
export function horseFarmRate(total: number, trophyCount: number): number {
  return FARM_BASE_PER_HORSE + total * FARM_PER_STAT + trophyCount * FARM_PER_TROPHY;
}

/** ステーブル全体の時給（coins/時）。 */
export function farmRatePerHour(horses: Horse[], trophies: Trophy[]): number {
  return horses.reduce(
    (sum, h) => sum + horseFarmRate(statTotal(h.stats), trophies.filter((t) => t.horseId === h.id).length),
    0,
  );
}

/** lastClaim〜now に貯まった放置収入（FARM_CAP_HOURS で頭打ち）。 */
export function farmAccrued(lastClaim: number, now: number, ratePerHour: number): number {
  const hours = Math.min(FARM_CAP_HOURS, Math.max(0, (now - lastClaim) / 3_600_000));
  return Math.floor(hours * ratePerHour);
}

/** 回収が満タン（頭打ち）になるまでの残りミリ秒。0以下なら満タン。 */
export function farmMsToFull(lastClaim: number, now: number): number {
  return lastClaim + FARM_CAP_HOURS * 3_600_000 - now;
}

/** 引退で受け取るコイン。育てた分（40超）＋トロフィー＋バッジ＝投資に価値。 */
export function retireValue(total: number, trophyCount: number, badgeCount: number): number {
  return (
    RETIRE_BASE +
    Math.max(0, total - STAT_ALLOC_TOTAL) * RETIRE_PER_TRAINED +
    trophyCount * RETIRE_PER_TROPHY +
    badgeCount * RETIRE_PER_BADGE
  );
}

/** Horse を直接受け取る便利版（UI/ストアから）。無料で作った馬(free)はベース分を
 *  付けない（無料作成→引退の荒稼ぎ loop を封じる）。 */
export function retireValueOf(horse: Horse, trophies: Trophy[], badges: Badge[]): number {
  const v = retireValue(
    statTotal(horse.stats),
    trophies.filter((t) => t.horseId === horse.id).length,
    badges.filter((b) => b.horseId === horse.id).length,
  );
  return horse.free ? Math.max(0, v - RETIRE_BASE) : v;
}
