// 単勝 (win) betting (RACE_V4 §4.4). Odds reuse the grand-prix odds model, which
// already bakes in the 0.80 takeout, so the house edge is consistent everywhere.
// No real money: stakes and payouts are in-game coins held in the save.
import { computeOdds } from './grandprix';
import type { Entrant } from './raceSim2';
import type { Course } from '../data/courses';

export type OddsRow = { idx: number; odds: number; pop: number };

/** Per-entrant win odds and popularity (人気) rank for a field on a course. */
export function raceOdds(entrants: Entrant[], course: Course): OddsRow[] {
  return computeOdds(entrants, course).map((o, idx) => ({ idx, odds: o.odds, pop: o.pop }));
}

export type Bet = {
  targetIdx: number; // entrant index bet on
  amount: number; // stake (coins)
  odds: number; // odds locked in at bet time
};

/** Payout for a settled win bet: floor(stake × odds) if the pick won, else 0. */
export function settleWin(bet: Bet, winnerIdx: number): number {
  return bet.targetIdx === winnerIdx ? Math.floor(bet.amount * bet.odds) : 0;
}
