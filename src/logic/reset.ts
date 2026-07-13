// Grass reset logic (CLAUDE.md §5.1). The grass refills at 00:00 and 12:00 local
// time, giving exactly one spawn slot (never stacks). Availability is decided by
// comparing timestamps — never by a running timer — so it survives the app being
// closed, day rollovers, restarts and long idle periods.

/** Most recent reset instant at or before `now` (local 00:00 or 12:00), as ms. */
export function lastResetBefore(now: number): number {
  const d = new Date(now);
  const hour = d.getHours();
  const boundaryHour = hour >= 12 ? 12 : 0;
  const reset = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    boundaryHour,
    0,
    0,
    0,
  );
  return reset.getTime();
}

/** First reset instant strictly after `now` (local 00:00 or 12:00), as ms. */
export function nextResetAfter(now: number): number {
  const d = new Date(now);
  const hour = d.getHours();
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  if (hour < 12) {
    next.setHours(12);
  } else {
    next.setDate(next.getDate() + 1); // tomorrow 00:00
  }
  return next.getTime();
}

/** A spawn is available when the last spawn happened before the current window. */
export function hasSpawn(lastSpawnAt: number | null, now: number): boolean {
  if (lastSpawnAt == null) return true;
  return lastSpawnAt < lastResetBefore(now);
}

/** Milliseconds remaining until the next reset (for the countdown display). */
export function msUntilNextReset(now: number): number {
  return nextResetAfter(now) - now;
}
