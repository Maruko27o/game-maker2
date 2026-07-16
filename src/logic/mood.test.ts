import { describe, it, expect } from 'vitest';
import { rollMoods, moodMultipliers, assignMoods, MOODS } from './mood';

describe('mood', () => {
  it('rolls 5 levels deterministically per seed', () => {
    const a = rollMoods(1234, 8);
    const b = rollMoods(1234, 8);
    expect(a).toEqual(b); // same seed → same moods
    expect(a.length).toBe(8);
    for (const l of a) expect(l).toBeGreaterThanOrEqual(0), expect(l).toBeLessThanOrEqual(4);
    expect(rollMoods(1234, 8)).not.toEqual(rollMoods(5678, 8)); // different seeds differ
  });

  it('maps levels to symmetric performance multipliers around 1', () => {
    const mid = MOODS[2].mult;
    expect(mid).toBe(1);
    expect(MOODS[4].mult).toBeGreaterThan(1); // 絶好調 boosts
    expect(MOODS[0].mult).toBeLessThan(1); // 絶不調 hurts
    // symmetric-ish
    expect(MOODS[4].mult - 1).toBeCloseTo(1 - MOODS[0].mult, 2);
    expect(moodMultipliers([0, 2, 4])).toEqual([MOODS[0].mult, 1, MOODS[4].mult]);
  });

  it('assignMoods leans weak horses toward good form (no hopeless 大穴)', () => {
    // strengths ascending in index: horse 0 weakest … horse 7 strongest.
    const strengths = [0.02, 0.05, 0.08, 0.11, 0.14, 0.17, 0.2, 0.23];
    let weakAvg = 0, strongAvg = 0;
    const T = 40;
    for (let s = 0; s < T; s++) {
      const m = assignMoods(strengths, s + 1);
      expect(m.length).toBe(8);
      weakAvg += m[0]; // weakest
      strongAvg += m[7]; // strongest
    }
    // over many seeds the weakest horse averages a clearly better mood than the strongest
    expect(weakAvg / T).toBeGreaterThan(strongAvg / T + 1);
  });
});
