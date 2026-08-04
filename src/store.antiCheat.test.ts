import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Horse, Stats } from './types';

// 端末の時計をいじるだけで得ができないことの回帰。
// Date.now() は「進めた」値、trustedNow() は実時刻のまま——という状況を作り、
// 1日1回・時間回復まわりが Date.now() を見ていないことを確かめる。
let fakeTrusted = new Date(2026, 7, 3, 12).getTime(); // 実時刻（サーバ基準）
vi.mock('./logic/trustedClock', async () => {
  const actual = await vi.importActual<typeof import('./logic/trustedClock')>('./logic/trustedClock');
  return { ...actual, trustedNow: () => fakeTrusted };
});

const { useStore, dayKey } = await import('./store');
const { ENERGY_CAP, ENERGY_REGEN_MS } = await import('./logic/energy');

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const STATS: Stats = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 };
function horse(id = 'H1'): Horse {
  return {
    id, name: id, colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' },
    decos: {}, stats: { ...STATS }, createdAt: 0, skill: 'straight_run',
  };
}

describe('端末の時計を進めても得できない', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    fakeTrusted = day(2026, 8, 3);
  });

  it('日付キーは端末時計ではなく信頼できる時刻で決まる', () => {
    const spy = vi.spyOn(Date, 'now').mockReturnValue(day(2026, 9, 30)); // 端末だけ未来へ
    try {
      expect(dayKey()).toBe('2026-8-3'); // 実時刻のまま
    } finally {
      spy.mockRestore();
    }
  });

  it('グランプリG1の1日の回数は、端末の日付を進めても戻らない', () => {
    const limit = 3;
    for (let i = 0; i < limit; i++) expect(useStore.getState().startGpAttempt('g1')).toBe(true);
    expect(useStore.getState().startGpAttempt('g1')).toBe(false); // 使い切り

    const spy = vi.spyOn(Date, 'now').mockReturnValue(day(2026, 8, 10)); // 端末を1週間進める
    try {
      expect(useStore.getState().startGpAttempt('g1')).toBe(false); // 増えない
    } finally {
      spy.mockRestore();
    }

    fakeTrusted = day(2026, 8, 4); // 実際に翌日になれば戻る
    expect(useStore.getState().startGpAttempt('g1')).toBe(true);
  });

  it('草むらのストックは、端末の時計を進めても回復しない', () => {
    useStore.setState({ energy: 0, energyUpdatedAt: fakeTrusted, horses: [], team: [] });
    const spy = vi.spyOn(Date, 'now').mockReturnValue(fakeTrusted + 10 * ENERGY_REGEN_MS);
    try {
      expect(useStore.getState().doSpawn()).toBeNull(); // 空のまま引けない
      expect(useStore.getState().horses).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }

    fakeTrusted += ENERGY_REGEN_MS; // 実際に1時間たてば1回ぶん回復する
    expect(useStore.getState().doSpawn()).not.toBeNull();
    expect(useStore.getState().horses).toHaveLength(1);
  });

  it('ストックは上限を超えて溜まらない', () => {
    useStore.setState({ energy: 0, energyUpdatedAt: fakeTrusted, horses: [], team: [] });
    fakeTrusted += 100 * ENERGY_REGEN_MS; // 100時間ぶん放置
    let drawn = 0;
    while (useStore.getState().doSpawn()) drawn++;
    expect(drawn).toBe(ENERGY_CAP);
  });
});

describe('コインが増える経路の二重取り防止', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    fakeTrusted = day(2026, 8, 3);
  });

  it('タスクのバンクは1回しか受け取れない', () => {
    useStore.setState({ coins: 0, tasks: { ...useStore.getState().tasks, bank: 5000 } });
    expect(useStore.getState().claimTaskBank()).toBe(5000);
    expect(useStore.getState().claimTaskBank()).toBe(0); // 空
    expect(useStore.getState().coins).toBe(5000);
  });

  it('牧場の回収は時間が進んだぶんだけ（連打しても増えない）', () => {
    useStore.setState({ horses: [horse()], team: ['H1'], coins: 0, farmClaimedAt: fakeTrusted });
    fakeTrusted += 3600_000; // 1時間
    const first = useStore.getState().claimFarm();
    expect(first).toBeGreaterThan(0);
    expect(useStore.getState().claimFarm()).toBe(0); // 直後は0
    expect(useStore.getState().claimFarm()).toBe(0);
    expect(useStore.getState().coins).toBe(first);
  });

  it('連勝フレームは同じレベルを二重に受け取れない', () => {
    useStore.setState({ soloStreak: 3, streakBest: 3, streakClaimed: 0 });
    const got = useStore.getState().claimStreakFrame();
    expect(got).toBeGreaterThan(0);
    const before = useStore.getState().streakClaimed ?? 0;
    // 受け取り待ちが無ければ0（同じレベルを何度も取れない）
    while (useStore.getState().claimStreakFrame() > 0) { /* 受け取れるぶんだけ */ }
    expect(useStore.getState().streakClaimed).toBeGreaterThanOrEqual(before);
    expect(useStore.getState().claimStreakFrame()).toBe(0);
  });

  it('引退はウマを消してから払う（同じウマで二度もらえない）', () => {
    useStore.setState({ horses: [horse()], team: ['H1'], coins: 0, trophies: [], badges: [] });
    const first = useStore.getState().retireHorse('H1');
    expect(first).toBeGreaterThan(0);
    expect(useStore.getState().retireHorse('H1')).toBe(0); // もう居ない
    expect(useStore.getState().coins).toBe(first);
  });

  it('まとめて引退は同じIDを重ねても1回ぶんしか払わない', () => {
    useStore.setState({ horses: [horse('A'), horse('B')], team: [], coins: 0, trophies: [], badges: [] });
    const r = useStore.getState().retireMany(['A', 'A', 'A', 'B']);
    expect(r.retired).toBe(2);
    expect(useStore.getState().horses).toHaveLength(0);
    expect(useStore.getState().coins).toBe(r.coins);
  });

  it('ロック中のウマは引退できない（まとめてでも）', () => {
    useStore.setState({ horses: [{ ...horse('A'), locked: true }], team: [], coins: 0 });
    expect(useStore.getState().retireHorse('A')).toBe(0);
    expect(useStore.getState().retireMany(['A']).retired).toBe(0);
    expect(useStore.getState().horses).toHaveLength(1);
    expect(useStore.getState().coins).toBe(0);
  });

  it('おかわりはコインが足りないと買えず、満タンでは買えない', () => {
    useStore.setState({ coins: 0, energy: 0, energyUpdatedAt: fakeTrusted });
    expect(useStore.getState().buyOkawari()).toBe(false);
    useStore.setState({ coins: 1000, energy: ENERGY_CAP, energyUpdatedAt: fakeTrusted });
    expect(useStore.getState().buyOkawari()).toBe(false);
    expect(useStore.getState().coins).toBe(1000);
  });

  it('育成アイテムは上限に達していると消費されない', () => {
    const capped: Stats = { spd: 10, sta: 10, pwr: 10, jmp: 10, gut: 4, wit: 4 }; // 合計48
    useStore.setState({
      horses: [{ ...horse('A'), stats: capped }], team: ['A'],
      items: [{ kind: 'stat', stat: 'gut' }],
    });
    expect(useStore.getState().trainHorse('A', 0, 'gut')).toBe(false);
    expect(useStore.getState().items).toHaveLength(1); // アイテムは残る
  });
});
