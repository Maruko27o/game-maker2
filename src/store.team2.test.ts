import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import type { Horse, Stats } from './types';

// PR-3：チーム編成アクションと「新世代(gen2)」フラグのストア側の挙動。
const STATS: Stats = { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 };
const look = { name: 'x', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} };

/** 既存ウマ（gen2 なし）を直接ストアに置く。マイグレーション後の既存アカウント相当。 */
function seedLegacy(n: number): Horse[] {
  const horses: Horse[] = Array.from({ length: n }, (_, i) => ({
    id: `L${i}`, name: `L${i}`, colors: look.colors, decos: {}, stats: { ...STATS }, createdAt: 0,
  }));
  useStore.setState({ horses, team: horses.map((h) => h.id) });
  return horses;
}

describe('addHorse：新しく作ったウマは新世代(gen2)', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('作ったウマに gen2 が付き、既存ウマには付かない', () => {
    const legacy = seedLegacy(2);
    expect(legacy[0].gen2).toBeUndefined();
    const made = useStore.getState().addHorse(look, { ...STATS });
    expect(made?.gen2).toBe(true);
  });

  it('既存ウマがチーム外に残っていれば、新ウマは自動でチームに入らない', () => {
    const legacy = seedLegacy(2);
    useStore.setState({ team: [legacy[0].id] }); // L1 をチーム外に残す
    const made = useStore.getState().addHorse(look, { ...STATS })!;
    expect(useStore.getState().team).toEqual([legacy[0].id]);
    expect(useStore.getState().team).not.toContain(made.id);
  });

  it('ウマ0頭の新規プレイヤーは、作ったウマが自動でチームに入る（レースに出られる）', () => {
    useStore.setState({ horses: [], team: [] });
    const made = useStore.getState().addHorse(look, { ...STATS })!;
    expect(useStore.getState().team).toEqual([made.id]);
  });
});

describe('joinTeam / leaveTeam / reorderTeam', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('外す→入れる で往復でき、順番も入れ替えられる', () => {
    const legacy = seedLegacy(3);
    const s = () => useStore.getState();
    expect(s().leaveTeam(legacy[1].id)).toBe(true);
    expect(s().team).toEqual([legacy[0].id, legacy[2].id]);
    expect(s().joinTeam(legacy[1].id)).toBe(true);
    expect(s().team).toEqual([legacy[0].id, legacy[2].id, legacy[1].id]);
    expect(s().reorderTeam(legacy[1].id, -1)).toBe(true);
    expect(s().team).toEqual([legacy[0].id, legacy[1].id, legacy[2].id]);
  });

  it('チームが6頭のときは追加できない', () => {
    const legacy = seedLegacy(6);
    const extra = useStore.getState().addHorse(look, { ...STATS })!;
    expect(useStore.getState().team).toHaveLength(6);
    expect(useStore.getState().joinTeam(extra.id)).toBe(false);
    expect(useStore.getState().team).not.toContain(extra.id);
    expect(legacy).toHaveLength(6);
  });

  it('既存ウマがチーム外にいる間、新世代はチームに入れられない', () => {
    const legacy = seedLegacy(2);
    useStore.setState({ team: [legacy[0].id] });
    const made = useStore.getState().addHorse(look, { ...STATS })!;
    expect(useStore.getState().joinTeam(made.id)).toBe(false);
    // 既存ウマを全員チームに戻したら、空き枠を新世代で埋められる
    expect(useStore.getState().joinTeam(legacy[1].id)).toBe(true);
    expect(useStore.getState().joinTeam(made.id)).toBe(true);
    expect(useStore.getState().team).toContain(made.id);
  });
});

describe('retireHorse：チームからも外れる', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('引退したウマがチームに残らない（幽霊エントリを作らない）', () => {
    const legacy = seedLegacy(3);
    useStore.getState().retireHorse(legacy[1].id);
    expect(useStore.getState().team).toEqual([legacy[0].id, legacy[2].id]);
    expect(useStore.getState().horses.map((h) => h.id)).toEqual([legacy[0].id, legacy[2].id]);
  });
});
