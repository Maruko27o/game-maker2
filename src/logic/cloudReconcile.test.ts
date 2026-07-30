import { describe, it, expect } from 'vitest';
import { reconcile, resolvePushConflict, guardEmptyPush } from './cloudReconcile';
import type { SaveData } from '../types';

function save(savedAt: number, horses = 0): SaveData {
  return {
    version: 6,
    owned: {},
    horses: Array.from({ length: horses }, (_, i) => ({
      id: 'h' + i,
      name: 'h',
      colors: { body: 'b', mane: 'm', hoof: 'h' },
      decos: {},
      stats: { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 },
      createdAt: 0,
    })),
    energy: 3,
    energyUpdatedAt: 0,
    trophies: [],
    badges: [],
    winStreaks: {},
    items: [],
    raceRecords: [],
    gpUnlocked: { g2: false, g1: false },
    freeRebalance: false,
    coins: 0,
    bets: [],
    maxHorses: 10,
    daily: { day: '2026-1-1', grassBonus: 0, okawari: 0, gp: 0 },
    tasks: { racesFinished: 0, raceBanked: 0, grassSpawns: 0, grassBanked: 0, bank: 0 },
    stats: { betsPlaced: 0, maxPayout: 0, maxRecoveryPct: 0, maxOdds: 0 },
    avatarHorseId: null,
    displayTrophies: [],
    savedAt,
  };
}

const A = 'user-A';
const B = 'user-B';

describe('cloud reconcile', () => {
  it('empty account: seed it from this device (guest import at sign-up)', () => {
    expect(reconcile(null, save(500, 2), null, A)).toEqual({ action: 'pushLocal' });
  });

  it('DATA-LOSS GUARD: guest local WITH progress vs an account → ask (never silent overwrite)', () => {
    const cloud = save(100, 3); // account has real progress, older timestamp
    const local = save(999, 1); // this device's guest data is newer and non-empty
    // owner=null + local has horses → let the player choose; do NOT overwrite.
    expect(reconcile(cloud, local, null, A)).toEqual({ action: 'conflict' });
  });

  it("another account's local WITH progress → conflict (choose, never silent overwrite)", () => {
    expect(reconcile(save(100, 3), save(999, 2), B, A)).toEqual({ action: 'conflict' });
  });

  it('guest local with NO progress → just load the cloud (nothing to lose)', () => {
    expect(reconcile(save(100, 3), save(999, 0), null, A)).toEqual({ action: 'loadCloud' });
  });

  it('same account, cloud newer → load cloud', () => {
    expect(reconcile(save(900), save(100), A, A)).toEqual({ action: 'loadCloud' });
  });

  it('same account, local newer → push local (this device made changes)', () => {
    expect(reconcile(save(100, 1), save(900, 1), A, A)).toEqual({ action: 'keepLocalPushCloud' });
  });

  it('DATA-LOSS GUARD: same account but local emptied vs cloud with progress → load cloud', () => {
    // Even though local looks newer, an emptied local must not wipe a non-empty
    // cloud (lost/cleared storage, a stale tab). Take the cloud.
    expect(reconcile(save(100, 3), save(900, 0), A, A)).toEqual({ action: 'loadCloud' });
  });

  it('same account, equal timestamps → load cloud (no needless write)', () => {
    expect(reconcile(save(500), save(500), A, A)).toEqual({ action: 'loadCloud' });
  });
});

// A push rejected on rev mismatch is always the SAME account (only the owner pushes),
// so it must resolve silently by last-write-wins — never re-open the conflict modal,
// which made two open instances ping-pong "データが食い違っています" forever.
describe('resolvePushConflict (同一アカウントの push 競合は自動解決)', () => {
  it('adopts the cloud when it is newer', () => {
    expect(resolvePushConflict(900, 100)).toBe('adoptCloud');
  });
  it('re-pushes local when it is newer', () => {
    expect(resolvePushConflict(100, 900)).toBe('repushLocal');
  });
  it('re-pushes local on a tie (avoid a needless extra round-trip toward cloud)', () => {
    expect(resolvePushConflict(500, 500)).toBe('repushLocal');
  });
});

// ログイン中の定期保存にも同じ安全網をかける。サインイン時の reconcile だけでは、
// 「ログインしたまま端末側が空になった」ケースで push がバックアップ無しに本体を
// 消してしまう（実際にコインとウマだけ消える事故が起きた経路）。
describe('guardEmptyPush (空の端末セーブでクラウドを潰さない)', () => {
  it('端末が空・クラウドに中身 → 押し上げずクラウドを採用（自己修復）', () => {
    expect(guardEmptyPush(save(900, 0), save(100, 12))).toBe('adoptCloud');
  });
  it('端末の時計が新しくても、空なら押し上げない（last-write-wins に頼らない）', () => {
    expect(guardEmptyPush(save(999_999, 0), save(1, 3))).toBe('adoptCloud');
  });
  it('端末に中身があれば普通に押し上げる', () => {
    expect(guardEmptyPush(save(900, 5), save(100, 12))).toBe('push');
  });
  it('両方が空なら押し上げる（初回・まだ何もしていない人を止めない）', () => {
    expect(guardEmptyPush(save(900, 0), save(100, 0))).toBe('push');
  });
  it('クラウドがまだ無ければ押し上げる（アカウント作成直後）', () => {
    expect(guardEmptyPush(save(900, 0), null)).toBe('push');
  });
});
