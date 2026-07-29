import { describe, it, expect } from 'vitest';
import {
  rerollRights, rightsBreakdown, canReroll, rerollState, allSlots, applyReroll,
  REROLL_BASE, REROLL_MAX, SKILL_SLOT,
} from './reroll';
import { COURSES } from '../data/courses';
import { mulberry32 } from './stats';
import type { Horse, Trophy, Badge } from '../types';

const H = (over: Partial<Horse> = {}): Horse => ({
  id: 'h1', name: 'h1', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
  stats: { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 }, createdAt: 0,
  skill: 'straight_run',
  apt: Object.fromEntries(COURSES.map((c) => [c.id, 'C'])),
  ...over,
});
const T = (n: number, horseId = 'h1'): Trophy[] =>
  Array.from({ length: n }, (_, i) => ({ id: `t${i}`, horseId, rank: 1 as const, courseId: 'green', mode: 60 as const, grade: 'gp' as const, at: 0 }));
const B = (n: number, horseId = 'h1'): Badge[] =>
  Array.from({ length: n }, (_, i) => ({ id: `badge_1st`, horseId, at: i }));

describe('厳選の権利（活躍に応じて最大10回）', () => {
  it('何も持っていなければベースの3回', () => {
    expect(rerollRights(0, 0)).toBe(REROLL_BASE);
  });

  it('指定どおりに積み上がる', () => {
    expect(rerollRights(1, 0)).toBe(3 + 2); // トロフィー所持
    expect(rerollRights(5, 0)).toBe(3 + 2 + 1); // 5個以上
    expect(rerollRights(0, 1)).toBe(3 + 1); // バッジ所持
    expect(rerollRights(0, 10)).toBe(3 + 1 + 1);
    expect(rerollRights(0, 50)).toBe(3 + 1 + 1 + 1);
    expect(rerollRights(0, 100)).toBe(3 + 1 + 1 + 1 + 1);
  });

  it('全部そろうとちょうど10回（上限）', () => {
    expect(rerollRights(5, 100)).toBe(10);
    expect(REROLL_MAX).toBe(10);
  });

  it('上限を超えない', () => {
    expect(rerollRights(999, 9999)).toBe(REROLL_MAX);
  });

  it('内訳は7項目で、合計するとちょうど10回', () => {
    const bd = rightsBreakdown(5, 100);
    expect(bd).toHaveLength(7);
    expect(bd.every((b) => b.got)).toBe(true);
    expect(bd.reduce((n, b) => n + b.plus, 0)).toBe(10);
  });

  it('内訳は達成状況を正しく反映する', () => {
    const bd = rightsBreakdown(0, 12);
    expect(bd.find((b) => b.label === 'トロフィーを持っている')!.got).toBe(false);
    expect(bd.find((b) => b.label === 'バッジ10枚以上')!.got).toBe(true);
    expect(bd.find((b) => b.label === 'バッジ50枚以上')!.got).toBe(false);
  });
});

describe('対象は既存ウマだけ', () => {
  it('新世代(gen2)は厳選できない', () => {
    expect(canReroll(H())).toBe(true);
    expect(canReroll(H({ gen2: true }))).toBe(false);
  });

  it('新世代の権利は0回になる', () => {
    expect(rerollState(H({ gen2: true }), T(5), B(100)).rights).toBe(0);
    expect(rerollState(H({ gen2: true }), T(5), B(100)).left).toBe(0);
  });
});

describe('rerollState（残り回数）', () => {
  it('使った分だけ減り、0未満にならない', () => {
    expect(rerollState(H(), [], []).left).toBe(3);
    expect(rerollState(H({ rerollsUsed: 2 }), [], []).left).toBe(1);
    expect(rerollState(H({ rerollsUsed: 99 }), [], []).left).toBe(0);
  });

  it('そのウマ自身のトロフィー・バッジだけを数える', () => {
    const st = rerollState(H(), T(3, 'other'), B(20, 'other'));
    expect(st.trophyCount).toBe(0);
    expect(st.badgeCount).toBe(0);
    expect(st.rights).toBe(REROLL_BASE);
  });

  it('活躍したウマは回数が増える', () => {
    const st = rerollState(H(), T(5), B(100));
    expect(st.rights).toBe(10);
  });
});

describe('applyReroll（選んだ枠だけ引き直す）', () => {
  it('枠は スキル1つ＋コース6つ の計7つ', () => {
    expect(allSlots()).toHaveLength(7);
    expect(allSlots()[0]).toBe(SKILL_SLOT);
  });

  it('選ばなかった枠は絶対に変わらない', () => {
    const h = H({ apt: { ...Object.fromEntries(COURSES.map((c) => [c.id, 'C'])), [COURSES[0].id]: 'S' } });
    for (let seed = 0; seed < 50; seed++) {
      const out = applyReroll(h, [COURSES[1].id], mulberry32(seed));
      expect(out.skill).toBe(h.skill); // スキルは選んでいない
      expect(out.apt[COURSES[0].id]).toBe('S'); // 良い枠は残る
      for (const c of COURSES.slice(2)) expect(out.apt[c.id]).toBe('C');
    }
  });

  it('選んだ枠は引き直される（何度も回せば値が変わる）', () => {
    const h = H();
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      seen.add(applyReroll(h, [COURSES[0].id], mulberry32(seed)).apt[COURSES[0].id]);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('スキル枠を選べばスキルが引き直される', () => {
    const h = H();
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) seen.add(applyReroll(h, [SKILL_SLOT], mulberry32(seed)).skill);
    expect(seen.size).toBeGreaterThan(1);
  });

  it('7枠すべて選べば全部引き直され、常に有効な値になる', () => {
    const out = applyReroll(H(), allSlots(), mulberry32(3));
    expect(Object.keys(out.apt)).toHaveLength(6);
    for (const c of COURSES) expect(['C', 'B', 'A', 'S']).toContain(out.apt[c.id]);
    expect(out.skill).toBeTruthy();
  });

  it('知らない枠IDは無視する', () => {
    const h = H();
    const out = applyReroll(h, ['no_such_slot'], mulberry32(1));
    expect(out.skill).toBe(h.skill);
    for (const c of COURSES) expect(out.apt[c.id]).toBe('C');
  });

  it('適性が壊れている保存値でも落ちず、有効な等級になる', () => {
    const h = H({ apt: { [COURSES[0].id]: 'Z' } });
    const out = applyReroll(h, [], mulberry32(1));
    for (const c of COURSES) expect(['C', 'B', 'A', 'S']).toContain(out.apt[c.id]);
  });
});
