import { describe, it, expect } from 'vitest';
import { raceOdds, oddsFor, selProb, settle, wouldWin, betTier, fmtOdds, MAX_ODDS, type Bet } from './betting';
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
    for (const r of rows) expect(r.odds).toBeGreaterThanOrEqual(1.0); // 下限は元返し(1.0倍)
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
      expect(o).toBeGreaterThanOrEqual(1.0); // 下限は元返し(1.0倍)
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

describe('betTier (in-race closeness: 虹/金/銀/無地)', () => {
  // ranks[entrantIdx] = current rank. Here entrant i is currently in rank i+1.
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
  it('3=的中 when the bet would pay now', () => {
    expect(betTier({ kind: 'win', sel: [0], amount: 10, odds: 2 }, ranks)).toBe(3);
    expect(betTier({ kind: 'trifecta', sel: [0, 1, 2], amount: 10, odds: 2 }, ranks)).toBe(3);
  });
  it('2=ニアピン for the right horses in the wrong order / one place off', () => {
    expect(betTier({ kind: 'trifecta', sel: [2, 1, 0], amount: 10, odds: 2 }, ranks)).toBe(2); // top3, wrong order
    expect(betTier({ kind: 'win', sel: [1], amount: 10, odds: 2 }, ranks)).toBe(2); // currently 2nd
    expect(betTier({ kind: 'place', sel: [3], amount: 10, odds: 2 }, ranks)).toBe(2); // currently 4th
  });
  it('1=普通 when a pick is merely contending', () => {
    expect(betTier({ kind: 'win', sel: [3], amount: 10, odds: 2 }, ranks)).toBe(1); // 4th
    expect(betTier({ kind: 'trifecta', sel: [0, 1, 5], amount: 10, odds: 2 }, ranks)).toBe(1); // 2 of 3 in top3
  });
  it('0=圏外 when nothing is close', () => {
    expect(betTier({ kind: 'win', sel: [7], amount: 10, odds: 2 }, ranks)).toBe(0); // last
    expect(betTier({ kind: 'trifecta', sel: [5, 6, 7], amount: 10, odds: 2 }, ranks)).toBe(0);
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
      if (rows.some((r) => r.odds <= 1.0 || r.odds >= MAX_ODDS)) continue; // skip clamped edges
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

// ---- 期待値の監査（コイン増殖バグの再発防止） --------------------------------
// どの馬券種でも「必ず儲かる買い目」があってはいけない。
// 期待値 = 的中確率 × 倍率。控除率0.8なので、公正倍率が下限(1.0)を上回る限り
// 期待値は 0.8 で一定。的中率が非常に高い買い目（人気馬の複勝など）では公正倍率が
// 1.0 を割り込み、下限に張り付く。このとき 期待値 = 的中確率 × 1.0 ≤ 1 でなければ
// ならない。以前は下限が 1.1 だったため、複勝で期待値 1.07（＝必ず儲かる）になっていた。
describe('bet EV audit（必ず儲かる買い目が無いこと）', () => {
  const kinds: Bet['kind'][] = ['win', 'place', 'quinella', 'wide', 'trifecta'];

  function evOf(kind: Bet['kind'], sel: number[], p: number[]): number {
    return selProb(kind, sel, p) * oddsFor(kind, sel, p);
  }

  it('どんな確率分布でも、どの馬券種も期待値が1を超えない', () => {
    // 一強〜横一線まで、極端な分布を含めて総当たりで確認する。
    const fields: number[][] = [
      [0.90, 0.04, 0.02, 0.015, 0.01, 0.007, 0.005, 0.003], // 超一強
      [0.60, 0.20, 0.08, 0.05, 0.03, 0.02, 0.015, 0.005],
      [0.30, 0.22, 0.16, 0.12, 0.09, 0.06, 0.03, 0.02],
      [0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125, 0.125], // 横一線
      [0.5, 0.45, 0.02, 0.01, 0.008, 0.006, 0.004, 0.002], // 2強
    ];
    for (const p of fields) {
      for (let i = 0; i < p.length; i++) {
        for (const k of ['win', 'place'] as Bet['kind'][]) {
          expect(evOf(k, [i], p), `${k} #${i}`).toBeLessThanOrEqual(1.0000001);
        }
        for (let j = 0; j < p.length; j++) {
          if (i === j) continue;
          for (const k of ['quinella', 'wide'] as Bet['kind'][]) {
            expect(evOf(k, [i, j], p), `${k} #${i}-${j}`).toBeLessThanOrEqual(1.0000001);
          }
        }
      }
      // 3連単は本命どころだけ確認（全順列は重い）
      expect(evOf('trifecta', [0, 1, 2], p)).toBeLessThanOrEqual(1.0000001);
    }
  });

  it('公正倍率が下限を上回る買い目では、期待値はきっちり控除率(0.8)になる', () => {
    const p = [0.30, 0.22, 0.16, 0.12, 0.09, 0.06, 0.03, 0.02];
    for (const k of kinds) {
      const sel = k === 'win' || k === 'place' ? [7] : k === 'trifecta' ? [7, 6, 5] : [7, 6];
      expect(evOf(k, sel, p)).toBeCloseTo(0.8, 6);
    }
  });

  it('確率の整合：複勝 ≧ 単勝、ワイド ≧ 馬連', () => {
    const p = [0.30, 0.22, 0.16, 0.12, 0.09, 0.06, 0.03, 0.02];
    for (let i = 0; i < p.length; i++) {
      expect(selProb('place', [i], p)).toBeGreaterThanOrEqual(p[i] - 1e-9);
      for (let j = 0; j < p.length; j++) {
        if (i === j) continue;
        expect(selProb('wide', [i, j], p)).toBeGreaterThanOrEqual(selProb('quinella', [i, j], p) - 1e-9);
      }
    }
  });

  it('3連単の全順列の確率を足すと1になる（Harvilleの正規化）', () => {
    const p = [0.30, 0.22, 0.16, 0.12, 0.09, 0.06, 0.03, 0.02];
    let sum = 0;
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) for (let c = 0; c < 8; c++) {
      if (a === b || a === c || b === c) continue;
      sum += selProb('trifecta', [a, b, c], p);
    }
    expect(sum).toBeCloseTo(1, 6);
  });
});

describe('fmtOdds（表示）', () => {
  it('1000倍未満は小数第1位まで・切り捨て（切り上げない）', () => {
    expect(fmtOdds(1.4837)).toBe('1.4'); // 1.5 とは出さない（実際は1.5未満なので）
    expect(fmtOdds(1.5)).toBe('1.5');
    expect(fmtOdds(1.59)).toBe('1.5');
    expect(fmtOdds(2)).toBe('2.0');
    expect(fmtOdds(999.99)).toBe('999.9');
  });

  it('表示された倍率は実際の倍率を超えない（狙った倍率を下回らない保証）', () => {
    for (const x of [1.0, 1.05, 1.49, 1.5, 3.333, 9.99, 12.34, 87.65, 999.9]) {
      expect(parseFloat(fmtOdds(x))).toBeLessThanOrEqual(x + 1e-9);
    }
  });
  it('1001倍と100.1倍を見間違えない（点の有無で桁が分かる）', () => {
    expect(fmtOdds(100.1)).toBe('100.1'); // 3桁＋小数点
    expect(fmtOdds(1001)).toBe('1001'); // 4桁・小数点なし
    expect(fmtOdds(1000)).toBe('1000');
    expect(fmtOdds(9999.9)).toBe('9999');
  });

  it('10000倍以上は「万」でまとめる', () => {
    expect(fmtOdds(10000)).toBe('1.0万');
    expect(fmtOdds(32050)).toBe('3.2万');
    expect(fmtOdds(100000)).toBe('10.0万');
  });
});
