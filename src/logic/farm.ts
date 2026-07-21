// 牧場の放置収入（idle income）と 引退（retire for coins）の純粋計算。
import { statTotal } from './stats';
import { STAT_ALLOC_TOTAL } from '../types';
import type { Horse, Trophy, Badge } from '../types';
import {
  FARM_BASE_PER_HORSE,
  FARM_PER_STAT,
  FARM_TROPHY_RATE,
  FARM_BADGE_RATE,
  FARM_PER_HORSE_CAP,
  FARM_CAP_HOURS,
  RETIRE_BASE,
  RETIRE_PER_TRAINED,
  RETIRE_PER_TROPHY,
  RETIRE_PER_BADGE,
} from '../data/coins';

/** その馬のトロフィーが生む時給（金50/銀20/銅10 × 個数）。 */
export function trophyFarmRate(trophies: Trophy[]): number {
  return trophies.reduce((sum, t) => sum + (FARM_TROPHY_RATE[t.rank] ?? 0), 0);
}

/** その馬のバッジが生む時給（金3/銀2/銅1 × 個数。順位バッジのみ加算）。 */
export function badgeFarmRate(badges: Badge[]): number {
  return badges.reduce((sum, b) => sum + (FARM_BADGE_RATE[b.id] ?? 0), 0);
}

/** 1頭あたりの時給（coins/時）。基礎＋総合力＋トロフィー＋バッジ。上限は毎時1000。 */
export function horseFarmRate(total: number, trophies: Trophy[], badges: Badge[]): number {
  const raw = FARM_BASE_PER_HORSE + total * FARM_PER_STAT + trophyFarmRate(trophies) + badgeFarmRate(badges);
  return Math.min(FARM_PER_HORSE_CAP, raw);
}

/** Horse を直接受け取る便利版（UI用）。 */
export function horseFarmRateOf(horse: Horse, trophies: Trophy[], badges: Badge[]): number {
  return horseFarmRate(
    statTotal(horse.stats),
    trophies.filter((t) => t.horseId === horse.id),
    badges.filter((b) => b.horseId === horse.id),
  );
}

/** ステーブル全体の時給（coins/時）。各馬の上限適用後を合算する。 */
export function farmRatePerHour(horses: Horse[], trophies: Trophy[], badges: Badge[]): number {
  return horses.reduce((sum, h) => sum + horseFarmRateOf(h, trophies, badges), 0);
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
