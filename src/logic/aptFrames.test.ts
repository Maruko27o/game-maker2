import { describe, it, expect } from 'vitest';
import { uniformGrade, normAptFrames, newlyEarned, mergeAptFrames } from './aptFrames';
import { COURSES } from '../data/courses';
import type { Horse, AptGrade } from '../types';

function horse(id: string, apt: Partial<Record<string, string>>): Horse {
  return {
    id, name: id,
    colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
    stats: { spd: 7, sta: 7, pwr: 7, jmp: 7, gut: 6, wit: 6 },
    createdAt: 0,
    apt: apt as Record<string, string>,
  };
}
const all = (g: AptGrade) => horse(`h${g}`, Object.fromEntries(COURSES.map((c) => [c.id, g])));

describe('適性フレーム', () => {
  it('6コース全部が同じ等級のときだけ授与される', () => {
    for (const g of ['C', 'B', 'A', 'S'] as AptGrade[]) {
      expect(uniformGrade(all(g))).toBe(g);
    }
    const mixed = horse('mix', Object.fromEntries(COURSES.map((c, i) => [c.id, i === 0 ? 'S' : 'A'])));
    expect(uniformGrade(mixed)).toBeNull();
  });

  it('持っていない等級だけが新しく授与される', () => {
    expect(newlyEarned([all('A')], [])).toEqual(['A']);
    expect(newlyEarned([all('A')], ['A'])).toEqual([]);
    expect(newlyEarned([all('C'), all('S')], ['C'])).toEqual(['S']);
  });

  // ここがこの機能のいちばん大事な約束。
  it('一度もらった等級は、そのウマを手放しても取り上げられない', () => {
    let owned: AptGrade[] = [];
    owned = mergeAptFrames(owned, newlyEarned([all('S')], owned));
    expect(owned).toEqual(['S']);
    // そのウマを引退させた（手持ちが空）／厳選で適性が変わった、を再現
    owned = mergeAptFrames(owned, newlyEarned([], owned));
    expect(owned).toEqual(['S']);
    const rerolled = horse('hS', Object.fromEntries(COURSES.map((c, i) => [c.id, i === 0 ? 'C' : 'S'])));
    owned = mergeAptFrames(owned, newlyEarned([rerolled], owned));
    expect(owned).toEqual(['S']);
  });

  it('並び順は C→B→A→S に固定される', () => {
    expect(mergeAptFrames(['S'], ['C', 'A'])).toEqual(['C', 'A', 'S']);
    expect(normAptFrames(['S', 'C', 'S', 'x', 3])).toEqual(['C', 'S']);
  });

  it('壊れた保存値は落とす', () => {
    expect(normAptFrames(null)).toEqual([]);
    expect(normAptFrames('S')).toEqual([]);
  });
});
