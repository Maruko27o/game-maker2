import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, MAX_HORSES } from './store';
import { ENERGY_CAP } from './logic/energy';
import { COURSES } from './data/courses';
import { statTotal } from './logic/stats';
import { STAT_ALLOC_TOTAL } from './types';
import type { Horse } from './types';

// PR-8：草むらの召喚。引いたパーツが図鑑に入り、その姿のウマがそのままボックスに入る。
function fill(n: number) {
  const horses: Horse[] = Array.from({ length: n }, (_, i) => ({
    id: `L${i}`, name: `L${i}`,
    colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
    stats: { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 }, createdAt: 0,
  }));
  useStore.setState({ horses, team: horses.slice(0, 6).map((h) => h.id) });
}

describe('doSpawn：草むらのウマがそのまま仲間になる', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('1回タップするとウマが1頭増える', () => {
    const before = useStore.getState().horses.length;
    const res = useStore.getState().doSpawn();
    expect(res).not.toBeNull();
    expect(useStore.getState().horses).toHaveLength(before + 1);
    expect(res!.horse).toBeTruthy();
  });

  it('もらえるウマは合計40の完成した姿（色が欠けない）', () => {
    const res = useStore.getState().doSpawn()!;
    expect(statTotal(res.horse.stats)).toBe(STAT_ALLOC_TOTAL);
    expect(res.horse.colors.body).toBeTruthy();
    expect(res.horse.colors.mane).toBeTruthy();
    expect(res.horse.colors.hoof).toBeTruthy();
    expect(res.horse.name).toBeTruthy();
  });

  it('生まれつきスキルと6コースぶんの適性を持っている', () => {
    const res = useStore.getState().doSpawn()!;
    expect(res.horse.skill).toBeTruthy();
    expect(Object.keys(res.horse.apt ?? {})).toHaveLength(COURSES.length);
    expect(res.horse.gen2).toBe(true); // 新世代
  });

  it('パーツは今までどおり図鑑に集まる', () => {
    const res = useStore.getState().doSpawn()!;
    expect(res.parts.length).toBeGreaterThan(0);
    const owned = useStore.getState().owned;
    for (const p of res.parts) expect(owned[p.id]).toBeGreaterThan(0);
  });

  it('ボックスが満杯なら召喚できず、ストックも減らない', () => {
    fill(MAX_HORSES);
    const stockBefore = useStore.getState().energy;
    expect(useStore.getState().doSpawn()).toBeNull();
    expect(useStore.getState().horses).toHaveLength(MAX_HORSES);
    expect(useStore.getState().energy).toBe(stockBefore); // ストック据え置き
  });

  it('1頭引退させれば、また草むらに行ける', () => {
    fill(MAX_HORSES);
    expect(useStore.getState().doSpawn()).toBeNull();
    useStore.getState().retireHorse('L29');
    expect(useStore.getState().doSpawn()).not.toBeNull();
  });

  it('ストックが無ければ召喚できない', () => {
    useStore.setState({ energy: 0, energyUpdatedAt: Date.now() });
    expect(useStore.getState().doSpawn()).toBeNull();
  });

  it('チームに空きがあれば自動で入る（すぐ走れる）', () => {
    useStore.setState({ horses: [], team: [] });
    const res = useStore.getState().doSpawn()!;
    expect(useStore.getState().team).toContain(res.horse.id);
  });

  it('既存ウマでチームが埋まっていれば、新しいウマはチームに入らない', () => {
    fill(6);
    const res = useStore.getState().doSpawn()!;
    expect(useStore.getState().team).toHaveLength(6);
    expect(useStore.getState().team).not.toContain(res.horse.id);
  });

  it('何度召喚しても、もらえるウマは毎回ちがう', () => {
    useStore.setState({ horses: [], team: [], energy: ENERGY_CAP, energyUpdatedAt: Date.now() });
    const ids = new Set<string>();
    for (let i = 0; i < ENERGY_CAP; i++) {
      const r = useStore.getState().doSpawn();
      if (r) ids.add(r.horse.id);
    }
    expect(ids.size).toBe(ENERGY_CAP);
    expect(useStore.getState().horses).toHaveLength(ENERGY_CAP);
  });
});
