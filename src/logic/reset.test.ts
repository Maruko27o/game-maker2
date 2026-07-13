import { describe, it, expect } from 'vitest';
import { lastResetBefore, nextResetAfter, hasSpawn, msUntilNextReset } from './reset';

// Build a local-time timestamp so tests are independent of the runner's TZ.
function local(y: number, m: number, d: number, h: number, min = 0): number {
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

describe('lastResetBefore', () => {
  it('morning (before noon) resolves to today 00:00', () => {
    expect(lastResetBefore(local(2026, 7, 13, 9, 30))).toBe(local(2026, 7, 13, 0));
  });
  it('afternoon resolves to today 12:00', () => {
    expect(lastResetBefore(local(2026, 7, 13, 15, 0))).toBe(local(2026, 7, 13, 12));
  });
  it('exactly noon resolves to 12:00', () => {
    expect(lastResetBefore(local(2026, 7, 13, 12, 0))).toBe(local(2026, 7, 13, 12));
  });
  it('exactly midnight resolves to that 00:00', () => {
    expect(lastResetBefore(local(2026, 7, 13, 0, 0))).toBe(local(2026, 7, 13, 0));
  });
});

describe('nextResetAfter', () => {
  it('morning -> today 12:00', () => {
    expect(nextResetAfter(local(2026, 7, 13, 9, 30))).toBe(local(2026, 7, 13, 12));
  });
  it('afternoon -> tomorrow 00:00', () => {
    expect(nextResetAfter(local(2026, 7, 13, 15, 0))).toBe(local(2026, 7, 14, 0));
  });
  it('crosses month boundary', () => {
    expect(nextResetAfter(local(2026, 7, 31, 20, 0))).toBe(local(2026, 8, 1, 0));
  });
});

describe('hasSpawn', () => {
  it('is true when never spawned', () => {
    expect(hasSpawn(null, local(2026, 7, 13, 10))).toBe(true);
  });
  it('is false right after spawning in the same window', () => {
    const now = local(2026, 7, 13, 13, 0);
    const justSpawned = local(2026, 7, 13, 12, 30);
    expect(hasSpawn(justSpawned, now)).toBe(false);
  });
  it('refills after crossing the noon boundary', () => {
    const spawnedMorning = local(2026, 7, 13, 9, 0);
    expect(hasSpawn(spawnedMorning, local(2026, 7, 13, 12, 1))).toBe(true);
  });
  it('refills after a day rollover (long idle)', () => {
    const spawnedYesterday = local(2026, 7, 10, 20, 0);
    expect(hasSpawn(spawnedYesterday, local(2026, 7, 13, 9, 0))).toBe(true);
  });
  it('spawning at midnight consumes that window', () => {
    const now = local(2026, 7, 13, 5, 0);
    const spawnedAtMidnight = local(2026, 7, 13, 0, 0);
    expect(hasSpawn(spawnedAtMidnight, now)).toBe(false);
  });
});

describe('msUntilNextReset', () => {
  it('counts down to the next boundary', () => {
    const now = local(2026, 7, 13, 11, 0);
    expect(msUntilNextReset(now)).toBe(60 * 60 * 1000); // 1h to noon
  });
});
