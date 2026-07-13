import { describe, it, expect } from 'vitest';
import {
  normalizeEnergy,
  msUntilNextEnergy,
  spendEnergy,
  ENERGY_CAP,
  ENERGY_REGEN_MS as H,
} from './energy';

const T0 = 1_000_000_000_000;

describe('normalizeEnergy', () => {
  it('keeps full energy full and re-anchors to now', () => {
    expect(normalizeEnergy({ energy: 3, energyUpdatedAt: T0 }, T0 + 5 * H)).toEqual({
      energy: 3,
      energyUpdatedAt: T0 + 5 * H,
    });
  });

  it('charges one per elapsed hour', () => {
    expect(normalizeEnergy({ energy: 0, energyUpdatedAt: T0 }, T0 + H).energy).toBe(1);
    expect(normalizeEnergy({ energy: 0, energyUpdatedAt: T0 }, T0 + 2 * H).energy).toBe(2);
  });

  it('caps at 3 even after a long idle', () => {
    expect(normalizeEnergy({ energy: 0, energyUpdatedAt: T0 }, T0 + 99 * H)).toEqual({
      energy: ENERGY_CAP,
      energyUpdatedAt: T0 + 99 * H,
    });
  });

  it('carries partial progress toward the next charge', () => {
    // 90 minutes: +1 energy, 30 min carried
    const n = normalizeEnergy({ energy: 0, energyUpdatedAt: T0 }, T0 + 1.5 * H);
    expect(n.energy).toBe(1);
    expect(n.energyUpdatedAt).toBe(T0 + H); // anchor advanced by exactly 1 hour
  });

  it('does not charge before a full hour', () => {
    expect(normalizeEnergy({ energy: 1, energyUpdatedAt: T0 }, T0 + 59 * 60 * 1000).energy).toBe(1);
  });

  it('handles a backwards clock without losing energy', () => {
    expect(normalizeEnergy({ energy: 2, energyUpdatedAt: T0 }, T0 - H)).toEqual({
      energy: 2,
      energyUpdatedAt: T0,
    });
  });
});

describe('msUntilNextEnergy', () => {
  it('is 0 when full', () => {
    expect(msUntilNextEnergy({ energy: 3, energyUpdatedAt: T0 }, T0 + H)).toBe(0);
  });
  it('counts down within the current hour', () => {
    expect(msUntilNextEnergy({ energy: 1, energyUpdatedAt: T0 }, T0 + 20 * 60 * 1000)).toBe(
      40 * 60 * 1000,
    );
  });
  it('accounts for carried progress', () => {
    // start empty, 1.5h later -> energy 1, 30 min into the next hour, 30 min left
    expect(msUntilNextEnergy({ energy: 0, energyUpdatedAt: T0 }, T0 + 1.5 * H)).toBe(30 * 60 * 1000);
  });
});

describe('spendEnergy', () => {
  it('returns null when empty', () => {
    expect(spendEnergy({ energy: 0, energyUpdatedAt: T0 }, T0)).toBeNull();
  });

  it('spending from full anchors regen to now', () => {
    const s = spendEnergy({ energy: 3, energyUpdatedAt: T0 }, T0 + 5 * H);
    expect(s).toEqual({ energy: 2, energyUpdatedAt: T0 + 5 * H });
  });

  it('spending while charging preserves partial progress', () => {
    // energy 2, 30 min into the next hour
    const now = T0 + 0.5 * H;
    const s = spendEnergy({ energy: 2, energyUpdatedAt: T0 }, now);
    expect(s).toEqual({ energy: 1, energyUpdatedAt: T0 });
    // still 30 min of progress kept
    expect(msUntilNextEnergy(s!, now)).toBe(30 * 60 * 1000);
  });

  it('can be spent down to empty then blocks', () => {
    let s: { energy: number; energyUpdatedAt: number } | null = { energy: 2, energyUpdatedAt: T0 };
    s = spendEnergy(s!, T0);
    s = spendEnergy(s!, T0);
    expect(s).toEqual({ energy: 0, energyUpdatedAt: T0 });
    expect(spendEnergy(s!, T0)).toBeNull();
  });
});
