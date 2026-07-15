import { describe, it, expect } from 'vitest';
import { raceOdds, settleWin } from './betting';
import { COURSES } from '../data/courses';
import { styleFor } from './runStyle';
import type { Entrant } from './raceSim2';
import type { Stats } from '../types';

// A moderately-spread field: a clear favourite, but no horse extreme enough to
// hit the odds clamp (so the takeout shows cleanly in the implied-probability sum).
function field(): Entrant[] {
  const specs: Array<[string, Stats]> = [
    ['strong', { spd: 8, sta: 8, pwr: 8, jmp: 3, gut: 8, wit: 7 }],
    ['mid', { spd: 7, sta: 7, pwr: 7, jmp: 3, gut: 7, wit: 6 }],
    ['weak', { spd: 7, sta: 6, pwr: 6, jmp: 3, gut: 6, wit: 6 }],
    ['weak2', { spd: 6, sta: 6, pwr: 6, jmp: 3, gut: 6, wit: 6 }],
  ];
  return specs.map(([id, stats]) => ({ horseId: id, name: id, isPlayer: false, stats, style: styleFor(id, stats) }));
}

describe('betting odds', () => {
  it('every entrant gets odds within the clamp and a unique popularity rank', () => {
    const rows = raceOdds(field(), COURSES[0]);
    expect(rows).toHaveLength(4);
    for (const r of rows) {
      expect(r.odds).toBeGreaterThanOrEqual(1.1);
      expect(r.odds).toBeLessThanOrEqual(99);
    }
    expect([...rows.map((r) => r.pop)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('the strongest horse is the favourite (lowest odds, pop 1)', () => {
    const rows = raceOdds(field(), COURSES[0]);
    const fav = rows.reduce((a, b) => (a.odds < b.odds ? a : b));
    expect(fav.idx).toBe(0); // the "strong" entrant
    expect(fav.pop).toBe(1);
  });

  it('carries an ~20% takeout — implied probabilities sum above 1', () => {
    const rows = raceOdds(field(), COURSES[0]);
    const implied = rows.reduce((n, r) => n + 1 / r.odds, 0);
    expect(implied).toBeGreaterThan(1.05); // house edge present
    expect(implied).toBeLessThan(1.4);
  });
});

describe('betting payout', () => {
  it('pays floor(stake × odds) on a win and nothing on a loss', () => {
    const bet = { targetIdx: 2, amount: 100, odds: 4.7 };
    expect(settleWin(bet, 2)).toBe(470);
    expect(settleWin(bet, 0)).toBe(0);
    expect(settleWin({ targetIdx: 1, amount: 50, odds: 3.33 }, 1)).toBe(166); // floored
  });
});
