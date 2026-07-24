import { STREAK_MAX } from '../types';

// スペシャルタスク（連勝チャレンジ）の純ロジック。ストア（状態更新）と UI（表示）で
// 共有する。1勝＝「1人でレース・馬券あり」で払戻額 > 賭け額。負けで連勝は 0 に戻る。
// 一度到達した Lv の報酬（連勝フレーム）は、連勝が途切れても受け取れる（貯まる）。

export type StreakState = {
  soloStreak: number; // 現在の連勝数（負けで 0）
  streakBest: number; // これまでの最高連勝数（達成済み Lv を決める）
  streakClaimed: number; // 受け取り済み Lv 数（0..STREAK_MAX）
};

/** 1レースの結果を折り込む。win=払戻>賭け。負けは連勝リセット、勝ちは +1（最高値も更新）。 */
export function foldRace(s: StreakState, win: boolean): StreakState {
  if (!win) return { ...s, soloStreak: 0 };
  const soloStreak = s.soloStreak + 1;
  return { ...s, soloStreak, streakBest: Math.max(s.streakBest, soloStreak) };
}

/** 達成済み（受け取り可能になった）最高 Lv。1..STREAK_MAX に丸める。 */
export function achievedLevel(s: StreakState): number {
  return Math.min(s.streakBest, STREAK_MAX);
}

/** いま「受け取り待ち」の Lv があるか（達成済みで未受け取り）。 */
export function claimable(s: StreakState): boolean {
  return s.streakClaimed < achievedLevel(s);
}

/** 画面に出すいまの Lv（受け取り待ち＝その Lv、なければ進行中の次 Lv）。全達成で null。 */
export function currentLevel(s: StreakState): number | null {
  const next = s.streakClaimed + 1;
  return next > STREAK_MAX ? null : next;
}

/** 進行中 Lv への進捗（0..1）。現在の連勝数を対象 Lv で割る（達成済みは 1）。 */
export function progress(s: StreakState, level: number): number {
  if (level <= achievedLevel(s)) return 1;
  return Math.max(0, Math.min(1, s.soloStreak / level));
}

/** 受け取り待ちの Lv 数（バッジ表示用）。 */
export function pendingCount(s: StreakState): number {
  return Math.max(0, achievedLevel(s) - s.streakClaimed);
}

/** 受け取り済み（＝所持している連勝フレーム）の Lv 一覧、1..streakClaimed。 */
export function ownedLevels(s: StreakState): number[] {
  return Array.from({ length: s.streakClaimed }, (_, i) => i + 1);
}

export { STREAK_MAX };
