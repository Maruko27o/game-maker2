import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { Horse, Stats } from './types';

// PR-4：お気に入りロック（誤引退の防止）と、ウマ作成の無料化。
const STATS: Stats = { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 };
const look = { name: 'x', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} };

function seed(n: number): Horse[] {
  const horses: Horse[] = Array.from({ length: n }, (_, i) => ({
    id: `L${i}`, name: `L${i}`, colors: look.colors, decos: {}, stats: { ...STATS }, createdAt: 0,
  }));
  useStore.setState({ horses, team: horses.map((h) => h.id) });
  return horses;
}

describe('お気に入りロック', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('切り替えでき、状態が保存される', () => {
    const [h] = seed(2);
    expect(useStore.getState().toggleLock(h.id)).toBe(true);
    expect(useStore.getState().horses.find((x) => x.id === h.id)?.locked).toBe(true);
    expect(useStore.getState().toggleLock(h.id)).toBe(false);
    expect(useStore.getState().horses.find((x) => x.id === h.id)?.locked).toBe(false);
  });

  it('ロック中のウマは引退できない（コインも増えず、ウマも消えない）', () => {
    const [h] = seed(2);
    useStore.getState().toggleLock(h.id);
    const before = useStore.getState().coins;
    expect(useStore.getState().retireHorse(h.id)).toBe(0);
    expect(useStore.getState().horses.map((x) => x.id)).toContain(h.id);
    expect(useStore.getState().coins).toBe(before);
  });

  it('ロックを外せば引退できる', () => {
    const [h] = seed(2);
    useStore.getState().toggleLock(h.id); // on
    useStore.getState().toggleLock(h.id); // off
    expect(useStore.getState().retireHorse(h.id)).toBeGreaterThan(0);
    expect(useStore.getState().horses.map((x) => x.id)).not.toContain(h.id);
  });

  it('存在しないIDでは何も起きない', () => {
    seed(1);
    expect(useStore.getState().toggleLock('zzz')).toBe(false);
  });
});

describe('ウマの作成は無料', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('コイン0でもウマを作れて、コインは減らない', () => {
    useStore.setState({ horses: [], team: [], coins: 0 });
    const made = useStore.getState().addHorse(look, { ...STATS });
    expect(made).not.toBeNull();
    expect(useStore.getState().coins).toBe(0);
    expect(useStore.getState().horses).toHaveLength(1);
  });

  it('2頭目以降もコインを消費しない', () => {
    seed(1);
    useStore.setState({ coins: 500 });
    useStore.getState().addHorse(look, { ...STATS });
    expect(useStore.getState().coins).toBe(500);
    expect(useStore.getState().horses).toHaveLength(2);
  });
});
