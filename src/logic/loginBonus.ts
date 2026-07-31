// ログインボーナス（曜日制）。
//
// 1日1回、その曜日のごほうびを受け取れる。
//   月・火・木・金 → コイン
//   水            → 厳選チケット
//   土・日        → 染料（ランダムで1色）
//
// 「その日にもう受け取ったか」は日付キー（YYYY-M-D）で判定する。時刻は必ず
// trustedNow() 由来のものを使うこと：端末の時計をいじっても、
//   ・巻き戻し → trustedClock の単調フロアで無効
//   ・進める   → 起動/復帰時のサーバ時刻アンカーで無効
// なので「日付を変えて何度ももらう」は塞がれている。
import type { ColorSlot } from '../types';
import { colorsBySlot, COLOR_SLOTS } from '../data/parts';
import { pickOne } from './gacha';
import type { RNG } from './stats';

export const LOGIN_COINS = 1000; // 月・火・木・金
export const LOGIN_TICKETS = 1; // 水

export type LoginReward =
  | { kind: 'coins'; amount: number }
  | { kind: 'ticket'; amount: number }
  | { kind: 'dye'; colorId?: string };

// 週の並び（月はじまり）。表示もこの順。
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const; // 月火水木金土日
export const DOW_LABEL = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** その曜日（0=日 … 6=土）のごほうび。 */
export function rewardForDow(dow: number): LoginReward {
  const d = ((dow % 7) + 7) % 7;
  if (d === 3) return { kind: 'ticket', amount: LOGIN_TICKETS }; // 水
  if (d === 0 || d === 6) return { kind: 'dye' }; // 日・土
  return { kind: 'coins', amount: LOGIN_COINS }; // 月・火・木・金
}

/** 表示用の短いラベル。 */
export function rewardLabel(r: LoginReward): string {
  if (r.kind === 'coins') return `${r.amount.toLocaleString()}コイン`;
  if (r.kind === 'ticket') return `厳選チケット${r.amount}枚`;
  return '染料 1つ';
}

/** 日付キー（ローカル日付）。時計いじり対策のため trustedNow() の値を渡すこと。 */
export function loginDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/** その時刻の曜日（0=日 … 6=土）。 */
export function dowOf(now: number): number {
  return new Date(now).getDay();
}

/** きょうぶんを受け取れるか（前回受け取った日と違えばOK）。 */
export function canClaim(lastDay: string | undefined, now: number): boolean {
  return loginDayKey(now) !== lastDay;
}

/** 染料を1つ抽選する。色はレア度どおりの重みで、枠（からだ/たてがみ/ひづめ）は均等。
 *  返すのは色パーツのID。どの枠に塗れるかはその色が属する枠で決まる。 */
export function rollDye(rng: RNG): string {
  const slot: ColorSlot = COLOR_SLOTS[Math.floor(rng() * COLOR_SLOTS.length) % COLOR_SLOTS.length];
  return pickOne(rng, colorsBySlot[slot]).id;
}
