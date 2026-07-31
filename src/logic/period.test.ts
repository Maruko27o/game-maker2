import { describe, it, expect, vi } from 'vitest';
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

// 「日付が変わるタイミングとランキング更新がズレる」対策の回帰。
// 表示は端末の時計そのままで動く（不正対策の trustedNow は実時刻より遅れることが
// あり、それが原因で更新が来ないように見えていた）。スコアがどの月に入るかは
// サーバの current_period() が決めるので、ここを端末時計にしても不正にならない。
describe('ランキングの更新タイミング（端末の時計に一致する）', () => {
  it('引数を省くと端末の時計（Date.now）で計算する', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(utcFor(2026, 8, 31, 23, 59));
    try {
      expect(monthKey()).toBe('2026-08');
      expect(msToNextMonth()).toBe(60_000); // 日付が変わるまで ちょうど1分
    } finally {
      spy.mockRestore();
    }
  });

  it('JSTの月替わりちょうどで0になり、次の月へ切り替わる', () => {
    expect(msToNextMonth(utcFor(2026, 8, 31, 23, 59) + 60_000)).toBeGreaterThan(0);
    expect(monthKey(utcFor(2026, 8, 31, 23, 59) + 60_000)).toBe('2026-09');
    expect(msToNextMonth(utcFor(2026, 9, 1, 0, 0))).toBe(30 * 86_400_000); // 9月は30日
  });

  it('秒の端数まで日付の変わり目に一致する（0:00ちょうどで繰り上がる）', () => {
    const oneSecBefore = utcFor(2026, 9, 1, 0, 0) - 1000;
    expect(monthKey(oneSecBefore)).toBe('2026-08');
    expect(msToNextMonth(oneSecBefore)).toBe(1000);
  });
});
