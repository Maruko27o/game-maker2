import { describe, it, expect } from 'vitest';
import { TITLES, TIER_INFO, activeTitle, earnedTitles, type TitleCtx } from '../data/titles';

const ZERO: TitleCtx = {
  races: 0, horses: 0, wins: 0, betsPlaced: 0, maxOdds: 0, maxPayout: 0,
  coins: 0, streakBest: 0, collectPct: 0, gpTop3: 0, gpWins: 0,
};

describe('称号', () => {
  it('IDが重複していない・段は1..6', () => {
    const ids = new Set(TITLES.map((t) => t.id));
    expect(ids.size).toBe(TITLES.length);
    for (const t of TITLES) {
      expect(t.tier).toBeGreaterThanOrEqual(1);
      expect(t.tier).toBeLessThanOrEqual(6);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.desc.length).toBeGreaterThan(0);
      expect(TIER_INFO[t.tier]).toBeTruthy();
    }
  });

  it('段ごとに同じ数だけある（難しさと見た目の格を揃えるため）', () => {
    const per = new Map<number, number>();
    for (const t of TITLES) per.set(t.tier, (per.get(t.tier) ?? 0) + 1);
    const counts = [...per.values()];
    expect(per.size).toBe(6);
    expect(Math.min(...counts)).toBe(Math.max(...counts));
  });

  it('まっさらな状態では「かけだし」だけ', () => {
    expect(earnedTitles(ZERO)).toEqual(['rookie']);
    expect(activeTitle(null, ZERO).id).toBe('rookie');
  });

  it('未達成の称号は装備できない（達成済みの最上位に落ちる）', () => {
    // 万馬券ハンター(5段)を指定しても、条件を満たしていなければ無視される
    expect(activeTitle('ticket_hunter', ZERO).id).toBe('rookie');
    const rich: TitleCtx = { ...ZERO, maxOdds: 1200 };
    expect(activeTitle('ticket_hunter', rich).id).toBe('ticket_hunter');
  });

  it('未設定なら達成済みで一番上の段が選ばれる', () => {
    const c: TitleCtx = { ...ZERO, maxOdds: 120, horses: 6 };
    const t = activeTitle(null, c);
    expect(t.tier).toBe(3); // ベテラン予想家（100倍以上）
    expect(t.id).toBe('forecaster');
  });

  it('上の段ほど条件が厳しい（倍率でそろえて確認）', () => {
    const oddsTitles = [
      ['longshot', 20], ['forecaster', 100], ['sharp_eye', 500],
      ['ticket_hunter', 1000], ['legend_hit', 5000],
    ] as const;
    let prevTier = 0;
    let prevNeed = 0;
    for (const [id, need] of oddsTitles) {
      const t = TITLES.find((x) => x.id === id)!;
      expect(t.tier).toBeGreaterThan(prevTier);
      expect(need).toBeGreaterThan(prevNeed);
      // ちょうど下回ると取れず、届くと取れる
      expect(t.check({ ...ZERO, maxOdds: need - 1 })).toBe(false);
      expect(t.check({ ...ZERO, maxOdds: need })).toBe(true);
      prevTier = t.tier;
      prevNeed = need;
    }
  });
});
