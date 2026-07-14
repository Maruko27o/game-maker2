// Running style (脚質) derivation and pace curves (RACE_V2 §4.2).
import type { RunStyle, Stats } from '../types';
import { rngFromId, type RNG } from './stats';

// Pace multipliers on vMax by race phase. Total work is ~equal across styles.
// [early(0-40%), mid(40-75%), late(75-100%)]
// Stronger front-to-back swing so styles genuinely change the race shape:
// front-runners lead then fade, closers surge late and converge at the line.
const PACE: Record<RunStyle, [number, number, number]> = {
  nige: [1.11, 1.0, 0.82],
  senko: [1.05, 1.01, 0.96],
  sashi: [0.95, 1.0, 1.18],
  oikomi: [0.91, 0.98, 1.29],
};

export function paceAt(style: RunStyle, progress: number): number {
  const p = PACE[style];
  if (progress < 0.4) return p[0];
  if (progress < 0.75) return p[1];
  return p[2];
}

// Preferred lateral offset as a fraction of half-width (−1 inner … +1 outer).
// Kept small: on an oval the outer lane is physically longer, so a big outward
// bias would hand front-runners a free distance edge over closers (RACE_V3 §4).
export const STYLE_BIAS: Record<RunStyle, number> = {
  nige: -0.4,
  senko: -0.2,
  sashi: 0.15,
  oikomi: 0.3,
};

/**
 * Choose a style from stats, weighted so spd pushes toward the front (逃げ/先行)
 * and gut pushes toward the back (差し/追込). Deterministic per horse id.
 */
function styleWeights(stats: Stats): Record<RunStyle, number> {
  const front = stats.spd - stats.gut; // >0 front-runner, <0 closer
  return {
    nige: 1 + Math.max(0, front) * 0.5,
    senko: 1.4 + Math.max(0, front) * 0.3,
    sashi: 1.4 + Math.max(0, -front) * 0.3,
    oikomi: 1 + Math.max(0, -front) * 0.5,
  };
}

export function styleFor(id: string, stats: Stats): RunStyle {
  const w = styleWeights(stats);
  const styles: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
  const total = styles.reduce((n, s) => n + w[s], 0);
  const rng: RNG = rngFromId(id + ':style');
  let r = rng() * total;
  for (const s of styles) {
    r -= w[s];
    if (r < 0) return s;
  }
  return 'senko';
}

/** The most likely style for a stat spread, with no RNG — used to preview the
 *  running style live while the player allocates points (RACE_V3 §3.3). */
export function predictStyle(stats: Stats): RunStyle {
  const w = styleWeights(stats);
  const styles: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
  return styles.reduce((best, s) => (w[s] > w[best] ? s : best), 'senko' as RunStyle);
}
