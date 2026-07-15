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
  | { action: 'keepLocalPushCloud' } // same account, this device is newer → sync up
  | { action: 'conflict' }; // foreign/guest local WITH progress vs an existing cloud → ask

function hasProgress(s: SaveData): boolean {
  return s.horses.length > 0;
}

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
    // Safety net: never let an emptied local (lost/cleared storage, a stale tab)
    // wipe a cloud that still has progress, even if its clock looks newer. Taking
    // the cloud here can't lose data — a genuine local reset is rare and can be
    // redone, whereas an accidental wipe is unrecoverable.
    if (!hasProgress(local) && hasProgress(cloud)) return { action: 'loadCloud' };
    return (cloud.savedAt ?? 0) >= (local.savedAt ?? 0)
      ? { action: 'loadCloud' }
      : { action: 'keepLocalPushCloud' };
  }

  // Local is guest/other-account data. If it's empty there's nothing to lose —
  // just take the cloud. If it has real progress, never silently discard either
  // side: ask the player which to keep (ACCOUNT.md §1.6).
  if (!hasProgress(local)) return { action: 'loadCloud' };
  return { action: 'conflict' };
}
