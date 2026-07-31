// 厳選（固有スキル＋コース適性の振り直し）— チケット制。
//
// 旧仕様は「既存ウマだけ・活躍に応じて最大10回・1回1000コイン」だったが、
//   ・新しく召喚したウマがまったく厳選できない
//   ・回数がウマごとにバラバラで分かりにくい
// ので、全ウマ共通で最大3回・1回につき厳選チケット1枚に統一した。
//
// 移行のルール（ユーザー指定）：
//   ・すでに旧厳選を使ったウマの中身はそのまま。回数は「使い切った」扱いにして
//     厳選の導線を出さない（rerollsUsed >= 1 が目印）。
//   ・旧厳選を1回も使っていないウマだけが、チケットで3回ぶん厳選できる。
// 新旧の回数は別のカウンタで持つ（rerollsUsed=旧 / refineUsed=チケット）。
//
// チケットの入手は対戦（デイリー勝ち抜きトーナメント）の成績のみ。
import type { Horse, ArenaOutcome } from '../types';

export const REFINE_MAX = 3; // 1頭あたりの厳選回数
export const REFINE_TICKET_COST = 1; // 1回に使うチケット枚数

/** 対戦の成績でもらえる厳選チケット。優勝3・準優勝2・3位1、それ以外は0。 */
export function arenaTickets(outcome: ArenaOutcome, finalRank: number | null): number {
  if (outcome === 'champion') return 3;
  if (outcome === 'final') {
    if (finalRank === 2) return 2;
    if (finalRank === 3) return 1;
  }
  return 0;
}

/** そのウマがチケット厳選の対象か。旧厳選を使ったウマは対象外（使い切り扱い）。 */
export function canRefine(horse: Horse): boolean {
  return (horse.rerollsUsed ?? 0) === 0;
}

/** そのウマの厳選回数（権利・使用済み・残り）。 */
export function refineState(horse: Horse): { rights: number; used: number; left: number } {
  const rights = canRefine(horse) ? REFINE_MAX : 0;
  const used = Math.max(0, Math.min(REFINE_MAX, Math.floor(horse.refineUsed ?? 0)));
  return { rights, used, left: Math.max(0, rights - used) };
}

/** いま厳選できるか（残り回数とチケットの両方が要る）。 */
export function canRefineNow(horse: Horse, tickets: number): boolean {
  return refineState(horse).left > 0 && tickets >= REFINE_TICKET_COST;
}
