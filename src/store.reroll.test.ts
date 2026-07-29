import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { COURSES } from './data/courses';
import { SKILL_SLOT, allSlots } from './logic/reroll';
import type { Horse, Stats, Trophy, Badge } from './types';

// PR-7：厳選（振り直し）のストア側の挙動。
const STATS: Stats = { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 };
const look = { name: 'x', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} };

function legacy(over: Partial<Horse> = {}): Horse {
  return {
    id: 'L0', name: 'L0', colors: look.colors, decos: {}, stats: { ...STATS }, createdAt: 0,
    skill: 'straight_run',
    apt: Object.fromEntries(COURSES.map((c) => [c.id, 'C'])),
    ...over,
  };
}
function seed(h: Horse, trophies: Trophy[] = [], badges: Badge[] = []) {
  useStore.setState({ horses: [h], team: [h.id], trophies, badges });
}

describe('rerollHorse', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('選んだ枠を振り直し、使用回数が1増える', () => {
    seed(legacy());
    expect(useStore.getState().rerollHorse('L0', [COURSES[0].id])).toBe(true);
    const h = useStore.getState().horses[0];
    expect(h.rerollsUsed).toBe(1);
    expect(['C', 'B', 'A', 'S']).toContain(h.apt![COURSES[0].id]);
  });

  it('選ばなかった枠は変わらない（良い枠を守れる）', () => {
    const apt = Object.fromEntries(COURSES.map((c) => [c.id, 'C']));
    apt[COURSES[0].id] = 'S';
    seed(legacy({ apt }));
    useStore.getState().rerollHorse('L0', [COURSES[1].id]);
    const h = useStore.getState().horses[0];
    expect(h.apt![COURSES[0].id]).toBe('S');
    expect(h.skill).toBe('straight_run');
  });

  it('権利を使い切ったら失敗する（ベース3回）', () => {
    seed(legacy());
    for (let i = 0; i < 3; i++) expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(true);
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(false);
    expect(useStore.getState().horses[0].rerollsUsed).toBe(3);
  });

  it('トロフィー・バッジが多いウマは10回まで回せる', () => {
    const trophies: Trophy[] = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`, horseId: 'L0', rank: 1, courseId: 'green', mode: 60, grade: 'gp', at: 0,
    }));
    const badges: Badge[] = Array.from({ length: 100 }, (_, i) => ({ id: 'badge_1st', horseId: 'L0', at: i }));
    seed(legacy(), trophies, badges);
    for (let i = 0; i < 10; i++) expect(useStore.getState().rerollHorse('L0', allSlots())).toBe(true);
    expect(useStore.getState().rerollHorse('L0', allSlots())).toBe(false);
  });

  it('新世代(gen2)は厳選できない', () => {
    seed(legacy({ gen2: true }));
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(false);
    expect(useStore.getState().horses[0].rerollsUsed).toBeUndefined();
  });

  it('枠を選んでいなければ何も起きない（回数も減らない）', () => {
    seed(legacy());
    expect(useStore.getState().rerollHorse('L0', [])).toBe(false);
    expect(useStore.getState().horses[0].rerollsUsed).toBeUndefined();
  });

  it('存在しないウマでは何も起きない', () => {
    seed(legacy());
    expect(useStore.getState().rerollHorse('zzz', [SKILL_SLOT])).toBe(false);
  });

  it('振り直しても常に有効な内容が入っている', () => {
    seed(legacy());
    useStore.getState().rerollHorse('L0', allSlots());
    const h = useStore.getState().horses[0];
    expect(h.skill).toBeTruthy();
    for (const c of COURSES) expect(['C', 'B', 'A', 'S']).toContain(h.apt![c.id]);
  });

  it('新しく作ったウマ（新世代）は厳選できない', () => {
    useStore.setState({ horses: [], team: [] });
    const made = useStore.getState().addHorse(look, { ...STATS })!;
    expect(useStore.getState().rerollHorse(made.id, [SKILL_SLOT])).toBe(false);
  });
});
