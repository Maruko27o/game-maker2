// Grass spawn energy (stamina) model. One spawn charges every hour, stored up to
// a cap of 3. Availability is derived purely from timestamps — never a running
// timer — so it stays correct across app restarts, day rollovers and long idles.

export const ENERGY_CAP = 3;
export const ENERGY_REGEN_MS = 60 * 60 * 1000; // 1 hour

export type EnergyState = { energy: number; energyUpdatedAt: number };

/**
 * Resolve the stored energy forward to `now`, accruing 1 per hour up to the cap.
 * Returns a normalized state whose `energyUpdatedAt` is the anchor for the next
 * charge (or `now` when full). Handles backwards clock movement defensively.
 */
export function normalizeEnergy(state: EnergyState, now: number): EnergyState {
  const energy = Math.max(0, Math.min(ENERGY_CAP, state.energy));
  if (energy >= ENERGY_CAP) return { energy: ENERGY_CAP, energyUpdatedAt: now };

  const elapsed = now - state.energyUpdatedAt;
  if (elapsed <= 0) return { energy, energyUpdatedAt: state.energyUpdatedAt };

  const gained = Math.floor(elapsed / ENERGY_REGEN_MS);
  const newEnergy = Math.min(ENERGY_CAP, energy + gained);
  if (newEnergy >= ENERGY_CAP) return { energy: ENERGY_CAP, energyUpdatedAt: now };
  // Carry the leftover progress toward the next charge.
  return { energy: newEnergy, energyUpdatedAt: state.energyUpdatedAt + gained * ENERGY_REGEN_MS };
}

/** Milliseconds until the next charge (0 when already full). */
export function msUntilNextEnergy(state: EnergyState, now: number): number {
  const n = normalizeEnergy(state, now);
  if (n.energy >= ENERGY_CAP) return 0;
  return ENERGY_REGEN_MS - (now - n.energyUpdatedAt);
}

/** Spend one energy. Returns the new state, or null when empty. */
export function spendEnergy(state: EnergyState, now: number): EnergyState | null {
  const n = normalizeEnergy(state, now);
  if (n.energy <= 0) return null;
  return { energy: n.energy - 1, energyUpdatedAt: n.energyUpdatedAt };
}
