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

  it('3連単は選んだウマの着順もランダム（1着固定にならない）', () => {
    const posOf5 = new Set<number>();
    for (let seed = 0; seed < 200; seed++) {
      const picks = fillPicks([5], ALL, 3, mulberry32(seed));
      expect(picks).toContain(5);
      posOf5.add(picks.indexOf(5));
    }
    expect(posOf5).toEqual(new Set([0, 1, 2])); // 1着も2着も3着もあり得る
  });

  it('2頭選んだら、その2頭が必ず入った3連単になる（並びはランダム）', () => {
    for (let seed = 0; seed < 200; seed++) {
      const picks = fillPicks([5, 2], ALL, 3, mulberry32(seed));
      expect(picks).toHaveLength(3);
      expect(picks).toContain(5);
      expect(picks).toContain(2);
      expect(new Set(picks).size).toBe(3);
    }
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
      expect(picks).toContain(7);
      expect(new Set(picks).size).toBe(2);
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

  it('必要数ぶん選び終えていれば、その3頭だけの買い目になる（並びは入れ替わり得る）', () => {
    const picks = fillPicks([1, 2, 3], ALL, 3, mulberry32(9));
    expect([...picks].sort()).toEqual([1, 2, 3]);
  });

  it('出走していない番号は無視して埋め直す', () => {
    const picks = fillPicks([99, 4], ALL, 2, mulberry32(3));
    expect(picks).toContain(4);
    expect(picks).toHaveLength(2);
    for (const i of picks) expect(ALL).toContain(i);
  });

  it('選びすぎていても必要数で切る', () => {
    expect([...fillPicks([1, 2, 3], ALL, 2, mulberry32(0))].sort()).toEqual([1, 2]);
  });
});
