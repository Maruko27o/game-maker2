import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { COURSES } from './data/courses';
import { SKILL_SLOT, allSlots, rerollState, canReroll } from './logic/reroll';
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

describe('finishReroll（回数が余っていても確定できる）', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('確定すると、回数が残っていても厳選できなくなる', () => {
    seed(legacy());
    expect(rerollState(useStore.getState().horses[0], [], []).left).toBe(3);
    expect(useStore.getState().finishReroll('L0')).toBe(true);
    expect(useStore.getState().horses[0].rerollDone).toBe(true);
    // 権利は0扱いになり、振り直しも拒否される
    const h = useStore.getState().horses[0];
    expect(canReroll(h)).toBe(false);
    expect(rerollState(h, [], []).left).toBe(0);
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(false);
  });

  it('二度目の確定は何も起きない', () => {
    seed(legacy());
    expect(useStore.getState().finishReroll('L0')).toBe(true);
    expect(useStore.getState().finishReroll('L0')).toBe(false);
  });

  it('確定してもスキルと適性の中身は変わらない', () => {
    seed(legacy());
    const before = { ...useStore.getState().horses[0] };
    useStore.getState().finishReroll('L0');
    const after = useStore.getState().horses[0];
    expect(after.skill).toBe(before.skill);
    expect(after.apt).toEqual(before.apt);
  });
});

describe('retireMany（まとめて引退）', () => {
  beforeEach(() => useStore.getState().resetAll());

  function seedMany(n: number) {
    const horses = Array.from({ length: n }, (_, i) => ({ ...legacy(), id: `L${i}`, name: `L${i}` }));
    useStore.setState({ horses, team: horses.slice(0, 6).map((h) => h.id), coins: 0 });
    return horses;
  }

  it('選んだウマをまとめて引退させ、合計コインを受け取る', () => {
    seedMany(5);
    const r = useStore.getState().retireMany(['L1', 'L3']);
    expect(r.retired).toBe(2);
    expect(r.coins).toBeGreaterThan(0);
    expect(useStore.getState().coins).toBe(r.coins);
    expect(useStore.getState().horses.map((h) => h.id)).toEqual(['L0', 'L2', 'L4']);
  });

  it('チームからも外れる（幽霊エントリを残さない）', () => {
    seedMany(6);
    useStore.getState().retireMany(['L0', 'L5']);
    expect(useStore.getState().team).toEqual(['L1', 'L2', 'L3', 'L4']);
  });

  it('ロック中のウマは引退させない（誤操作で消えない）', () => {
    seedMany(4);
    useStore.getState().toggleLock('L1');
    const r = useStore.getState().retireMany(['L0', 'L1', 'L2']);
    expect(r.retired).toBe(2);
    expect(r.skipped).toBe(1);
    expect(useStore.getState().horses.map((h) => h.id)).toContain('L1');
  });

  it('全部ロックされていれば何も起きない', () => {
    seedMany(2);
    useStore.getState().toggleLock('L0');
    useStore.getState().toggleLock('L1');
    const r = useStore.getState().retireMany(['L0', 'L1']);
    expect(r.retired).toBe(0);
    expect(r.coins).toBe(0);
    expect(useStore.getState().horses).toHaveLength(2);
  });

  it('存在しないIDは無視する', () => {
    seedMany(2);
    const r = useStore.getState().retireMany(['zzz']);
    expect(r.retired).toBe(0);
    expect(useStore.getState().horses).toHaveLength(2);
  });

  it('引退したウマのトロフィー・バッジも消える', () => {
    const hs = seedMany(2);
    useStore.setState({
      trophies: [{ id: 't', horseId: 'L0', rank: 1, courseId: 'green', mode: 60, grade: 'gp', at: 0 }],
      badges: [{ id: 'badge_1st', horseId: 'L0', at: 0 }],
    });
    expect(hs).toHaveLength(2);
    useStore.getState().retireMany(['L0']);
    expect(useStore.getState().trophies).toHaveLength(0);
    expect(useStore.getState().badges).toHaveLength(0);
  });
});
