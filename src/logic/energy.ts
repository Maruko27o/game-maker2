// Grass spawn energy (stamina) model. One spawn charges every hour, stored up to
// a cap of 10. Availability is derived purely from timestamps — never a running
// timer — so it stays correct across app restarts, day rollovers and long idles.
//
// 回復間隔は引数で差し替えられる（月曜の草むらデーは30分）。既定は従来どおり1時間。
// どの間隔で数えるかは「いま」の曜日で決めるので、イベント日にアプリを開けば
// 放置ぶんもその日のペースで数える＝プレイヤーが損をしない側に倒している。

export const ENERGY_CAP = 10;
export const ENERGY_REGEN_MS = 60 * 60 * 1000; // 1 hour

export type EnergyState = { energy: number; energyUpdatedAt: number };

/**
 * Resolve the stored energy forward to `now`, accruing 1 per hour up to the cap.
 * Returns a normalized state whose `energyUpdatedAt` is the anchor for the next
 * charge (or `now` when full). Handles backwards clock movement defensively.
 */
export function normalizeEnergy(state: EnergyState, now: number, regenMs = ENERGY_REGEN_MS): EnergyState {
  const energy = Math.max(0, Math.min(ENERGY_CAP, state.energy));
  if (energy >= ENERGY_CAP) return { energy: ENERGY_CAP, energyUpdatedAt: now };

  const elapsed = now - state.energyUpdatedAt;
  if (elapsed <= 0) return { energy, energyUpdatedAt: state.energyUpdatedAt };

  const gained = Math.floor(elapsed / regenMs);
  const newEnergy = Math.min(ENERGY_CAP, energy + gained);
  if (newEnergy >= ENERGY_CAP) return { energy: ENERGY_CAP, energyUpdatedAt: now };
  // Carry the leftover progress toward the next charge.
  return { energy: newEnergy, energyUpdatedAt: state.energyUpdatedAt + gained * regenMs };
}

/** Milliseconds until the next charge (0 when already full). */
export function msUntilNextEnergy(state: EnergyState, now: number, regenMs = ENERGY_REGEN_MS): number {
  const n = normalizeEnergy(state, now, regenMs);
  if (n.energy >= ENERGY_CAP) return 0;
  return Math.max(0, regenMs - (now - n.energyUpdatedAt));
}

/** Spend one energy. Returns the new state, or null when empty. */
export function spendEnergy(state: EnergyState, now: number, regenMs = ENERGY_REGEN_MS): EnergyState | null {
  const n = normalizeEnergy(state, now, regenMs);
  if (n.energy <= 0) return null;
  return { energy: n.energy - 1, energyUpdatedAt: n.energyUpdatedAt };
}
