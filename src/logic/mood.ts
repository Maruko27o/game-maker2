// Horse mood / 気配 (RACE §odds). Each race every horse rolls one of five moods,
// shown in the paddock (face + colour) and folded into its performance — a real
// paddock read. Mood is fixed for the race (so it's shown honestly and the odds
// reflect it), while the hidden race-day luck varies; both live in `perf`.
import { mulberry32 } from './stats';

export type MoodLevel = 0 | 1 | 2 | 3 | 4;

export const MOODS: { label: string; short: string; mult: number; color: string; ink: string }[] = [
  { label: '絶不調', short: '不', mult: 0.93, color: '#5b8def', ink: '#fff' },   // 0
  { label: 'イマイチ', short: '↓', mult: 0.965, color: '#8fc2f0', ink: '#22374d' }, // 1
  { label: 'ふつう', short: '−', mult: 1.0, color: '#cfc7b6', ink: '#3a2c1c' },   // 2
  { label: '好調', short: '↑', mult: 1.035, color: '#7fce77', ink: '#1e3f1c' },   // 3
  { label: '絶好調', short: '絶', mult: 1.07, color: '#ff8a4c', ink: '#fff' },     // 4
];

/** Deterministic per-race mood for each entrant (uniform over the 5 levels). */
export function rollMoods(seed: number, n: number): MoodLevel[] {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  return Array.from({ length: n }, () => Math.floor(rng() * 5) as MoodLevel);
}

/** Mood biased by ability: the weaker a horse looks, the more its mood leans good
 *  (好調/絶好調), so no runner is a hopeless 大穴 stuck at the odds floor — a longshot
 *  "in great form today" is genuinely more competitive, which pulls its odds in. The
 *  Monte-Carlo odds price whatever mood is shown, so 倍率=勝率 stays exact.
 *  `strengths` is any per-entrant ability proxy (higher = stronger), e.g. winProbs. */
export function assignMoods(strengths: number[], seed: number): MoodLevel[] {
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const n = strengths.length;
  const order = strengths.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s); // weakest first
  const weakness = new Array<number>(n).fill(0);
  order.forEach((o, rank) => (weakness[o.i] = n > 1 ? 1 - rank / (n - 1) : 0)); // 1 weak … 0 strong
  return strengths.map((_, i) => {
    const level = Math.round(rng() * 4 + weakness[i] * 2.2); // weak horses ride good form
    return Math.max(0, Math.min(4, level)) as MoodLevel;
  });
}

/** Performance multipliers to feed simulate2({ moods }). */
export function moodMultipliers(levels: MoodLevel[]): number[] {
  return levels.map((l) => MOODS[l].mult);
}
