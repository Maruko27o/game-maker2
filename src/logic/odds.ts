// Monte-Carlo odds (RACE §odds整合性). The heuristic ability→probability model drifted
// from what the simulation actually does, so win odds no longer matched real win rates.
// Instead we run the *real* race many times over varied seeds and read the empirical
// win frequency — odds = (1/p)×takeout — so "run this race N times and the favourite
// wins ~1/odds of them" holds by construction, for whatever the sim does.
import { simulate2, type Entrant } from './raceSim2';
import type { Course } from '../data/courses';
import { winProbs } from './grandprix';

export const MC_SAMPLES = 120; // sims per odds calc (≈20ms each → ~2.4s, run async)

// Deterministic, well-spread seed per sample (so the same field always prices the same).
const seedAt = (i: number) => ((i * 2654435761) >>> 0) + 1;

// 実際にレースを回して数えた勝率を、「能力に比例した事前分布」で平滑化する。
//
// 以前は一様な平滑化（Laplace, alpha=1）だった。この場合、1度も勝てなかったウマは
// 頭数によらず全員が同じ確率になり、単勝は必ず約100倍で頭打ちになっていた
//   （0.8 / (1/(120+8)) = 102.4倍）。
// つまり「100倍以上の大波乱」も、大穴どうしの実力差も、構造的に表現できなかった。
//
// そこで平滑化の重みを一様ではなく、解析モデル（能力・スキル・適性から求めた勝率）に
// 比例させる。合計は変わらない（Σ prior = 1）ので確率の総和は1のまま。
//   p_i = (勝った回数_i + K × prior_i) / (サンプル数 + K)
// これで、勝てなかったウマでも「惜しかった馬」と「力が違いすぎる馬」が別の倍率になり、
// 100〜300倍の帯がなだらかに埋まる。サンプル数を増やさずに裾の解像度が上がるので、
// オッズ計算の待ち時間も変わらない。
const PRIOR_K = 6; // 事前分布の重み（「仮想的に6レース分」ぶんの重み）
// 事前分布の温度。解析モデルそのまま（3.2）だと差が付きすぎて、弱いウマが一気に
// 1000倍超まで飛んでしまい 50〜300倍の帯が空く。少しなだらかにして、大穴が
// 「50倍・100倍・200倍…」と段階的に並ぶようにする。
export const PRIOR_TEMP = 6;
export function probsFromWins(wins: number[], samples: number, prior?: number[]): number[] {
  const n = wins.length;
  const pri = prior && prior.length === n ? prior : new Array(n).fill(1 / n);
  const psum = pri.reduce((a, b) => a + b, 0) || 1;
  const tot = samples + PRIOR_K;
  return wins.map((w, i) => (w + PRIOR_K * (pri[i] / psum)) / tot);
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
  return probsFromWins(wins, N, winProbs(entrants, course, mode, PRIOR_TEMP));
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
  return probsFromWins(wins, N, winProbs(entrants, course, mode, PRIOR_TEMP));
}
