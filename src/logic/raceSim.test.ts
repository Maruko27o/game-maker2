import { describe, it, expect } from 'vitest';
import { simulate, type Entrant } from './raceSim';
import { COURSES, courseById } from '../data/courses';
import { rollStatsTotal, mulberry32, statTotal } from './stats';
import type { Stats } from '../types';

function field(seed: number, total = 24): Entrant[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 6 }, (_, i) => ({
    horseId: `h${i}`,
    name: `h${i}`,
    isPlayer: i === 0,
    stats: rollStatsTotal(rng, total - 4, total + 4),
  }));
}

describe('simulate', () => {
  it('is deterministic for a fixed seed and field', () => {
    const e = field(1);
    const a = simulate(e, courseById('green'), 400, 12345);
    const b = simulate(e, courseById('green'), 400, 12345);
    expect(a.ranks).toEqual(b.ranks);
    expect(a.finishTimes).toEqual(b.finishTimes);
    expect(a.frames.length).toBe(b.frames.length);
  });

  it('every runner finishes and gets a unique rank', () => {
    const res = simulate(field(2), courseById('green'), 400, 7);
    expect(res.finishTimes.every((t) => Number.isFinite(t))).toBe(true);
    expect([...res.ranks].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('final positions all reach the finish distance', () => {
    const res = simulate(field(3), courseById('dirt'), 400, 99);
    const last = res.frames[res.frames.length - 1];
    for (const r of last.runners) expect(r.pos).toBeGreaterThanOrEqual(400 - 1);
  });

  it('stronger stats tend to beat much weaker ones', () => {
    const strong: Stats = { spd: 10, sta: 10, pwr: 8, jmp: 8, gut: 6, wit: 6 };
    const weak: Stats = { spd: 2, sta: 2, pwr: 2, jmp: 1, gut: 1, wit: 1 };
    let strongWins = 0;
    for (let s = 0; s < 20; s++) {
      const e: Entrant[] = [
        { horseId: 'A', name: 'A', isPlayer: true, stats: strong },
        { horseId: 'B', name: 'B', isPlayer: false, stats: weak },
      ];
      const res = simulate(e, courseById('green'), 400, s + 1);
      if (res.ranks[0] === 1) strongWins++;
    }
    expect(strongWins).toBeGreaterThanOrEqual(19);
  });

  it('low stamina causes a tired state on a stamina-sapping course', () => {
    const drainer: Stats = { spd: 10, sta: 0, pwr: 2, jmp: 2, gut: 0, wit: 0 };
    const e: Entrant[] = [{ horseId: 'x', name: 'x', isPlayer: true, stats: drainer }];
    const res = simulate(e, courseById('sand'), 720, 5);
    const everTired = res.frames.some((f) => f.runners[0].state === 'tired');
    expect(everTired).toBe(true);
  });

  it('CPU stat bands stay within range', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 100; i++) {
      const s = rollStatsTotal(rng, 32, 44);
      expect(statTotal(s)).toBeGreaterThanOrEqual(32);
      expect(statTotal(s)).toBeLessThanOrEqual(44);
    }
  });

  it('all six courses produce a finishable race', () => {
    for (const c of COURSES) {
      const res = simulate(field(4), c, c.distance30, 3);
      expect(res.ranks.filter((r) => r === 1).length).toBe(1);
    }
  });
});
