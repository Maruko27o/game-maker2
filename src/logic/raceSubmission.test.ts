import { describe, it, expect } from 'vitest';
import { buildSubmission, reproduce, verify, type RaceSubmission } from './raceSubmission';
import { simulate2, SIM_VERSION, type Entrant } from './raceSim2';
import { COURSES } from '../data/courses';
import { mulberry32, rollStatsForStyle } from './stats';
import { styleFor } from './runStyle';
import type { RunStyle } from '../types';

const STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
function field(seed: number): Entrant[] {
  const rng = mulberry32(seed * 2 + 1);
  return Array.from({ length: 8 }, (_, i) => {
    const style = STYLES[Math.floor(rng() * 4)];
    const stats = rollStatsForStyle(rng, 40 + Math.floor(rng() * 6), style);
    const id = `h${i}`;
    return { horseId: id, name: id, isPlayer: i === 0, stats, style: styleFor(id, stats) };
  });
}

describe('race submission (RACE_V4 §5)', () => {
  it('captures the inputs and the claimed result at the current sim version', () => {
    const f = field(3);
    const res = simulate2(f, COURSES[0], 30, 99);
    const sub = buildSubmission(f, COURSES[0].id, 30, 99, res, f[0].horseId);
    expect(sub.simVersion).toBe(SIM_VERSION);
    expect(sub.runners).toHaveLength(8);
    expect(sub.clientResult.ranks).toEqual([...res.ranks]);
    expect(sub.playerHorseId).toBe('h0');
  });

  it('is server-reproducible: re-simulating the inputs yields the same result', () => {
    for (let s = 0; s < 12; s++) {
      const f = field(s + 1);
      const course = COURSES[s % COURSES.length];
      const res = simulate2(f, course, s % 2 ? 30 : 60, s * 7 + 1);
      const sub = buildSubmission(f, course.id, s % 2 ? 30 : 60, s * 7 + 1, res, f[0].horseId);
      const got = reproduce(sub);
      expect(got.ranks).toEqual(sub.clientResult.ranks);
      expect(got.finishTimesMs).toEqual(sub.clientResult.finishTimesMs);
      expect(verify(sub)).toBe(true);
    }
  });

  it('rejects a tampered result (a faked winner or time does not verify)', () => {
    const f = field(5);
    const res = simulate2(f, COURSES[1], 60, 123);
    const sub = buildSubmission(f, COURSES[1].id, 60, 123, res, f[0].horseId);
    const cheated: RaceSubmission = {
      ...sub,
      clientResult: {
        ...sub.clientResult,
        finishTimesMs: sub.clientResult.finishTimesMs.map((t) => t - 5000), // "ran 5s faster"
      },
    };
    expect(verify(cheated)).toBe(false);
  });

  it('rejects submissions from a different sim version', () => {
    const f = field(7);
    const res = simulate2(f, COURSES[2], 30, 7);
    const sub = buildSubmission(f, COURSES[2].id, 30, 7, res, f[0].horseId);
    expect(verify({ ...sub, simVersion: SIM_VERSION + 1 })).toBe(false);
  });
});
