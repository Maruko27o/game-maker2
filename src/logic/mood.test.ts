import { describe, it, expect } from 'vitest';
import { rollMoods, moodMultipliers, MOODS } from './mood';

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
});
