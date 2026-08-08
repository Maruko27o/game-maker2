import { describe, it, expect } from 'vitest';
import {
  TITLES,
  TIER_INFO,
  activeTitle,
  earnedTitles,
  visibleTitles,
  collapseMasters,
  titleById,
  shopTitleId,
  masterTitleId,
  type TitleCtx,
} from '../data/titles';
import { ANIMALS } from '../data/shop';

const ZERO: TitleCtx = {
  races: 0, horsesFound: 0, wins: 0, betsPlaced: 0, maxOdds: 0, maxPayout: 0,
  totalEarned: 0, arenaWins: 0, coins: 0, streakBest: 0, collectPct: 0, gpTop3: 0, gpWins: 0, shopTitles: [],
  luckyBoxTitle: false, goldBoxTitle: false,
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

  it('まっさらな状態では「駆け出し」だけ', () => {
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

describe('週末ボックスの限定称号', () => {
  it('引き当てるまで出てこない', () => {
    expect(earnedTitles(ZERO)).not.toContain('box_lucky_tail');
    expect(earnedTitles(ZERO)).not.toContain('box_gold_hoof');
    expect(earnedTitles({ ...ZERO, luckyBoxTitle: true })).toContain('box_lucky_tail');
    expect(earnedTitles({ ...ZERO, goldBoxTitle: true })).toContain('box_gold_hoof');
  });

  it('フレームと同じ紋章（ウマの顔）を持つ', () => {
    const lucky = TITLES.find((t) => t.id === 'box_lucky_tail')!;
    const gold = TITLES.find((t) => t.id === 'box_gold_hoof')!;
    expect(lucky.crest).toBe('lucky');
    expect(gold.crest).toBe('gold');
    // 紋章を出すのはこの2つだけ（他の称号に混ざらない）
    expect(TITLES.filter((t) => t.crest).map((t) => t.id).sort()).toEqual(['box_gold_hoof', 'box_lucky_tail']);
  });
});

// ── ショップの称号 ───────────────────────────────────────────
describe('ショップの称号', () => {
  it('10種の動物称号は、当てた動物だけ達成になる', () => {
    const ctx: TitleCtx = { ...ZERO, shopTitles: ['cat', 'frog'] };
    const got = earnedTitles(ctx);
    expect(got).toContain(shopTitleId('cat'));
    expect(got).toContain(shopTitleId('frog'));
    expect(got).not.toContain(shopTitleId('bear'));
  });

  it('コンプリート称号は10種そろって初めて達成になる', () => {
    const nine = ANIMALS.slice(0, ANIMALS.length - 1);
    expect(titleById[masterTitleId('cat')].check({ ...ZERO, shopTitles: [...nine] })).toBe(false);
    expect(titleById[masterTitleId('cat')].check({ ...ZERO, shopTitles: [...ANIMALS] })).toBe(true);
  });

  it('コンプリート称号は動物ちがいで10件あるが、一覧では1件に畳む', () => {
    // 畳まないと、同じ称号が10行ならんで「◯個中◯個」の数まで10倍に狂う。
    const masters = TITLES.filter((t) => t.master);
    expect(masters).toHaveLength(ANIMALS.length);
    for (const a of ANIMALS) {
      const list = visibleTitles(a);
      expect(list.filter((t) => t.master)).toHaveLength(1);
      expect(list.filter((t) => t.master)[0].animal).toBe(a);
      expect(list).toHaveLength(TITLES.length - (ANIMALS.length - 1));
    }
  });

  it('ぜんぶ集めた人の達成数は、畳んだ一覧でも1つぶんだけ増える', () => {
    const before = visibleTitles('cat').filter((t) => t.check({ ...ZERO, shopTitles: [] })).length;
    const after = visibleTitles('cat').filter((t) => t.check({ ...ZERO, shopTitles: [...ANIMALS] })).length;
    // 動物10種 ＋ コンプリート1つ ＝ 11。
    expect(after - before).toBe(ANIMALS.length + 1);
  });

  it('ショップの称号には、左端に出す動物が必ず入っている', () => {
    for (const a of ANIMALS) {
      expect(titleById[shopTitleId(a)].animal).toBe(a);
      expect(titleById[masterTitleId(a)].animal).toBe(a);
    }
  });
});

describe('コンプリート称号の自動えらび', () => {
  const ALL: TitleCtx = { ...ZERO, shopTitles: [...ANIMALS] };

  it('未設定のとき、選んでいる動物のコンプリート称号になる', () => {
    // pick を渡さないと一覧の先頭（ねこ）が選ばれ、「選んだ動物とちがう」ように見える。
    expect(activeTitle(null, ALL, 'penguin').id).toBe(masterTitleId('penguin'));
    expect(activeTitle(null, ALL, 'frog').id).toBe(masterTitleId('frog'));
  });

  it('IDで指定されていれば、その動物のまま出る（他の人の画面でも同じ）', () => {
    expect(activeTitle(masterTitleId('bear'), ALL, 'cat').id).toBe(masterTitleId('bear'));
  });

  it('まだそろっていなければコンプリート称号は選ばれない', () => {
    expect(activeTitle(masterTitleId('bear'), ZERO, 'bear').id).toBe('rookie');
  });
});

describe('コンプリート称号のお知らせ', () => {
  it('10件そろっても、お知らせに出るのは選んだ動物の1件だけ', () => {
    // 10種そろえた瞬間、達成した称号は「コンプリート称号 ×10」になる。
    // そのまま流すと同じお知らせが10回続く。
    const fresh = ANIMALS.map((a) => masterTitleId(a));
    expect(collapseMasters(fresh, 'bear')).toEqual([masterTitleId('bear')]);
  });

  it('ふつうの称号は畳まれない', () => {
    const ids = ['rookie', 'first_win', ...ANIMALS.map((a) => shopTitleId(a))];
    expect(collapseMasters(ids, 'cat')).toEqual(ids);
  });

  it('知らないIDが混ざっていても落とさない（古いセーブ対策）', () => {
    expect(collapseMasters(['rookie', 'no_such_title'], 'cat')).toEqual(['rookie', 'no_such_title']);
  });
});
