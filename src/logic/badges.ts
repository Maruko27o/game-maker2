// Badge awarding for everyday single races (ACCOUNT.md §2). Pure & testable:
// given the race outcome and the horse's history, return the badges to add and
// the horse's new win streak. Placing badges stack; achievements are once-only.
import type { Badge } from '../types';
import type { BadgeId } from '../data/badges';

export type RaceOutcome = {
  horseId: string;
  rank: number;
  courseId: string;
  isJumpCourse: boolean;
  flawless: boolean; // finished the jump course without a stumble
  isNewRecord: boolean; // beat this horse's own best time on this course+mode
};

export type BadgeContext = {
  existing: Badge[]; // this horse's current badges
  priorStreak: number; // consecutive 1st finishes before this race
  allCourseIds: string[]; // every course in the game
};

const PLACING: Record<number, BadgeId> = { 1: 'badge_1st', 2: 'badge_2nd', 3: 'badge_3rd' };

function mk(id: BadgeId, horseId: string, courseId?: string): Badge {
  return { id, horseId, courseId, at: Date.now() };
}

/** Compute newly-earned badges + the updated win streak for a finished race. */
export function evaluateBadges(o: RaceOutcome, ctx: BadgeContext): { badges: Badge[]; newStreak: number } {
  const newStreak = o.rank === 1 ? ctx.priorStreak + 1 : 0;
  const out: Badge[] = [];
  const has = (id: BadgeId) => ctx.existing.some((b) => b.id === id);

  // Placing badge (stacks every race).
  if (PLACING[o.rank]) out.push(mk(PLACING[o.rank], o.horseId, o.courseId));

  // Achievements — each awarded at most once per horse.
  if (o.rank === 1 && !has('badge_first_win')) out.push(mk('badge_first_win', o.horseId));
  if (newStreak >= 3 && !has('badge_streak3')) out.push(mk('badge_streak3', o.horseId));
  if (o.rank === 1 && o.isJumpCourse && o.flawless && !has('badge_jump')) {
    out.push(mk('badge_jump', o.horseId, o.courseId));
  }
  if (o.isNewRecord && !has('badge_record')) out.push(mk('badge_record', o.horseId, o.courseId));

  // Course conquest: won 1st on every course (count this win + prior wins).
  if (o.rank === 1 && !has('badge_all_course')) {
    const won = new Set<string>([o.courseId]);
    for (const b of ctx.existing) if (b.id === 'badge_1st' && b.courseId) won.add(b.courseId);
    if (ctx.allCourseIds.every((id) => won.has(id))) out.push(mk('badge_all_course', o.horseId));
  }

  return { badges: out, newStreak };
}
