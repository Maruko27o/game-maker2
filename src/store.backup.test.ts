import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, migrate } from './store';
import { COURSES } from './data/courses';
import type { Horse, Stats } from './types';

// 手元バックアップ（書き出し→読み込み）が本当に元に戻せることの担保。
// セーブ消失は「戻せない」のが一番痛いので、往復が壊れたら必ず落ちるようにしておく。
const STATS: Stats = { spd: 10, sta: 8, pwr: 8, jmp: 6, gut: 8, wit: 8 };

function horse(id: string): Horse {
  return {
    id,
    name: id,
    colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' },
    decos: {},
    stats: { ...STATS },
    createdAt: 0,
    skill: 'straight_run',
    apt: Object.fromEntries(COURSES.map((c) => [c.id, 'C'])),
  };
}

describe('exportSave / importSave', () => {
  beforeEach(() => useStore.getState().resetAll());

  it('書き出したJSONを読み込むと、ウマ・コイン・トロフィーが元に戻る', () => {
    useStore.setState({
      horses: [horse('A'), horse('B')],
      team: ['A'],
      coins: 12_345,
      trophies: [
        { id: 't1', horseId: 'A', rank: 1, courseId: COURSES[0].id, mode: 30, grade: 'normal', at: 1 },
      ],
    });
    const backup = useStore.getState().exportSave();

    // 事故（全部消える）→ バックアップから復旧
    useStore.getState().resetAll();
    expect(useStore.getState().horses).toHaveLength(0);

    expect(useStore.getState().importSave(backup)).toBe(true);
    const s = useStore.getState();
    expect(s.horses.map((h) => h.id)).toEqual(['A', 'B']);
    expect(s.coins).toBe(12_345);
    expect(s.trophies).toHaveLength(1);
    expect(s.team).toEqual(['A']);
  });

  it('読み込みは「あとから保存されたもの」として扱われる（クラウドへ上がる）', () => {
    useStore.setState({ horses: [horse('A')], savedAt: 1 });
    const backup = useStore.getState().exportSave();
    useStore.getState().resetAll();
    const before = useStore.getState().savedAt;
    expect(useStore.getState().importSave(backup)).toBe(true);
    expect(useStore.getState().savedAt).toBeGreaterThanOrEqual(before);
  });

  it('壊れた文字列やよそのJSONは読み込まず、いまのデータを壊さない', () => {
    useStore.setState({ horses: [horse('A')], coins: 500 });
    for (const bad of ['', 'not json', '{}', '[]', '{"version":6}']) {
      expect(useStore.getState().importSave(bad)).toBe(false);
    }
    expect(useStore.getState().horses.map((h) => h.id)).toEqual(['A']);
    expect(useStore.getState().coins).toBe(500);
  });

  it('中身の下見（migrate）でウマ数とコインが読める＝確認画面に出せる', () => {
    useStore.setState({ horses: [horse('A'), horse('B'), horse('C')], coins: 777 });
    const parsed = migrate(JSON.parse(useStore.getState().exportSave()));
    expect(parsed).not.toBeNull();
    expect(parsed!.data.horses).toHaveLength(3);
    expect(parsed!.data.coins).toBe(777);
  });
});
