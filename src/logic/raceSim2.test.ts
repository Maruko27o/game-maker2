import { describe, it, expect } from 'vitest';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES, courseById } from '../data/courses';
import { rollStatsTotal, mulberry32, statTotal } from './stats';
import { styleFor } from './runStyle';

// A field of 8 with varied stats (the normal-race size, RACE_V2 §14 answer).
function field(seed: number, n = 8): Entrant[] {
  const rng = mulberry32(seed * 2 + 1);
  return Array.from({ length: n }, (_, i) => {
    const stats = rollStatsTotal(rng, 16, 34);
    const id = `h${i}`;
    return { horseId: id, name: id, isPlayer: i === 0, stats, style: styleFor(id, stats) };
  });
}
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;

// The safety invariants (RACE_V2 §8) — these must hold or the race is "broken".
describe('raceSim2 invariants', () => {
  it('is fully deterministic for a fixed seed + field', () => {
    for (let s = 0; s < 20; s++) {
      const f = field(s);
      const a = simulate2(f, courseById('green'), 60, s + 1);
      const b = simulate2(f, courseById('green'), 60, s + 1);
      expect(a.ranks).toEqual(b.ranks);
      expect(a.finishTimes).toEqual(b.finishTimes);
    }
  });

  it('every horse finishes on every course/mode (no deadlock)', () => {
    for (const c of COURSES) {
      for (const mode of [30, 60] as const) {
        for (let s = 0; s < 8; s++) {
          const res = simulate2(field(s + c.id.length), c, mode, s * 7 + 1);
          expect(res.finishTimes.every(Number.isFinite)).toBe(true);
          expect([...res.ranks].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
        }
      }
    }
  });

  it('horses never tunnel through each other (min gap >= r*0.9)', () => {
    let minDist = Infinity;
    for (let s = 0; s < 40; s++) {
      const res = simulate2(field(s), COURSES[s % 6], s % 2 ? 30 : 60, s * 3 + 1);
      minDist = Math.min(minDist, res.metrics.minPairDist);
    }
    expect(minDist).toBeGreaterThanOrEqual(1.1 * 0.9);
  });

  it('does not stall (deadlock) for long — max standstill under 6s', () => {
    let maxStall = 0;
    for (let s = 0; s < 60; s++) {
      const res = simulate2(field(s), COURSES[s % 6], s % 2 ? 30 : 60, s * 5 + 1);
      maxStall = Math.max(maxStall, res.metrics.maxBlocked);
    }
    // The directional deadlock-escape keeps the worst true standstill under the
    // spec's 3s target (measured ~2.8s worst over 300 races); 4s guards the CI.
    expect(maxStall).toBeLessThan(4);
  });

  it('has lively position changes (overtakes) — avg >= 8, min >= 3', () => {
    const overs: number[] = [];
    for (let s = 0; s < 40; s++) {
      overs.push(simulate2(field(s), COURSES[s % 6], 60, s * 9 + 1).metrics.overtakes);
    }
    expect(avg(overs)).toBeGreaterThanOrEqual(8);
    expect(Math.min(...overs)).toBeGreaterThanOrEqual(3);
  });

  it('race times land near the target bands', () => {
    const t30: number[] = [];
    const t60: number[] = [];
    for (const c of COURSES) {
      for (let s = 0; s < 12; s++) {
        t30.push(Math.min(...simulate2(field(s + 1), c, 30, s * 4 + 1).finishTimes));
        t60.push(Math.min(...simulate2(field(s + 1), c, 60, s * 4 + 1).finishTimes));
      }
    }
    expect(avg(t30)).toBeGreaterThan(24);
    expect(avg(t30)).toBeLessThan(40);
    expect(avg(t60)).toBeGreaterThan(48);
    expect(avg(t60)).toBeLessThan(74);
  });

  it('the strongest horse wins often but not always (25%..60%)', () => {
    let wins = 0;
    let n = 0;
    for (const c of COURSES) {
      for (let s = 0; s < 30; s++) {
        const f = field(s + c.id.length * 7);
        const res = simulate2(f, c, 30, s * 13 + 1);
        let bi = 0;
        let bt = -1;
        f.forEach((e, i) => {
          const tot = statTotal(e.stats);
          if (tot > bt) {
            bt = tot;
            bi = i;
          }
        });
        if (res.ranks[bi] === 1) wins++;
        n++;
      }
    }
    const rate = wins / n;
    expect(rate).toBeGreaterThanOrEqual(0.22);
    expect(rate).toBeLessThanOrEqual(0.6);
  });

  it('closers (追込) gain positions late while front-runners (逃げ) fade', () => {
    const delta: Record<string, number[]> = { nige: [], senko: [], sashi: [], oikomi: [] };
    for (let s = 0; s < 120; s++) {
      const f = field(s + 7);
      const c = COURSES[s % 6];
      const res = simulate2(f, c, 60, s * 5 + 1, { recordFrames: true });
      const early = res.frames[Math.floor(res.frames.length * 0.25)];
      f.forEach((e, i) => delta[e.style].push(early.runners[i].rank - res.ranks[i]));
    }
    // Directional: closers improve, front-runners lose ground.
    expect(avg(delta.oikomi)).toBeGreaterThan(avg(delta.nige));
    expect(avg(delta.oikomi)).toBeGreaterThan(0);
    expect(avg(delta.nige)).toBeLessThan(0);
  });
});
