import { describe, it, expect } from 'vitest';
import { horseFarmRate, farmRatePerHour, farmAccrued, retireValue } from './farm';
import { FARM_CAP_HOURS, FARM_BASE_PER_HORSE, FARM_PER_STAT, FARM_PER_TROPHY, RETIRE_BASE } from '../data/coins';
import type { Horse, Trophy } from '../types';

const H = (id: string, total: number): Horse => ({
  id, name: id, colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
  stats: { spd: total - 25, sta: 5, pwr: 5, jmp: 5, gut: 5, wit: 5 }, createdAt: 0,
});
const T = (horseId: string): Trophy => ({ id: horseId + Math.random(), horseId, rank: 1, courseId: 'green', mode: 60, grade: 'gp', at: 0 });

describe('farm idle income', () => {
  it('rate rises with total stats and trophies', () => {
    expect(horseFarmRate(40, 0)).toBeCloseTo(FARM_BASE_PER_HORSE + 40 * FARM_PER_STAT);
    expect(horseFarmRate(40, 2)).toBeCloseTo(FARM_BASE_PER_HORSE + 40 * FARM_PER_STAT + 2 * FARM_PER_TROPHY);
    expect(horseFarmRate(48, 0)).toBeGreaterThan(horseFarmRate(40, 0));
  });

  it('sums each horse, counting its own trophies', () => {
    const horses = [H('a', 40), H('b', 48)];
    const trophies = [T('a'), T('b'), T('b')];
    const expected = horseFarmRate(40, 1) + horseFarmRate(48, 2);
    expect(farmRatePerHour(horses, trophies)).toBeCloseTo(expected);
  });

  it('accrues over time and caps at FARM_CAP_HOURS', () => {
    const rate = 100; // coins/hr
    const now = 1_000_000_000_000;
    expect(farmAccrued(now - 3_600_000, now, rate)).toBe(100); // 1h → 100
    expect(farmAccrued(now - 30 * 60 * 1000, now, rate)).toBe(50); // 30min → 50
    // way past the cap → only FARM_CAP_HOURS worth
    expect(farmAccrued(now - 999 * 3_600_000, now, rate)).toBe(FARM_CAP_HOURS * 100);
    expect(farmAccrued(now, now, rate)).toBe(0);
    expect(farmAccrued(now + 5000, now, rate)).toBe(0); // clock skew → never negative
  });
});

describe('retire value (farm-safe)', () => {
  it('a fresh flat-40 horse is worth only the small base (no farm loop)', () => {
    expect(retireValue(40, 0, 0)).toBe(RETIRE_BASE);
  });
  it('rewards training above 40, trophies, and badges', () => {
    expect(retireValue(48, 0, 0)).toBeGreaterThan(retireValue(40, 0, 0)); // trained
    expect(retireValue(40, 3, 0)).toBeGreaterThan(retireValue(40, 0, 0)); // trophies
    expect(retireValue(40, 0, 5)).toBeGreaterThan(retireValue(40, 0, 0)); // badges
    // a maxed, trophied horse is worth several times a fresh one
    expect(retireValue(48, 3, 4)).toBeGreaterThan(retireValue(40, 0, 0) * 3);
  });
});
