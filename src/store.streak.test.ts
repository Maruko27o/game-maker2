import { describe, it, expect, beforeEach } from 'vitest';
import { migrate, useStore } from './store';

// 連勝チャレンジの進捗（soloStreak / streakBest / streakClaimed）が、保存→再読込
// （タスキル相当）で失われないことを保証する回帰テスト。#バグ: migrate がこれらを
// コピーしておらず、再起動で獲得フレームが消えていた。
function baseSave(extra: Record<string, unknown> = {}) {
  return {
    version: 6,
    owned: { body_bay: 1 },
    horses: [],
    savedAt: 123,
    ...extra,
  };
}

describe('migrate: スペシャルタスク連勝の永続化', () => {
  it('preserves soloStreak / streakBest / streakClaimed across a save round-trip', () => {
    const res = migrate(baseSave({ soloStreak: 3, streakBest: 6, streakClaimed: 4 }));
    expect(res).not.toBeNull();
    expect(res!.data.soloStreak).toBe(3);
    expect(res!.data.streakBest).toBe(6);
    expect(res!.data.streakClaimed).toBe(4);
  });

  it('defaults to 0 when absent (older saves)', () => {
    const res = migrate(baseSave());
    expect(res!.data.soloStreak).toBe(0);
    expect(res!.data.streakBest).toBe(0);
    expect(res!.data.streakClaimed).toBe(0);
  });

  it('clamps streakClaimed to at most 10 and ignores bad values', () => {
    const res = migrate(baseSave({ streakClaimed: 99, streakBest: -5, soloStreak: 'x' }));
    expect(res!.data.streakClaimed).toBe(10);
    expect(res!.data.streakBest).toBe(0);
    expect(res!.data.soloStreak).toBe(0);
  });

  it('round-trips the streakRuleResetDone flag', () => {
    expect(migrate(baseSave({ streakRuleResetDone: true }))!.data.streakRuleResetDone).toBe(true);
    expect(migrate(baseSave())!.data.streakRuleResetDone).toBe(false);
  });
});

describe('resetStreakForRuleChange (1.5倍ルール移行の一度きりリセット)', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('clears streak progress and equipped streak frame, exactly once', () => {
    // 旧条件で貯めた状態を用意
    useStore.setState({ soloStreak: 4, streakBest: 10, streakClaimed: 10, equippedFrame: { kind: 'streak', level: 10 }, streakRuleResetDone: false });
    expect(useStore.getState().resetStreakForRuleChange()).toBe(true);
    const s = useStore.getState();
    expect(s.soloStreak).toBe(0);
    expect(s.streakBest).toBe(0);
    expect(s.streakClaimed).toBe(0);
    expect(s.equippedFrame).toBeNull();
    expect(s.streakRuleResetDone).toBe(true);
    // 二度目は何もしない
    expect(useStore.getState().resetStreakForRuleChange()).toBe(false);
  });

  it('keeps a non-streak (殿堂) equipped frame when resetting', () => {
    useStore.setState({ streakBest: 5, streakClaimed: 5, equippedFrame: { period: '2026-07', rank: 1, metric: 'payout' }, streakRuleResetDone: false });
    useStore.getState().resetStreakForRuleChange();
    expect(useStore.getState().equippedFrame).toEqual({ period: '2026-07', rank: 1, metric: 'payout' });
    expect(useStore.getState().streakClaimed).toBe(0);
  });
});
