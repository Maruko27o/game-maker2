import { describe, it, expect } from 'vitest';
import { evaluateBadges, type RaceOutcome, type BadgeContext } from './badges';
import type { Badge } from '../types';

const COURSES = ['green', 'dirt', 'trail'];
const base: RaceOutcome = {
  horseId: 'h1',
  rank: 1,
  courseId: 'green',
  isJumpCourse: false,
  flawless: false,
  isNewRecord: false,
};
function ctx(existing: Badge[] = [], priorStreak = 0): BadgeContext {
  return { existing, priorStreak, allCourseIds: COURSES };
}
const ids = (bs: Badge[]) => bs.map((b) => b.id).sort();

describe('badge awarding', () => {
  it('1st gives the placing badge + first-win (once)', () => {
    const r = evaluateBadges(base, ctx());
    expect(ids(r.badges)).toContain('badge_1st');
    expect(ids(r.badges)).toContain('badge_first_win');
    // Already has first_win → not awarded again, but placing still stacks.
    const r2 = evaluateBadges(base, ctx([{ id: 'badge_first_win', horseId: 'h1', at: 1 }]));
    expect(ids(r2.badges)).toEqual(['badge_1st']);
  });

  it('placing badges match rank; 4th+ gives none', () => {
    expect(ids(evaluateBadges({ ...base, rank: 2 }, ctx()).badges)).toEqual(['badge_2nd']);
    expect(ids(evaluateBadges({ ...base, rank: 3 }, ctx()).badges)).toEqual(['badge_3rd']);
    expect(evaluateBadges({ ...base, rank: 5 }, ctx()).badges).toEqual([]);
  });

  it('streak resets on a loss and awards badge_streak3 on the 3rd straight win', () => {
    expect(evaluateBadges(base, ctx([], 2)).newStreak).toBe(3);
    expect(ids(evaluateBadges(base, ctx([{ id: 'badge_first_win', horseId: 'h1', at: 1 }], 2)).badges)).toContain(
      'badge_streak3',
    );
    expect(evaluateBadges({ ...base, rank: 4 }, ctx([], 5)).newStreak).toBe(0);
  });

  it('jump badge needs a flawless 1st on a jump course', () => {
    expect(ids(evaluateBadges({ ...base, isJumpCourse: true, flawless: true }, ctx()).badges)).toContain('badge_jump');
    expect(ids(evaluateBadges({ ...base, isJumpCourse: true, flawless: false }, ctx()).badges)).not.toContain('badge_jump');
  });

  it('record badge on a new personal best (once)', () => {
    expect(ids(evaluateBadges({ ...base, rank: 4, isNewRecord: true }, ctx()).badges)).toEqual(['badge_record']);
    expect(evaluateBadges({ ...base, isNewRecord: true }, ctx([{ id: 'badge_record', horseId: 'h1', at: 1 }])).badges
      .map((b) => b.id)).not.toContain('badge_record');
  });

  it('all-course badge only once every course has a 1st', () => {
    const wonTwo: Badge[] = [
      { id: 'badge_1st', horseId: 'h1', courseId: 'green', at: 1 },
      { id: 'badge_1st', horseId: 'h1', courseId: 'dirt', at: 2 },
      { id: 'badge_first_win', horseId: 'h1', at: 1 },
    ];
    // Winning the last remaining course (trail) completes the set.
    const r = evaluateBadges({ ...base, courseId: 'trail' }, ctx(wonTwo, 0));
    expect(ids(r.badges)).toContain('badge_all_course');
    // Winning a course already won doesn't complete it.
    const r2 = evaluateBadges({ ...base, courseId: 'green' }, ctx(wonTwo, 0));
    expect(ids(r2.badges)).not.toContain('badge_all_course');
  });
});
