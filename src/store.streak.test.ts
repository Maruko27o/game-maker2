import { describe, it, expect } from 'vitest';
import { migrate } from './store';

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
});
