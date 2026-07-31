import { describe, it, expect } from 'vitest';
import { allSlots, applyReroll, SKILL_SLOT } from './reroll';
import { COURSES } from '../data/courses';
import { mulberry32 } from './stats';
import type { Horse } from '../types';

const H = (over: Partial<Horse> = {}): Horse => ({
  id: 'h1', name: 'h1', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
  stats: { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 }, createdAt: 0,
  skill: 'straight_run',
  apt: Object.fromEntries(COURSES.map((c) => [c.id, 'C'])),
  ...over,
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
