// 対戦モード（デイリー勝ち抜きトーナメント）の定数とバランス。
// 1日1回、参加費を払って1頭エントリー。翌日に「予選1回戦 → 予選2回戦 → 本線」を
// 連続再生し、勝ち抜くほど賞金が大きくなる。優勝(本線1位)は特大の1万コイン。
// 参加費1,000／1日1回で釣り合いを取り、優勝は数回に1回の大当たりになるよう
// 各ラウンドのCOMの強さを段階的に引き上げる（logic/arena.ts）。

import type { ArenaOutcome } from '../types';

export const ARENA_ENTRY_FEE = 1000; // コイン: 1日1回の参加費（コインの吸い出し口）
export const ARENA_FIELD = 8; // 1レースの頭数
export const ARENA_ADVANCE = 4; // 予選で通過する上位頭数
export const ARENA_MODE = 60 as const; // レース時間（本レースと同じ2周相当）

// ラウンド名（0=予選1回戦, 1=予選2回戦, 2=本線）。
export const ARENA_ROUND_NAMES = ['予選1回戦', '予選2回戦', '本線 決勝'] as const;

// 本線に混ぜる「実プレイヤー」の最大数（ラウンドが進むほど減らし、残りは強めのCOMで
// 埋めることで、プールの顔ぶれに関わらず後半ほど難しくなるようにする）。
export const ARENA_REAL_CAP = [4, 3, 2] as const;

// 着順・脱落に応じた賞金。
export function arenaPrize(outcome: ArenaOutcome, finalRank: number): number {
  if (outcome === 'champion') return 10000; // 本線 優勝
  if (outcome === 'final') {
    if (finalRank === 2) return 3000; // 準優勝
    if (finalRank === 3) return 1500; // 3位
    return 500; // 本線出場（4〜8位）
  }
  return 200; // 予選で敗退（q1out / q2out）
}

// 見出し用のラベル。
export function arenaOutcomeLabel(outcome: ArenaOutcome, finalRank: number): string {
  if (outcome === 'champion') return '優勝！';
  if (outcome === 'final') return `本線 ${finalRank}位`;
  if (outcome === 'q2out') return '予選2回戦 敗退';
  return '予選1回戦 敗退';
}
