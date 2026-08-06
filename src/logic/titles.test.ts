import { describe, it, expect } from 'vitest';
import { TITLES, TIER_INFO, activeTitle, earnedTitles, type TitleCtx } from '../data/titles';

const ZERO: TitleCtx = {
  races: 0, horsesFound: 0, wins: 0, betsPlaced: 0, maxOdds: 0, maxPayout: 0,
  totalEarned: 0, arenaWins: 0, coins: 0, streakBest: 0, collectPct: 0, gpTop3: 0, gpWins: 0,
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

  it('どの段にも称号がある（背景の格が使われないまま余らない）', () => {
    // 段ごとの「数」はそろえない（1万戦・10万頭のような長期目標は最上段に集まる）。
    // 揃えるのは難しさ↔段↔背景の対応なので、ここでは各段が空でないことだけを見る。
    const per = new Map<number, number>();
    for (const t of TITLES) per.set(t.tier, (per.get(t.tier) ?? 0) + 1);
    expect(per.size).toBe(6);
    for (const tier of [1, 2, 3, 4, 5, 6]) expect(per.get(tier) ?? 0).toBeGreaterThan(0);
  });

  it('同じ種類の条件は「厳しいほど上の段」になっている', () => {
    // 種類ごとに（しきい値, 段）を並べ、しきい値が増えるとき段が下がらないことを見る。
    // ここが逆転すると「簡単なのに派手」が生まれて称号の意味が失われる。
    const ladders: Array<[string, Array<[string, number]>]> = [
      ['見つけた数', [
        ['horse_lover', 5], ['rancher', 25], ['big_rancher', 100], ['plains_lord', 500],
        ['ranch_king', 1000], ['pioneer_5000', 5000], ['lord_10000', 10_000],
        ['ruler_50000', 50_000], ['legend_100000', 100_000],
      ]],
      ['レース数', [
        ['regular', 50], ['veteran', 300], ['turf_dweller', 500],
        ['thousand_runs', 1000], ['brave_5000', 5000], ['iron_runner', 10_000],
      ]],
      ['1着の数', [
        ['first_win', 1], ['many_wins', 50], ['century_win', 100],
        ['five_hundred_wins', 500], ['thousand_wins', 1000],
      ]],
      ['払戻', [['lucky_hand', 500_000], ['jackpot', 1_000_000]]],
      ['対戦の優勝', [
        ['arena_first_win', 1], ['arena_ten_wins', 10], ['arena_25_wins', 25],
        ['arena_50_wins', 50], ['arena_100_wins', 100],
      ]],
      ['総獲得賞金', [
        ['millionaire', 1_000_000], ['multi_millionaire', 10_000_000],
        ['mega_millionaire', 50_000_000], ['okuman', 100_000_000],
        ['billionaire', 1_000_000_000], ['gold_emperor', 10_000_000_000],
      ]],
    ];
    for (const [, rungs] of ladders) {
      let prevTier = 0;
      let prevNeed = 0;
      for (const [id, need] of rungs) {
        const t = TITLES.find((x) => x.id === id)!;
        expect(need).toBeGreaterThan(prevNeed);
        expect(t.tier).toBeGreaterThanOrEqual(prevTier);
        prevTier = t.tier;
        prevNeed = need;
      }
    }
  });

  it('見つけた数の称号は「ちょうど届くと取れる」', () => {
    const rungs: Array<[string, number]> = [
      ['horse_lover', 5], ['rancher', 25], ['big_rancher', 100], ['plains_lord', 500],
      ['ranch_king', 1000], ['pioneer_5000', 5000], ['lord_10000', 10_000],
      ['ruler_50000', 50_000], ['legend_100000', 100_000],
    ];
    for (const [id, need] of rungs) {
      const t = TITLES.find((x) => x.id === id)!;
      expect(t.check({ ...ZERO, horsesFound: need - 1 })).toBe(false);
      expect(t.check({ ...ZERO, horsesFound: need })).toBe(true);
    }
  });

  it('総獲得賞金の称号は1段ずつ上がる（100万→100億で★1→★6）', () => {
    const rungs: Array<[string, number, number]> = [
      ['millionaire', 1_000_000, 1], ['multi_millionaire', 10_000_000, 2],
      ['mega_millionaire', 50_000_000, 3], ['okuman', 100_000_000, 4],
      ['billionaire', 1_000_000_000, 5], ['gold_emperor', 10_000_000_000, 6],
    ];
    for (const [id, need, tier] of rungs) {
      const t = TITLES.find((x) => x.id === id)!;
      expect(t.tier).toBe(tier);
      expect(t.check({ ...ZERO, totalEarned: need - 1 })).toBe(false);
      expect(t.check({ ...ZERO, totalEarned: need })).toBe(true);
    }
  });

  it('対戦の優勝の称号は★1〜★5で1段ずつ上がる', () => {
    const rungs: Array<[string, number, number]> = [
      ['arena_first_win', 1, 1], ['arena_ten_wins', 10, 2], ['arena_25_wins', 25, 3],
      ['arena_50_wins', 50, 4], ['arena_100_wins', 100, 5],
    ];
    for (const [id, need, tier] of rungs) {
      const t = TITLES.find((x) => x.id === id)!;
      expect(t.tier).toBe(tier);
      expect(t.check({ ...ZERO, arenaWins: need - 1 })).toBe(false);
      expect(t.check({ ...ZERO, arenaWins: need })).toBe(true);
    }
  });

  it('一攫千金は100万払戻から（50万は豪運の持ち主）', () => {
    const jackpot = TITLES.find((t) => t.id === 'jackpot')!;
    const lucky = TITLES.find((t) => t.id === 'lucky_hand')!;
    expect(jackpot.check({ ...ZERO, maxPayout: 999_999 })).toBe(false);
    expect(jackpot.check({ ...ZERO, maxPayout: 1_000_000 })).toBe(true);
    expect(lucky.check({ ...ZERO, maxPayout: 500_000 })).toBe(true);
    expect(lucky.tier).toBe(5);
    expect(jackpot.tier).toBe(6);
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
    const c: TitleCtx = { ...ZERO, maxOdds: 120, horsesFound: 6 };
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
