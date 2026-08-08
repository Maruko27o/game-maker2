import { describe, it, expect } from 'vitest';
import { TITLES, titleProgress, nextTitles, METRIC_UNIT, type TitleCtx } from '../data/titles';

const ZERO: TitleCtx = {
  races: 0, horsesFound: 0, wins: 0, betsPlaced: 0, maxOdds: 0, maxPayout: 0,
  totalEarned: 0, arenaWins: 0, coins: 0, streakBest: 0, collectPct: 0, gpTop3: 0, gpWins: 0, shopTitles: [],
  luckyBoxTitle: false, goldBoxTitle: false,
};

describe('称号の進み具合', () => {
  it('数えられる称号には metric と goal がそろっている', () => {
    for (const t of TITLES) {
      // 片方だけあるのは書き間違い
      expect(!!t.metric).toBe(!!t.goal);
      if (t.metric) {
        expect(t.goal).toBeGreaterThan(0);
        expect(METRIC_UNIT[t.metric]).toBeTruthy(); // 単位の書き忘れを防ぐ
      }
    }
  });

  it('metric と check の閾値が食い違っていない', () => {
    for (const t of TITLES) {
      if (!t.metric || !t.goal) continue;
      // ちょうど goal に届いたら達成、1つ足りなければ未達成
      expect(t.check({ ...ZERO, [t.metric]: t.goal })).toBe(true);
      expect(t.check({ ...ZERO, [t.metric]: t.goal - 1 })).toBe(false);
    }
  });

  it('進み具合は 0..1 に収まり、達成後も1を超えない', () => {
    const t = TITLES.find((x) => x.id === 'regular')!; // レースを50回走る
    expect(titleProgress(t, { ...ZERO, races: 0 })!.ratio).toBe(0);
    expect(titleProgress(t, { ...ZERO, races: 25 })!.ratio).toBeCloseTo(0.5, 5);
    const done = titleProgress(t, { ...ZERO, races: 9999 })!;
    expect(done.ratio).toBe(1);
    expect(done.left).toBe(0);
  });

  it('運で決まる称号（ボックスの限定）には進み具合が無い', () => {
    for (const id of ['box_lucky_tail', 'box_gold_hoof', 'rookie']) {
      const t = TITLES.find((x) => x.id === id)!;
      expect(titleProgress(t, ZERO)).toBeNull();
    }
  });

  it('「あと少し」は未取得のものだけを、近い順に返す', () => {
    const c: TitleCtx = { ...ZERO, races: 45, wins: 1, horsesFound: 2 };
    const rows = nextTitles(c, 3);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.title.check(c)).toBe(false); // すでに取ったものは出さない
      expect(r.progress.ratio).toBeGreaterThan(0);
    }
    // 近い順
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].progress.ratio).toBeGreaterThanOrEqual(rows[i].progress.ratio);
    }
    // 50レースまであと5 がいちばん近い
    expect(rows[0].title.id).toBe('regular');
    expect(rows[0].progress.left).toBe(5);
  });

  it('何も進んでいない人には出さない（0%は次の目標にならない）', () => {
    expect(nextTitles(ZERO, 3)).toEqual([]);
  });
});
