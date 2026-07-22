import { describe, it, expect } from 'vitest';
import { monthKey, msToNextMonth, monthLabel, splitCountdown } from './period';

// JST = UTC+9. A given UTC instant maps to a JST calendar month.
const JST = 9 * 3600 * 1000;
const utcFor = (y: number, m1: number, d: number, h = 0, min = 0) =>
  Date.UTC(y, m1 - 1, d, h, min) - JST; // wall-clock JST → UTC ms

describe('monthly period (JST)', () => {
  it('monthKey uses the JST calendar month', () => {
    expect(monthKey(utcFor(2026, 7, 22, 0, 15))).toBe('2026-07');
    expect(monthKey(utcFor(2026, 7, 31, 23, 59))).toBe('2026-07'); // last minute of July JST
    expect(monthKey(utcFor(2026, 8, 1, 0, 0))).toBe('2026-08'); // first minute of August JST
  });

  it('rolls over the year in December → January', () => {
    expect(monthKey(utcFor(2026, 12, 31, 23, 0))).toBe('2026-12');
    expect(monthKey(utcFor(2027, 1, 1, 0, 0))).toBe('2027-01');
  });

  it('msToNextMonth counts down to the 1st 00:00 JST', () => {
    expect(msToNextMonth(utcFor(2026, 7, 31, 23, 0))).toBe(3600000); // 1h left
    expect(msToNextMonth(utcFor(2026, 8, 1, 0, 0))).toBeGreaterThan(0); // just rolled → full month ahead
    // December → next is Jan 1 of next year
    const decTo = msToNextMonth(utcFor(2026, 12, 31, 23, 0));
    expect(decTo).toBe(3600000);
  });

  it('monthLabel and splitCountdown format nicely', () => {
    expect(monthLabel('2026-07')).toBe('2026年7月');
    expect(splitCountdown(0)).toEqual({ days: 0, h: 0, m: 0, s: 0 });
    expect(splitCountdown(-5)).toEqual({ days: 0, h: 0, m: 0, s: 0 });
    expect(splitCountdown(90_061_000)).toEqual({ days: 1, h: 1, m: 1, s: 1 });
  });
});
