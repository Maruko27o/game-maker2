// Decide what to do when a user signs in, given the account's cloud save, this
// device's local save, and which account the local save belongs to.
//
// The old logic was a naive last-write-wins on `savedAt`, which let a device's
// guest/other-account data OVERWRITE an established account (data-loss bug). We
// now key the decision on ownership: cloud data is never clobbered by a local
// save that doesn't belong to this account.
import type { SaveData } from '../types';

export type Reconciliation =
  | { action: 'pushLocal' } // account is empty → seed it from this device (guest import)
  | { action: 'loadCloud' } // take the account's cloud save; do NOT overwrite it
  | { action: 'keepLocalPushCloud' }; // same account, this device is newer → sync up

/**
 * @param cloud  the account's cloud save, or null if it has none yet
 * @param local  this device's current save
 * @param owner  userId the local save belongs to, or null for guest data
 * @param userId the account being signed into
 */
export function reconcile(
  cloud: SaveData | null,
  local: SaveData,
  owner: string | null,
  userId: string,
): Reconciliation {
  // Empty account: adopt whatever this device has (covers first sign-up too).
  if (!cloud) return { action: 'pushLocal' };

  // The local save is this same account's (a device that has synced before):
  // ordinary last-write-wins keeps multi-device play in sync.
  if (owner === userId) {
    return (cloud.savedAt ?? 0) >= (local.savedAt ?? 0)
      ? { action: 'loadCloud' }
      : { action: 'keepLocalPushCloud' };
  }

  // Local is guest data or belongs to a DIFFERENT account: the account already
  // has a save, so load it and never overwrite with foreign local data.
  return { action: 'loadCloud' };
}
