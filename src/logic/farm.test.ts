import { describe, it, expect } from 'vitest';
import { horseFarmRate, farmRatePerHour, farmAccrued, retireValue, retireValueOf } from './farm';
import { FARM_CAP_HOURS, FARM_BASE_PER_HORSE, FARM_PER_STAT, FARM_TROPHY_RATE, FARM_BADGE_RATE, FARM_PER_HORSE_CAP, RETIRE_BASE } from '../data/coins';
import type { Horse, Trophy, Badge } from '../types';

const H = (id: string, total: number): Horse => ({
  id, name: id, colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
  stats: { spd: total - 25, sta: 5, pwr: 5, jmp: 5, gut: 5, wit: 5 }, createdAt: 0,
});
const T = (horseId: string, rank: 1 | 2 | 3 = 1): Trophy => ({ id: horseId + Math.random(), horseId, rank, courseId: 'green', mode: 60, grade: 'gp', at: 0 });
const B = (horseId: string, id: string): Badge => ({ id, horseId, at: 0 });

describe('farm idle income', () => {
  it('base rises with total stats only', () => {
    expect(horseFarmRate(40, [], [])).toBeCloseTo(FARM_BASE_PER_HORSE + 40 * FARM_PER_STAT);
    expect(horseFarmRate(48, [], [])).toBeGreaterThan(horseFarmRate(40, [], []));
  });

  it('adds each trophy by rank × count (gold 50 / silver 20 / bronze 10)', () => {
    const base = FARM_BASE_PER_HORSE + 40 * FARM_PER_STAT;
    expect(horseFarmRate(40, [T('a', 1), T('a', 1)], [])).toBeCloseTo(base + 2 * FARM_TROPHY_RATE[1]);
    expect(horseFarmRate(40, [T('a', 2)], [])).toBeCloseTo(base + FARM_TROPHY_RATE[2]);
    expect(horseFarmRate(40, [T('a', 3)], [])).toBeCloseTo(base + FARM_TROPHY_RATE[3]);
  });

  it('adds placing badges by rank × count; ignores achievement badges', () => {
    const base = FARM_BASE_PER_HORSE + 40 * FARM_PER_STAT;
    expect(horseFarmRate(40, [], [B('a', 'badge_1st'), B('a', 'badge_1st')])).toBeCloseTo(base + 2 * FARM_BADGE_RATE.badge_1st);
    expect(horseFarmRate(40, [], [B('a', 'badge_2nd'), B('a', 'badge_3rd')])).toBeCloseTo(base + FARM_BADGE_RATE.badge_2nd + FARM_BADGE_RATE.badge_3rd);
    // achievement badges (first_win 等) add nothing
    expect(horseFarmRate(40, [], [B('a', 'badge_first_win')])).toBeCloseTo(base);
  });

  it('caps a single horse at FARM_PER_HORSE_CAP per hour', () => {
    const goldPile = Array.from({ length: 40 }, () => T('a', 1)); // 40×50 = 2000 > cap
    expect(horseFarmRate(48, goldPile, [])).toBe(FARM_PER_HORSE_CAP);
  });

  it('sums each horse, counting its own trophies and badges', () => {
    const horses = [H('a', 40), H('b', 48)];
    const trophies = [T('a', 1), T('b', 2), T('b', 3)];
    const badges = [B('a', 'badge_1st'), B('b', 'badge_2nd')];
    const expected =
      horseFarmRate(40, [T('a', 1)], [B('a', 'badge_1st')]) +
      horseFarmRate(48, [T('b', 2), T('b', 3)], [B('b', 'badge_2nd')]);
    expect(farmRatePerHour(horses, trophies, badges)).toBeCloseTo(expected);
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

  it('a free (0→1) horse retires without the base — closes make-free→retire loop', () => {
    const fresh = H('a', 40);
    const free = { ...H('b', 40), free: true };
    expect(retireValueOf(fresh, [], [])).toBe(RETIRE_BASE); // paid horse → full base
    expect(retireValueOf(free, [], [])).toBe(0); // free fresh horse → nothing (no farm)
    // but a free horse you invested in still pays out its investment
    const freeTrophied = { ...H('c', 48), free: true };
    expect(retireValueOf(freeTrophied, [T('c'), T('c')], [])).toBeGreaterThan(0);
  });
});
