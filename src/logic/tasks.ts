import type { TaskProgress } from '../types';
import {
  RACE_TASK_EVERY,
  RACE_TASK_REWARD,
  GRASS_TASK_EVERY,
  GRASS_TASK_REWARD,
} from '../data/coins';

// Coin-earning tasks (改修：タスク). Each task counts an action; every `every`
// actions it banks `reward` coins and its on-screen progress resets (count % every).
// All banked coins accumulate in one bank, claimed together from the top of the
// task screen. Pure helpers shared by the store (which banks/claims) and the UI.

/** Cycles reached for a running total (how many `every`-blocks completed). */
export function cyclesOf(count: number, every: number): number {
  return Math.floor(count / every);
}

/** Coins to bank when `count` advances past `banked` cycles (0 if none). */
export function newlyBanked(count: number, banked: number, every: number, reward: number): number {
  return Math.max(0, cyclesOf(count, every) - banked) * reward;
}

/** Progress within the current cycle (0..every-1) — the bar resets each cycle. */
export function raceCycle(t: TaskProgress): number {
  return t.racesFinished % RACE_TASK_EVERY;
}
export function grassCycle(t: TaskProgress): number {
  return t.grassSpawns % GRASS_TASK_EVERY;
}

export const TASK_META = {
  race: { every: RACE_TASK_EVERY, reward: RACE_TASK_REWARD },
  grass: { every: GRASS_TASK_EVERY, reward: GRASS_TASK_REWARD },
} as const;
