import { describe, it, expect } from 'vitest';
import { raceOdds, oddsFor, selProb, settle, wouldWin, MAX_ODDS, type Bet } from './betting';
import { winProbs } from './grandprix';
import { COURSES, courseById } from '../data/courses';
import { styleFor } from './runStyle';
import type { Entrant } from './raceSim2';
import type { Stats } from '../types';

function ent(id: string, stats: Stats): Entrant {
  return { horseId: id, name: id, isPlayer: false, stats, style: styleFor(id, stats) };
}

// Moderately-spread field so no market hits the odds clamp.
function field(): Entrant[] {
  const specs: Array<[string, Stats]> = [
    ['strong', { spd: 8, sta: 8, pwr: 8, jmp: 3, gut: 8, wit: 7 }],
    ['mid', { spd: 7, sta: 7, pwr: 7, jmp: 3, gut: 7, wit: 6 }],
    ['weak', { spd: 7, sta: 6, pwr: 6, jmp: 3, gut: 6, wit: 6 }],
    ['weak2', { spd: 6, sta: 6, pwr: 6, jmp: 3, gut: 6, wit: 6 }],
  ];
  return specs.map(([id, stats]) => ({ horseId: id, name: id, isPlayer: false, stats, style: styleFor(id, stats) }));
}

describe('win odds table', () => {
  it('within clamp, unique popularity, favourite is strongest, ~20% takeout', () => {
    const rows = raceOdds(field(), COURSES[0]);
    for (const r of rows) expect(r.odds).toBeGreaterThanOrEqual(1.1);
    expect([...rows.map((r) => r.pop)].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(rows.reduce((a, b) => (a.odds < b.odds ? a : b)).idx).toBe(0);
    const implied = rows.reduce((n, r) => n + 1 / r.odds, 0);
    expect(implied).toBeGreaterThan(1.05);
  });
});

describe('market probabilities (Harville)', () => {
  const p = winProbs(field(), COURSES[0]);
  it('place (top-3) is more likely than win for the same horse', () => {
    expect(selProb('place', [0], p)).toBeGreaterThan(selProb('win', [0], p));
  });
  it('trifecta is rarer (longer odds) than win', () => {
    expect(oddsFor('trifecta', [0, 1, 2], p)).toBeGreaterThan(oddsFor('win', [0], p));
  });
  it('wide (both in top-3) is easier than quinella (exact top-2) for the same pair', () => {
    expect(selProb('wide', [0, 1], p)).toBeGreaterThan(selProb('quinella', [0, 1], p));
  });
  it('all odds respect the clamp', () => {
    const cases: [Bet['kind'], number[]][] = [
      ['win', [0]], ['place', [3]], ['quinella', [0, 1]], ['wide', [2, 3]], ['trifecta', [3, 2, 1]],
    ];
    for (const [k, sel] of cases) {
      const o = oddsFor(k, sel, p);
      expect(o).toBeGreaterThanOrEqual(1.1);
      expect(o).toBeLessThanOrEqual(MAX_ODDS);
    }
  });
});

describe('settlement', () => {
  const order = [2, 5, 1, 0, 3, 4, 6, 7]; // finishing order (entrant indices)
  const bet = (kind: Bet['kind'], sel: number[]): Bet => ({ kind, sel, amount: 100, odds: 4 });
  it('win: only the actual winner pays', () => {
    expect(settle(bet('win', [2]), order)).toBe(400);
    expect(settle(bet('win', [5]), order)).toBe(0);
  });
  it('place: any of the top 3 pays', () => {
    expect(settle(bet('place', [1]), order)).toBe(400); // 3rd
    expect(settle(bet('place', [0]), order)).toBe(0); // 4th
  });
  it('quinella: the exact top-2 set in any order', () => {
    expect(settle(bet('quinella', [5, 2]), order)).toBe(400);
    expect(settle(bet('quinella', [2, 1]), order)).toBe(0); // 1st+3rd, not top-2
  });
  it('wide: both picks inside the top 3', () => {
    expect(settle(bet('wide', [2, 1]), order)).toBe(400); // 1st + 3rd
    expect(settle(bet('wide', [2, 0]), order)).toBe(0); // 0 is 4th
  });
  it('trifecta: exact 1-2-3 order', () => {
    expect(settle(bet('trifecta', [2, 5, 1]), order)).toBe(400);
    expect(settle(bet('trifecta', [2, 1, 5]), order)).toBe(0); // right horses, wrong order
  });
});

describe('wouldWin (in-race glow)', () => {
  it('matches settle for the current standing', () => {
    // ranks[entrantIdx] = current rank. Winner=idx3, 2nd=idx1, 3rd=idx0.
    const ranks = [3, 2, 5, 1, 6, 7, 8, 4];
    expect(wouldWin({ kind: 'win', sel: [3], amount: 10, odds: 2 }, ranks)).toBe(true);
    expect(wouldWin({ kind: 'win', sel: [1], amount: 10, odds: 2 }, ranks)).toBe(false);
    expect(wouldWin({ kind: 'place', sel: [0], amount: 10, odds: 2 }, ranks)).toBe(true); // 0 is 3rd
    expect(wouldWin({ kind: 'trifecta', sel: [3, 1, 0], amount: 10, odds: 2 }, ranks)).toBe(true);
  });
});

// The odds must stay consistent with the win probabilities (fair value × takeout)
// and respond to ability and course, like real pari-mutuel racing.
describe('odds are realistic vs win probability', () => {
  it('win odds = (1/p) × 0.8 takeout; book ≈ 125% (20% take) on every course', () => {
    for (const c of COURSES) {
      const f = field();
      const p = winProbs(f, c);
      const rows = raceOdds(f, c);
      if (rows.some((r) => r.odds <= 1.1 || r.odds >= MAX_ODDS)) continue; // skip clamped edges
      for (const r of rows) expect(r.odds).toBeCloseTo(0.8 / p[r.idx], 2);
      const book = rows.reduce((n, r) => n + 1 / r.odds, 0);
      expect(book).toBeCloseTo(1.25, 2); // 1 / 0.8
    }
  });

  it('a stronger horse gets shorter odds; rivals drift out', () => {
    const c = COURSES[0];
    const base = field();
    const o0 = raceOdds(base, c);
    const bumped = base.map((e, i) =>
      i === 2 ? ent(e.horseId, { ...e.stats, spd: e.stats.spd + 5, pwr: e.stats.pwr + 5 }) : e,
    );
    const o1 = raceOdds(bumped, c);
    expect(o1[2].odds).toBeLessThan(o0[2].odds); // improved horse shortens
    expect(o1[0].odds).toBeGreaterThan(o0[0].odds); // the former favourite lengthens
  });

  it('course aptitude changes odds (a sprinter is shorter on a speed course)', () => {
    const sprinter = ent('sprint', { spd: 12, sta: 4, pwr: 8, jmp: 6, gut: 5, wit: 5 });
    const filler = [1, 2, 3, 4, 5].map((n) => ent('f' + n, { spd: 7, sta: 7, pwr: 7, jmp: 6, gut: 6, wit: 6 }));
    const g = [sprinter, ...filler];
    const onSpeed = raceOdds(g, courseById('circuit'))[0].odds; // spd-weighted
    const onStamina = raceOdds(g, courseById('sand'))[0].odds; // sta-weighted
    expect(onSpeed).toBeLessThan(onStamina); // sprinter is favoured on the speed course
  });
});
