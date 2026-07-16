import { describe, it, expect } from 'vitest';
import { mcWinProbs } from './odds';
import { simulate2, type Entrant } from './raceSim2';
import { courseById } from '../data/courses';
import { styleFor } from './runStyle';
import { mulberry32, rollStatsForStyle } from './stats';

const STYLES = ['nige', 'senko', 'sashi', 'oikomi'] as const;
function field(seed: number): Entrant[] {
  const rng = mulberry32(seed * 2 + 1);
  return Array.from({ length: 8 }, (_, i) => {
    const st = STYLES[Math.floor(rng() * 4)];
    const stats = rollStatsForStyle(rng, 38 + Math.floor(rng() * 9), st);
    return { horseId: 'h' + i, name: 'h' + i, isPlayer: false, stats, style: styleFor('h' + i, stats) };
  });
}

// Odds derived from the real simulation must match the real win rates (整合性).
describe('Monte-Carlo odds match the actual win rate', () => {
  it('is deterministic and sums to ~1 (a proper probability)', () => {
    const c = courseById('green');
    const a = mcWinProbs(field(1), c, 60, { samples: 60 });
    const b = mcWinProbs(field(1), c, 60, { samples: 60 });
    expect(a).toEqual(b); // same field → same odds every time
    expect(a.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 5);
  });

  it('the priced favourite is genuinely among the best (validation set)', () => {
    const c = courseById('green');
    let match = 0;
    const F = 4;
    for (let f = 0; f < F; f++) {
      const fld = field(f);
      const priced = mcWinProbs(fld, c, 60, { samples: 120 });
      // independent validation: count real wins over a *different* seed range
      const wins = new Array(8).fill(0);
      const V = 120;
      for (let s = 0; s < V; s++) wins[simulate2(fld, c, 60, 900000 + f * V + s + 1).order[0]]++;
      const pricedFav = priced.indexOf(Math.max(...priced));
      // with a realistically flat field the top two can swap on noise, so accept the
      // priced favourite landing in the actual top-2 (still a real consistency check).
      const top2 = wins.map((w, i) => [w, i] as [number, number]).sort((a, b) => b[0] - a[0]).slice(0, 2).map((x) => x[1]);
      if (top2.includes(pricedFav)) match++;
    }
    expect(match).toBeGreaterThanOrEqual(F - 1);
  });

  it('the priced win probability tracks the real win rate (small error)', () => {
    const c = courseById('green');
    let sumErr = 0, n = 0;
    for (let f = 0; f < 3; f++) {
      const fld = field(f + 20);
      const priced = mcWinProbs(fld, c, 60, { samples: 100 });
      const wins = new Array(8).fill(0);
      const V = 100;
      for (let s = 0; s < V; s++) wins[simulate2(fld, c, 60, 500000 + f * V + s + 1).order[0]]++;
      const actual = wins.map((w) => w / V);
      for (let i = 0; i < 8; i++) { sumErr += Math.abs(priced[i] - actual[i]); n++; }
    }
    expect(sumErr / n).toBeLessThan(0.06); // mean |priced − actual| under ~6 points
  });
});
