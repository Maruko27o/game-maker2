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

// 同じアカウントの続きなら、手持ちのウマIDが1頭くらいは重なるはず。1頭も
// 重ならない＝別系統のセーブ（ゲスト枠を掴んでいる、owner の取り違え等）。
function sameLineage(a: SaveData, b: SaveData): boolean {
  const ids = new Set(b.horses.map((h) => h.id));
  return a.horses.some((h) => ids.has(h.id));
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
    // 逆向きも同じ理屈で守る：クラウドが空で端末に中身があるなら、たとえ
    // クラウドの時計が新しくても空を採用しない（＝端末の手持ちが消える）。
    // 押し上げれば空だったクラウドも埋まるので、どちらにも損が無い。
    if (hasProgress(local) && !hasProgress(cloud)) return { action: 'keepLocalPushCloud' };
    // 二の矢：同じアカウントのはずなのに手持ちのウマが1頭も重ならないなら、
    // それは続きではなく別系統のセーブ（ゲスト枠を掴んでいる／owner の取り違え）。
    // 時計だけで決めて黙って上書きすると、こちらが新しいというだけで本物が消える。
    // 破棄はせず、どちらを使うかを本人に聞く。
    if (hasProgress(local) && hasProgress(cloud) && !sameLineage(local, cloud)) {
      return { action: 'conflict' };
    }
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

/**
 * ログイン中の定期保存（デバウンス push）にも、サインイン時と同じ安全網をかける。
 *
 * reconcile は「空になった端末のセーブで、中身のあるクラウドを潰さない」を守っているが、
 * それはサインインの瞬間だけの判定だった。ログインしたまま端末側が空になった状態で
 * 保存が走ると、push はバックアップも取らずに本体を上書きしてしまう（＝実際に
 * 「ログインと最高倍率は残っているのにコインとウマだけ消えた」形で発生した）。
 *
 * ウマを手放す操作はゲームに無いので、「ウマ0頭」は正常な状態ではなく端末側の異常。
 * その場合はクラウドを正としてこちらを直す（＝押し上げない）。
 */
export function guardEmptyPush(local: SaveData, cloud: SaveData | null): 'push' | 'adoptCloud' {
  if (cloud && !hasProgress(local) && hasProgress(cloud)) return 'adoptCloud';
  return 'push';
}

/**
 * A debounced push was rejected because the server `rev` advanced since we read it
 * — i.e. another tab / another device / a reload of the SAME signed-in account
 * wrote in the meantime. Both saves belong to this account, so resolve silently by
 * last-write-wins (the same policy `reconcile` already uses for owner === userId)
 * instead of surfacing the conflict modal on every rev mismatch (which made two
 * open instances ping-pong "データが食い違っています" endlessly). Returns whether to
 * take the freshly-read cloud save, or to re-push our local one on top of it.
 */
export function resolvePushConflict(cloudSavedAt: number, localSavedAt: number): 'adoptCloud' | 'repushLocal' {
  return (cloudSavedAt ?? 0) > (localSavedAt ?? 0) ? 'adoptCloud' : 'repushLocal';
}
