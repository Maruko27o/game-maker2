import { describe, it, expect } from 'vitest';
import { horseFarmRate, farmRatePerHour, farmAccrued, retireValue, retireValueOf, teamHorses } from './farm';
import { FARM_CAP_HOURS, FARM_BASE_PER_HORSE, FARM_PER_STAT, FARM_TROPHY_RATE, FARM_BADGE_RATE, FARM_PER_HORSE_CAP, RETIRE_BASE, RETIRE_BASE_GEN2, GRASS_OKAWARI_COST } from '../data/coins';
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

describe('teamHorses（牧場収入・出走の対象を取り出す）', () => {
  const horses = [H('a', 40), H('b', 41), H('c', 42), H('d', 43)];

  it('team の並び順・実在するIDだけを最大 size 頭返す', () => {
    expect(teamHorses(horses, ['c', 'a'], 6).map((h) => h.id)).toEqual(['c', 'a']);
    // 実在しないIDは無視
    expect(teamHorses(horses, ['a', 'zzz', 'b'], 6).map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('size で頭打ちにする（旧来の収入上限を超えない）', () => {
    expect(teamHorses(horses, ['a', 'b', 'c', 'd'], 2).map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('team が空/未定義なら所持ウマの先頭 size 頭にフォールバック', () => {
    expect(teamHorses(horses, [], 3).map((h) => h.id)).toEqual(['a', 'b', 'c']);
    expect(teamHorses(horses, undefined, 3).map((h) => h.id)).toEqual(['a', 'b', 'c']);
  });

  it('フォールバックでも size 頭までしか数えない', () => {
    const many = Array.from({ length: 10 }, (_, i) => H(`h${i}`, 40));
    expect(teamHorses(many, undefined, 6)).toHaveLength(6);
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

  it('新世代(gen2)はベースが小さく、おかわり(300)→引退の荒稼ぎが黒字にならない', () => {
    const legacy = H('a', 40);
    const gen2 = { ...H('b', 40), gen2: true };
    expect(retireValueOf(legacy, [], [])).toBe(RETIRE_BASE); // 既存ウマは据え置き
    expect(retireValueOf(gen2, [], [])).toBe(RETIRE_BASE_GEN2); // 新世代は50
    expect(retireValueOf(gen2, [], [])).toBeLessThan(GRASS_OKAWARI_COST); // 50 < 300
    // 育てた分・トロフィー・バッジの加算は据え置き（投資した馬の価値は保たれる）
    const trained = { ...H('c', 48), gen2: true };
    expect(retireValueOf(trained, [T('c')], [])).toBeGreaterThan(retireValueOf(gen2, [], []));
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
