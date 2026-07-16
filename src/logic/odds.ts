// Monte-Carlo odds (RACE §odds整合性). The heuristic ability→probability model drifted
// from what the simulation actually does, so win odds no longer matched real win rates.
// Instead we run the *real* race many times over varied seeds and read the empirical
// win frequency — odds = (1/p)×takeout — so "run this race N times and the favourite
// wins ~1/odds of them" holds by construction, for whatever the sim does.
import { simulate2, type Entrant } from './raceSim2';
import type { Course } from '../data/courses';

export const MC_SAMPLES = 120; // sims per odds calc (≈20ms each → ~2.4s, run async)

// Deterministic, well-spread seed per sample (so the same field always prices the same).
const seedAt = (i: number) => ((i * 2654435761) >>> 0) + 1;

// Laplace-smoothed empirical win probabilities from `samples` simulated races.
function probsFromWins(wins: number[], samples: number): number[] {
  const alpha = 0.5; // so a horse that never wins still gets long (not infinite) odds
  const tot = samples + alpha * wins.length;
  return wins.map((w) => (w + alpha) / tot);
}

/** Synchronous MC win probabilities (used in tests). */
export function mcWinProbs(
  entrants: Entrant[],
  course: Course,
  mode: 30 | 60,
  opts: { laps?: number; samples?: number; moods?: number[] } = {},
): number[] {
  const N = opts.samples ?? MC_SAMPLES;
  const wins = new Array(entrants.length).fill(0);
  for (let s = 0; s < N; s++) wins[simulate2(entrants, course, mode, seedAt(s), { laps: opts.laps, moods: opts.moods }).order[0]]++;
  return probsFromWins(wins, N);
}

/** Async MC win probabilities — chunks the work across ticks so the paddock's
 *  "オッズ計算中" spinner keeps animating instead of the tab freezing. */
export async function mcWinProbsAsync(
  entrants: Entrant[],
  course: Course,
  mode: 30 | 60,
  opts: { laps?: number; samples?: number; moods?: number[]; onProgress?: (frac: number) => void } = {},
): Promise<number[]> {
  const N = opts.samples ?? MC_SAMPLES;
  const batch = 6;
  const wins = new Array(entrants.length).fill(0);
  for (let s = 0; s < N; s++) {
    wins[simulate2(entrants, course, mode, seedAt(s), { laps: opts.laps, moods: opts.moods }).order[0]]++;
    if ((s + 1) % batch === 0) {
      opts.onProgress?.((s + 1) / N);
      await new Promise((r) => setTimeout(r));
    }
  }
  return probsFromWins(wins, N);
}
