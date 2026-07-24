import { describe, it, expect } from 'vitest';
import {
  foldRace,
  achievedLevel,
  claimable,
  currentLevel,
  progress,
  pendingCount,
  ownedLevels,
  type StreakState,
} from './streak';

const fresh: StreakState = { soloStreak: 0, streakBest: 0, streakClaimed: 0 };

// 連勝を n 回積む（すべて勝ち）。
function winN(s: StreakState, n: number): StreakState {
  let cur = s;
  for (let i = 0; i < n; i++) cur = foldRace(cur, true);
  return cur;
}

describe('foldRace (連勝の積み上げ／リセット)', () => {
  it('a win increments the streak and raises the best', () => {
    const s = foldRace(fresh, true);
    expect(s.soloStreak).toBe(1);
    expect(s.streakBest).toBe(1);
  });
  it('a loss resets the current streak but keeps the best', () => {
    const s3 = winN(fresh, 3);
    const lost = foldRace(s3, false);
    expect(lost.soloStreak).toBe(0);
    expect(lost.streakBest).toBe(3); // 到達済みは保持
  });
  it('rebuilding after a loss continues from 0 up to a new best', () => {
    let s = winN(fresh, 3);
    s = foldRace(s, false);
    s = winN(s, 4);
    expect(s.soloStreak).toBe(4);
    expect(s.streakBest).toBe(4);
  });
});

describe('claim queue (受け取りキュー)', () => {
  it('reaching 3 without claiming makes levels 1..3 claimable, one at a time', () => {
    const s = winN(fresh, 3);
    expect(achievedLevel(s)).toBe(3);
    expect(pendingCount(s)).toBe(3);
    expect(claimable(s)).toBe(true);
    expect(currentLevel(s)).toBe(1); // 最初に出るのは Lv1
  });
  it('claiming advances to the next achieved level, then to the in-progress one', () => {
    let s = winN(fresh, 3); // 1,2,3 達成
    // Lv1 受け取り
    s = { ...s, streakClaimed: 1 };
    expect(currentLevel(s)).toBe(2);
    expect(claimable(s)).toBe(true);
    // Lv2 受け取り
    s = { ...s, streakClaimed: 2 };
    expect(currentLevel(s)).toBe(3);
    expect(claimable(s)).toBe(true);
    // Lv3 受け取り → 次は未達成の Lv4（進行中・受け取り不可）
    s = { ...s, streakClaimed: 3 };
    expect(currentLevel(s)).toBe(4);
    expect(claimable(s)).toBe(false);
  });
  it('achieved-but-unclaimed rewards survive a losing streak', () => {
    let s = winN(fresh, 3);
    s = { ...s, streakClaimed: 1 }; // Lv1 受け取り済み
    s = foldRace(s, false); // 連勝リセット
    expect(claimable(s)).toBe(true); // Lv2,3 はまだ受け取れる
    expect(pendingCount(s)).toBe(2);
    expect(currentLevel(s)).toBe(2);
  });
});

describe('progress (進行中バーの割合)', () => {
  it('is full for an already-achieved level and partial for the next one', () => {
    const s = winN(fresh, 2); // best=2
    expect(progress(s, 1)).toBe(1);
    expect(progress(s, 2)).toBe(1);
    expect(progress(s, 3)).toBeCloseTo(2 / 3, 5); // soloStreak 2 / 対象3
  });
  it('progress toward the next level uses the current (resettable) streak', () => {
    let s = winN(fresh, 3);
    s = foldRace(s, false); // soloStreak 0, best 3
    s = { ...s, streakClaimed: 3 }; // 1..3 受け取り済み、次は Lv4
    expect(progress(s, 4)).toBe(0); // 連勝が切れたので 0 からやり直し
  });
});

describe('level cap at 10', () => {
  it('caps achieved level and ends the queue after 10', () => {
    const s = winN(fresh, 15);
    expect(achievedLevel(s)).toBe(10);
    const all = { ...s, streakClaimed: 10 };
    expect(currentLevel(all)).toBeNull();
    expect(claimable(all)).toBe(false);
    expect(ownedLevels(all)).toHaveLength(10);
  });
});
