// 対戦モード（勝ち抜きトーナメント）の定数とバランス。
// 1日2回開催（毎日 0時 と 12時 に新しい「部」が始まる12時間区切り）。参加費を払って
// 1頭エントリー → その部が締まると「予選1回戦 → 予選2回戦 → 本線」を勝ち抜き、着順で賞金。
// 「自動エントリー（固定）」を有効にすると、資金がある限り毎回の部に自動参加し、結果が
// リストに溜まっていく。優勝は特大の賞金だが、後半ラウンドのCOMを強くして希少に保つ。

import type { ArenaOutcome } from '../types';
import { trustedNow } from '../logic/trustedClock';

export const ARENA_ENTRY_FEE = 1000; // コイン: 1回の参加費
export const ARENA_FIELD = 8; // 1レースの頭数（全ラウンド8頭）
export const ARENA_ADVANCE = 4; // 予選で通過する上位頭数
export const ARENA_MODE = 60 as const; // レース時間（2周相当）

// 1日2回開催：12時間ごとに新しい「部」。境界はローカルの 0:00 と 12:00。
export const ARENA_PERIOD_MS = 12 * 3600 * 1000;
export const ARENA_CATCHUP_MAX = 6; // 自動エントリーで一度にさかのぼって精算する最大部数（＝3日ぶん）
export const ARENA_RESULTS_CAP = 40; // 溜めておく結果の最大件数

// ラウンド名（0=予選1回戦, 1=予選2回戦, 2=本線）。
export const ARENA_ROUND_NAMES = ['予選1回戦', '予選2回戦', '本線 決勝'] as const;

// 本線に混ぜる「実プレイヤー」の最大数（ラウンドが進むほど減らし、残りは強めのCOMで
// 埋めることで、プールの顔ぶれに関わらず後半ほど難しくなるようにする）。
export const ARENA_REAL_CAP = [4, 3, 2] as const;

// COMの強さ（合計ステータスの範囲）。プレイヤーの強さに依らない絶対値なので、
// 鍛えた馬ほど有利＝育成が報われる（参加費1000に対し、合計48なら期待値>1、
// 合計40前後は勝ち越せない）。ラウンドが進むほど少し強くなり、優勝は希少に保つ。
// [予選1回戦, 予選2回戦, 本線]。
export const ARENA_COM_BANDS: [number, number][] = [
  [33, 41],
  [35, 42],
  [37, 44],
];

// ---- 開催「部」(period) の計算 ---------------------------------------------
// ローカル時刻の 0:00 と 12:00 で1つ進む整数ID。単調増加なので比較で新旧を判定できる。
export function periodId(now = trustedNow()): number {
  const d = new Date(now);
  const localDay = Math.floor((now - d.getTimezoneOffset() * 60000) / 86400000);
  return localDay * 2 + (d.getHours() < 12 ? 0 : 1);
}

// 部IDを表示用ラベルに（例: "7/18 12時の部"）。締め切り時刻で呼ぶ：前半(0:00〜12:00)
// は12:00締めなので「12時の部」、後半(12:00〜24:00)は0:00締めなので「0時の部」。
export function periodLabel(period: number): string {
  const day = Math.floor(period / 2);
  const half = period % 2;
  const tzMs = new Date().getTimezoneOffset() * 60000;
  const d = new Date(day * 86400000 + tzMs); // ローカル正子を実時刻へ戻す
  return `${d.getMonth() + 1}/${d.getDate()} ${half ? '0時' : '12時'}の部`;
}

// 次の開催（部の切り替わり）までの残りミリ秒。
export function msToNextPeriod(now = trustedNow()): number {
  const d = new Date(now);
  const next = new Date(d);
  if (d.getHours() < 12) next.setHours(12, 0, 0, 0);
  else {
    next.setDate(d.getDate() + 1);
    next.setHours(0, 0, 0, 0);
  }
  return next.getTime() - now;
}

// 着順・脱落に応じた賞金（ユーザー指定）。
export function arenaPrize(outcome: ArenaOutcome, finalRank: number): number {
  if (outcome === 'champion') return 12000; // 本線 優勝
  if (outcome === 'final') {
    if (finalRank === 2) return 5000; // 準優勝
    if (finalRank === 3) return 1000; // 3位
    return 500; // 本線出場（4〜8位）
  }
  return 0; // 予選で敗退（q1out / q2out）
}

// 見出し用のラベル。
export function arenaOutcomeLabel(outcome: ArenaOutcome, finalRank: number): string {
  if (outcome === 'champion') return '優勝！';
  if (outcome === 'final') return `本線 ${finalRank}位`;
  if (outcome === 'q2out') return '予選2回戦 敗退';
  return '予選1回戦 敗退';
}
