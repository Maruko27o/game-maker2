import { afterEach, describe, expect, it, vi } from 'vitest';
import { trustedNow, anchorServerTime, __resetTrustedClockForTest } from './trustedClock';

afterEach(() => {
  vi.restoreAllMocks();
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
  __resetTrustedClockForTest();
});

describe('trustedClock', () => {
  it('サーバでアンカーすれば、端末時計を大きく進めても現在時刻は動じない', () => {
    __resetTrustedClockForTest(1_000_000_000_000);
    const serverT = Date.UTC(2026, 6, 24, 3, 0, 0); // 実サーバ時刻
    anchorServerTime(serverT);

    // 端末時計を10時間先へ改変しても……
    vi.spyOn(Date, 'now').mockReturnValue(serverT + 10 * 3600_000);
    const t = trustedNow();

    // trustedNow はサーバ基準＋実経過（performance.now ぶん、ほぼ0）にとどまる。
    expect(Math.abs(t - serverT)).toBeLessThan(5_000);
  });

  it('端末時計を巻き戻しても、単調フロアで戻らない', () => {
    __resetTrustedClockForTest(Date.UTC(2026, 6, 24, 3, 0, 0));
    const first = trustedNow();
    // 時計を1時間巻き戻す
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 6, 24, 2, 0, 0));
    const second = trustedNow();
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('異常なサーバ値（2024年より前）は無視する', () => {
    __resetTrustedClockForTest(Date.UTC(2026, 6, 24, 3, 0, 0));
    const before = trustedNow();
    anchorServerTime(0); // epoch 0 — 無視されるべき
    const after = trustedNow();
    // アンカーされていないので、以前の水準を保つ（0付近に落ちない）。
    expect(after).toBeGreaterThan(before - 5_000);
    expect(after).toBeGreaterThan(Date.UTC(2026, 0, 1));
  });
});
