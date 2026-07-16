import type { TaskProgress } from '../types';
import { RACE_TASK_EVERY, RACE_TASK_REWARD } from '../data/coins';

// Coin-earning tasks (改修：タスク). Small, pure helpers shared by the store (which
// grants coins) and the UI (which shows progress), so both agree on the numbers.

/** How many per-N-race rewards are earned but not yet claimed. */
export function claimableRaceRewards(t: TaskProgress): number {
  return Math.max(0, Math.floor(t.racesFinished / RACE_TASK_EVERY) - t.raceRewardClaimed);
}

/** Progress within the current cycle: races into the next reward (0..EVERY-1). */
export function raceCycleProgress(t: TaskProgress): number {
  return t.racesFinished % RACE_TASK_EVERY;
}

/** Total coins waiting to be received. */
export function claimableRaceCoins(t: TaskProgress): number {
  return claimableRaceRewards(t) * RACE_TASK_REWARD;
}
