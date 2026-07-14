import { describe, it, expect } from 'vitest';
import { reconcile } from './cloudReconcile';
import type { SaveData } from '../types';

function save(savedAt: number, horses = 0): SaveData {
  return {
    version: 4,
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
    items: [],
    raceRecords: [],
    gpUnlocked: { g2: false, g1: false },
    freeRebalance: false,
    savedAt,
  };
}

const A = 'user-A';
const B = 'user-B';

describe('cloud reconcile', () => {
  it('empty account: seed it from this device (guest import at sign-up)', () => {
    expect(reconcile(null, save(500, 2), null, A)).toEqual({ action: 'pushLocal' });
  });

  it('DATA-LOSS GUARD: guest local (newer) must NOT overwrite an existing account', () => {
    const cloud = save(100, 3); // account has real progress, older timestamp
    const local = save(999, 1); // this device's guest data is newer
    // owner=null means the local data is not this account's → cloud must win.
    expect(reconcile(cloud, local, null, A)).toEqual({ action: 'loadCloud' });
  });

  it("another account's local (newer) must NOT overwrite this account", () => {
    const cloud = save(100, 3);
    const local = save(999, 1);
    expect(reconcile(cloud, local, B, A)).toEqual({ action: 'loadCloud' });
  });

  it('same account, cloud newer → load cloud', () => {
    expect(reconcile(save(900), save(100), A, A)).toEqual({ action: 'loadCloud' });
  });

  it('same account, local newer → push local (this device made changes)', () => {
    expect(reconcile(save(100), save(900), A, A)).toEqual({ action: 'keepLocalPushCloud' });
  });

  it('same account, equal timestamps → load cloud (no needless write)', () => {
    expect(reconcile(save(500), save(500), A, A)).toEqual({ action: 'loadCloud' });
  });
});
