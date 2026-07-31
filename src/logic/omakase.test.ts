import { describe, it, expect } from 'vitest';
import { fillPicks } from './omakase';
import { mulberry32 } from './stats';

const ALL = [0, 1, 2, 3, 4, 5, 6, 7];

describe('fillPicks（おまかせの買い目）', () => {
  it('選んだウマは必ず入る（3連単）', () => {
    for (let seed = 0; seed < 200; seed++) {
      const picks = fillPicks([5], ALL, 3, mulberry32(seed));
      expect(picks).toHaveLength(3);
      expect(picks).toContain(5);
      expect(new Set(picks).size).toBe(3); // 重複しない
    }
  });

  it('3連単は選んだ順がそのまま着順（先頭に残る）', () => {
    const picks = fillPicks([5, 2], ALL, 3, mulberry32(1));
    expect(picks[0]).toBe(5);
    expect(picks[1]).toBe(2);
    expect(picks).toHaveLength(3);
  });

  it('単勝で1頭選んでいれば、そのウマの単勝で確定する', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(fillPicks([3], ALL, 1, mulberry32(seed))).toEqual([3]);
    }
  });

  it('馬連・ワイドも選んだウマを含む2頭になる', () => {
    for (let seed = 0; seed < 100; seed++) {
      const picks = fillPicks([7], ALL, 2, mulberry32(seed));
      expect(picks).toHaveLength(2);
      expect(picks[0]).toBe(7);
      expect(picks[1]).not.toBe(7);
    }
  });

  it('何も選んでいなければ全部ランダム（毎回同じにならない）', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const picks = fillPicks([], ALL, 3, mulberry32(seed));
      expect(picks).toHaveLength(3);
      expect(new Set(picks).size).toBe(3);
      seen.add(picks.join(','));
    }
    expect(seen.size).toBeGreaterThan(20);
  });

  it('必要数ぶん選び終えていれば、そのまま買い目になる', () => {
    expect(fillPicks([1, 2, 3], ALL, 3, mulberry32(9))).toEqual([1, 2, 3]);
  });

  it('出走していない番号は無視して埋め直す', () => {
    const picks = fillPicks([99, 4], ALL, 2, mulberry32(3));
    expect(picks[0]).toBe(4);
    expect(ALL).toContain(picks[1]);
  });

  it('選びすぎていても必要数で切る', () => {
    expect(fillPicks([1, 2, 3], ALL, 2, mulberry32(0))).toEqual([1, 2]);
  });
});
