import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { COURSES } from './data/courses';
import { SKILL_SLOT, allSlots } from './logic/reroll';
import { REFINE_MAX } from './logic/refine';
import type { Horse, Stats } from './types';

// 厳選（振り直し）のストア側の挙動。全ウマ最大3回・1回につき厳選チケット1枚。
// 旧仕様（コイン払い・活躍で最大10回）で振り直したことがあるウマは対象外。
const STATS: Stats = { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 };
const look = { name: 'x', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} };

function horse(over: Partial<Horse> = {}): Horse {
  return {
    id: 'L0', name: 'L0', colors: look.colors, decos: {}, stats: { ...STATS }, createdAt: 0,
    skill: 'straight_run',
    apt: Object.fromEntries(COURSES.map((c) => [c.id, 'C'])),
    ...over,
  };
}
function seed(h: Horse, tickets = 99) {
  useStore.setState({ horses: [h], team: [h.id], trophies: [], badges: [], refineTickets: tickets });
}

describe('rerollHorse（チケット厳選）', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('選んだ枠を振り直し、使用回数が1増えてチケットが1枚減る', () => {
    seed(horse(), 3);
    expect(useStore.getState().rerollHorse('L0', [COURSES[0].id])).toBe(true);
    const h = useStore.getState().horses[0];
    expect(h.refineUsed).toBe(1);
    expect(useStore.getState().refineTickets).toBe(2);
    expect(['C', 'B', 'A', 'S']).toContain(h.apt![COURSES[0].id]);
  });

  it('選ばなかった枠は変わらない（良い枠を守れる）', () => {
    const apt = Object.fromEntries(COURSES.map((c) => [c.id, 'C']));
    apt[COURSES[0].id] = 'S';
    seed(horse({ apt }));
    useStore.getState().rerollHorse('L0', [COURSES[1].id]);
    const h = useStore.getState().horses[0];
    expect(h.apt![COURSES[0].id]).toBe('S');
    expect(h.skill).toBe('straight_run');
  });

  it('3回で打ち止め（チケットが余っていても4回目は失敗）', () => {
    seed(horse(), 99);
    for (let i = 0; i < REFINE_MAX; i++) {
      expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(true);
    }
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(false);
    expect(useStore.getState().horses[0].refineUsed).toBe(REFINE_MAX);
  });

  it('チケットが無ければ振り直せない（回数も減らない）', () => {
    seed(horse(), 1);
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(true);
    expect(useStore.getState().refineTickets).toBe(0);
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(false); // チケット切れ
    expect(useStore.getState().horses[0].refineUsed).toBe(1);
  });

  it('旧仕様で厳選したことがあるウマは対象外（中身はそのまま・チケットも減らない）', () => {
    const apt = Object.fromEntries(COURSES.map((c) => [c.id, 'S']));
    seed(horse({ rerollsUsed: 2, apt }));
    expect(useStore.getState().rerollHorse('L0', allSlots())).toBe(false);
    const h = useStore.getState().horses[0];
    expect(h.apt![COURSES[0].id]).toBe('S'); // 中身は動かない
    expect(h.skill).toBe('straight_run');
    expect(useStore.getState().refineTickets).toBe(99);
  });

  it('新しく召喚したウマ（gen2）も厳選できる', () => {
    seed(horse({ gen2: true }), 1);
    expect(useStore.getState().rerollHorse('L0', [SKILL_SLOT])).toBe(true);
  });

  it('新しく作ったウマも厳選できる', () => {
    useStore.setState({ horses: [], team: [], refineTickets: 1 });
    const made = useStore.getState().addHorse(look, { ...STATS })!;
    expect(useStore.getState().rerollHorse(made.id, [SKILL_SLOT])).toBe(true);
  });

  it('枠を1つも選ばなければ失敗する（チケットを無駄にしない）', () => {
    seed(horse(), 5);
    expect(useStore.getState().rerollHorse('L0', [])).toBe(false);
    expect(useStore.getState().refineTickets).toBe(5);
  });

  it('存在しないウマでは何も起きない', () => {
    seed(horse(), 5);
    expect(useStore.getState().rerollHorse('zzz', [SKILL_SLOT])).toBe(false);
  });

  it('振り直しても常に有効な内容が入っている', () => {
    seed(horse(), 9);
    useStore.getState().rerollHorse('L0', allSlots());
    const h = useStore.getState().horses[0];
    expect(h.skill).toBeTruthy();
    for (const c of COURSES) expect(['C', 'B', 'A', 'S']).toContain(h.apt![c.id]);
  });
});
