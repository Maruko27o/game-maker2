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

// ── 成功・失敗 ────────────────────────────────────────────────────────────
//
// アイテムを入れれば必ず1つ上がる作りだと、アイテムが大量に手に入るいまでは
// 「48まで押すだけの作業」になり、上げる楽しさが無くなっていた。半々で失敗する
// ようにして、1回1回に結果が生まれるようにする。
//
// ただし運が悪いと何度も外れて理不尽になるので、**同じウマで2回続けて失敗したら
// 3回目は必ず成功**する。失敗の回数はウマごとに持ち（Horse.trainMiss）、
// 成功したら0に戻る。

/** 育成を1回まわした結果。画面はこれを見て演出を出しわける。 */
export type TrainResult = {
  /** 成功したか。 */
  ok: boolean;
  /** 実際に上がった量（成功なら1、まぐれで2。失敗なら0）。 */
  gain: number;
  /** 連続失敗の救済で確定成功になったか（画面に理由を出すため）。 */
  pity: boolean;
  /** 上限に当たっていて、そもそも試せなかった（アイテムも減っていない）。 */
  blocked: boolean;
};

/** 何回続けて失敗したら、次を確定成功にするか。 */
export const TRAIN_PITY_AFTER = 2;

/** 今回が「確定成功」か（連続失敗の救済）。 */
export function isPityHit(misses: number): boolean {
  return (misses ?? 0) >= TRAIN_PITY_AFTER;
}

/**
 * 今回の育成が成功したか。
 * @param rng 0以上1未満を返す乱数
 * @param rate 成功する割合（ふだん0.5、トレーニングデーは0.75）
 * @param misses そのウマがいま何回続けて失敗しているか
 */
export function rollTraining(rng: () => number, rate: number, misses: number): boolean {
  return isPityHit(misses) || rng() < rate;
}

// ── 調整（-1） ───────────────────────────────────────────────────────────
//
// 上げるだけだと、振り間違えたときに取り返しがつかない。アイテムをまとめて使って
// 1つ下げられるようにする。下げたぶんは合計から引かれるので、別の項目に振り直せる
// （＝これが「調整」の意味。ただの弱体化ではない）。

/** 調整で下げられる下限。0にはできない（脚質やレースの計算が壊れるため）。 */
export const STAT_MIN = 1;

/** その項目を1つ下げられるか。 */
export function canTrim(stats: Stats, key: StatKey): boolean {
  return stats[key] > STAT_MIN;
}

/** その項目を1つ下げた stats（下げられないときは null）。 */
export function applyTrim(stats: Stats, key: StatKey): Stats | null {
  if (!canTrim(stats, key)) return null;
  return { ...stats, [key]: stats[key] - 1 };
}
