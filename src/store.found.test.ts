import { describe, it, expect } from 'vitest';
import { migrate } from './store';

// 「草むらで何頭見つけたか」（stats.horsesFound）の移行テスト。
// 称号の条件に使う値なので、この項目より前から遊んでいる人が 0 から始まって
// 「ウマ好き」すら取れなくなる、という事故を防ぐ。
function horse(id: string) {
  return { id, name: id, parts: {}, stats: {}, style: 'nige' } as unknown;
}
function baseSave(extra: Record<string, unknown> = {}) {
  return {
    version: 6,
    owned: { body_bay: 1 },
    horses: [horse('h1'), horse('h2'), horse('h3')],
    savedAt: 123,
    ...extra,
  };
}

describe('migrate: 見つけたウマの通算数', () => {
  it('記録が無い古いセーブは、草むらの回数から下駄をはかせる', () => {
    const res = migrate(baseSave({ tasks: { racesFinished: 0, raceBanked: 0, grassSpawns: 42, grassBanked: 4, bank: 0 } }));
    expect(res!.data.stats.horsesFound).toBe(42);
  });

  it('草むらの回数まで潰れているセーブは、今いるウマの数で埋める', () => {
    const res = migrate(baseSave());
    expect(res!.data.stats.horsesFound).toBe(3); // horses.length
  });

  it('多い方が採用される（草むらの回数 < 手持ちでも減らさない）', () => {
    const res = migrate(baseSave({ tasks: { racesFinished: 0, raceBanked: 0, grassSpawns: 1, grassBanked: 0, bank: 0 } }));
    expect(res!.data.stats.horsesFound).toBe(3);
  });

  it('すでに記録があるセーブは、そのままの値を保つ（下駄で上書きしない）', () => {
    const res = migrate(baseSave({
      tasks: { racesFinished: 0, raceBanked: 0, grassSpawns: 5, grassBanked: 0, bank: 0 },
      stats: { betsPlaced: 1, maxPayout: 0, maxRecoveryPct: 0, maxOdds: 0, totalEarned: 0, horsesFound: 1234 },
    }));
    expect(res!.data.stats.horsesFound).toBe(1234);
  });

  it('まっさら（ウマ0頭・草むら0回）なら 0 のまま', () => {
    const res = migrate(baseSave({ horses: [], tasks: { racesFinished: 0, raceBanked: 0, grassSpawns: 0, grassBanked: 0, bank: 0 } }));
    expect(res!.data.stats.horsesFound).toBe(0);
  });
});
