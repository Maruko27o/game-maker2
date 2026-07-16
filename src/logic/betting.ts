// Betting markets (RACE_V4 §4 / 改修①). Five 馬券 types, all priced off the same
// deterministic win probabilities (`winProbs`) so odds are consistent with the
// popularity shown in the paddock. A Harville top-3 model turns win probabilities
// into place/pair/triple probabilities. Everything carries the 0.80 takeout.
// No real money — stakes and payouts are in-game coins.
import { winProbs } from './grandprix';
import type { Entrant } from './raceSim2';
import type { Course } from '../data/courses';
import type { BetKind } from '../types';

export type { BetKind };

// Display metadata + selection rules per market.
export const BET_KINDS: { kind: BetKind; label: string; pick: number; ordered: boolean; hint: string }[] = [
  { kind: 'win', label: '単勝', pick: 1, ordered: false, hint: '1着を当てる' },
  { kind: 'place', label: '複勝', pick: 1, ordered: false, hint: '3着以内に入れば的中' },
  { kind: 'quinella', label: '馬連', pick: 2, ordered: false, hint: '1・2着の組み合わせ（順不同）' },
  { kind: 'wide', label: 'ワイド', pick: 2, ordered: false, hint: '選んだ2頭がともに3着以内' },
  { kind: 'trifecta', label: '3連単', pick: 3, ordered: true, hint: '1・2・3着を着順どおりに' },
];

const TAKEOUT = 0.8; // 80% payout
export const MAX_ODDS = 30000; // display/pay cap — near the real JRA 3連単 record (~29,835倍)
const clampOdds = (o: number) => Math.min(MAX_ODDS, Math.max(1.1, o));

export type Bet = { kind: BetKind; sel: number[]; amount: number; odds: number };

// Harville top-3 orderings: P((a,b,c) finish 1st/2nd/3rd). Σ ≈ 1. n=8 → 336 terms.
function top3(p: number[]): { a: number; b: number; c: number; prob: number }[] {
  const n = p.length;
  const out: { a: number; b: number; c: number; prob: number }[] = [];
  for (let a = 0; a < n; a++) {
    const da = 1 - p[a];
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      const dab = da - p[b];
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        out.push({ a, b, c, prob: p[a] * (p[b] / (da || 1e-9)) * (p[c] / (dab || 1e-9)) });
      }
    }
  }
  return out;
}

/** Probability that a selection hits, by market. `sel` are entrant indices. */
export function selProb(kind: BetKind, sel: number[], p: number[]): number {
  if (kind === 'win') return p[sel[0]] ?? 0;
  const tr = top3(p);
  if (kind === 'place') return tr.reduce((s, t) => s + (t.a === sel[0] || t.b === sel[0] || t.c === sel[0] ? t.prob : 0), 0);
  if (kind === 'trifecta') return tr.reduce((s, t) => s + (t.a === sel[0] && t.b === sel[1] && t.c === sel[2] ? t.prob : 0), 0);
  const [i, j] = sel;
  if (kind === 'quinella') return tr.reduce((s, t) => s + (((t.a === i && t.b === j) || (t.a === j && t.b === i)) ? t.prob : 0), 0);
  if (kind === 'wide') return tr.reduce((s, t) => s + ([t.a, t.b, t.c].includes(i) && [t.a, t.b, t.c].includes(j) ? t.prob : 0), 0);
  return 0;
}

/** Decimal odds for a selection (with takeout, clamped). */
export function oddsFor(kind: BetKind, sel: number[], p: number[]): number {
  const prob = selProb(kind, sel, p);
  return prob > 0 ? clampOdds((1 / prob) * TAKEOUT) : MAX_ODDS;
}

// Win odds/popularity table for the paddock header (people bet from 人気).
export type OddsRow = { idx: number; odds: number; pop: number };
export function raceOdds(entrants: Entrant[], course: Course): OddsRow[] {
  return raceOddsFromProbs(winProbs(entrants, course));
}

/** Same as raceOdds but from pre-computed win probabilities (e.g. Monte-Carlo). */
export function raceOddsFromProbs(p: number[]): OddsRow[] {
  const order = p.map((_, i) => i).sort((a, b) => p[b] - p[a]);
  const pop = new Array<number>(p.length);
  order.forEach((idx, place) => (pop[idx] = place + 1));
  return p.map((pi, idx) => ({ idx, odds: clampOdds((1 / pi) * TAKEOUT), pop: pop[idx] }));
}

/** Settle a bet against a finishing order (entrant indices, 1st..last). Returns
 *  the payout in coins (0 if it lost). */
export function settle(bet: Bet, order: number[]): number {
  const top = order.slice(0, 3);
  const [a, b] = order; // 1st, 2nd entrant indices
  let won = false;
  switch (bet.kind) {
    case 'win':
      won = bet.sel[0] === order[0];
      break;
    case 'place':
      won = top.includes(bet.sel[0]);
      break;
    case 'quinella': {
      const s = new Set([a, b]);
      won = bet.sel.length === 2 && bet.sel.every((x) => s.has(x));
      break;
    }
    case 'wide':
      won = bet.sel.length === 2 && bet.sel.every((x) => top.includes(x));
      break;
    case 'trifecta':
      won = bet.sel[0] === order[0] && bet.sel[1] === order[1] && bet.sel[2] === order[2];
      break;
  }
  return won ? Math.floor(bet.amount * bet.odds) : 0;
}

/** Would this bet win if the race ended right now? Used for the in-race
 *  "的中見込み" glow. `ranks[entrantIdx]` = current rank (1..n). */
export function wouldWin(bet: Bet, ranks: number[]): boolean {
  const order = ranks.map((_, i) => i).sort((x, y) => ranks[x] - ranks[y]);
  return settle({ ...bet, amount: Math.max(1, bet.amount) }, order) > 0;
}
