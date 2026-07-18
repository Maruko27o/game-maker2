import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from './store';
import { playerSnapshot } from './logic/arena';
import { periodId, ARENA_ENTRY_FEE } from './data/arena';
import type { ArenaEntry } from './types';

const STATS = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 };
function mkEntry(period: number, horseId = 'h1'): ArenaEntry {
  const snap = playerSnapshot(horseId, 'テスト', { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, {}, STATS, 'senko', null);
  return { period, seed: 777 + period, horseId, snapshot: snap };
}

beforeEach(() => {
  useStore.getState().resetAll();
  useStore.getState().addCoins(50000);
});

describe('arena store: manual entry', () => {
  it('spends the fee once and blocks a second entry in the same period', () => {
    const before = useStore.getState().coins;
    expect(useStore.getState().arenaEnterManual(mkEntry(100))).toBe(true);
    expect(useStore.getState().coins).toBe(before - ARENA_ENTRY_FEE);
    expect(useStore.getState().arena?.pending?.period).toBe(100);
    // second attempt for the same period is rejected (no extra charge)
    expect(useStore.getState().arenaEnterManual(mkEntry(100))).toBe(false);
    expect(useStore.getState().coins).toBe(before - ARENA_ENTRY_FEE);
  });
});

describe('arena store: resolution + idempotency', () => {
  it('resolves a closed entry into a result exactly once and credits its prize', () => {
    useStore.getState().arenaEnterManual(mkEntry(100));
    const afterEntry = useStore.getState().coins;
    // advance to a later period → the pending entry closes and resolves
    useStore.getState().arenaSync(101, []);
    const st = useStore.getState().arena!;
    expect(st.pending).toBeNull();
    expect(st.results).toHaveLength(1);
    const payout = st.results[0].payout;
    expect(useStore.getState().coins).toBe(afterEntry + payout);
    expect(st.results[0].awarded).toBe(true);
    // re-syncing must NOT double-credit or duplicate the result
    useStore.getState().arenaSync(101, []);
    expect(useStore.getState().coins).toBe(afterEntry + payout);
    expect(useStore.getState().arena!.results).toHaveLength(1);
  });
});

describe('arena store: standing (auto) entry', () => {
  it('auto-enters each new period while funded and piles up results, stopping when broke', () => {
    // give a real horse so auto can snapshot it
    const horse = useStore.getState().addHorse(
      { name: 'あいうま', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} },
      STATS,
    )!;
    const cur = periodId();
    useStore.getState().arenaSetAuto(horse.id);
    // current period: auto enters it (one fee), sets pending
    useStore.getState().arenaSync(cur, []);
    expect(useStore.getState().arena?.pending?.period).toBe(cur);
    const coinsAfterFirst = useStore.getState().coins;
    // jump ahead 3 periods → resolve the pending + auto-enter the intervening closed
    // periods (results pile up), leaving the newest as pending
    useStore.getState().arenaSync(cur + 3, []);
    const st = useStore.getState().arena!;
    expect(st.results.length).toBeGreaterThanOrEqual(3); // 溜まっていく
    expect(st.pending?.period).toBe(cur + 3);
    // fees were charged for the newly entered periods
    expect(useStore.getState().coins).toBeLessThan(coinsAfterFirst);
    // idempotent: same cur again does nothing
    const coinsNow = useStore.getState().coins;
    const nResults = st.results.length;
    useStore.getState().arenaSync(cur + 3, []);
    expect(useStore.getState().coins).toBe(coinsNow);
    expect(useStore.getState().arena!.results.length).toBe(nResults);
  });

  it('stops entering when coins run out', () => {
    const horse = useStore.getState().addHorse(
      { name: 'びんぼう', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} },
      STATS,
    )!;
    // drain coins to less than one fee
    useStore.getState().resetAll();
    useStore.getState().addCoins(ARENA_ENTRY_FEE - 1);
    const h = useStore.getState().addHorse(
      { name: 'びんぼう', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} },
      STATS,
    )!;
    const cur = periodId();
    useStore.getState().arenaSetAuto(h.id);
    useStore.getState().arenaSync(cur, []);
    // not enough for a fee → no entry, coins unchanged
    expect(useStore.getState().coins).toBe(ARENA_ENTRY_FEE - 1);
    expect(useStore.getState().arena?.pending).toBeNull();
    void horse;
  });
});

describe('farm store: idle income + retire', () => {
  it('claimFarm credits accrued coins once and resets the anchor', () => {
    useStore.getState().resetAll();
    useStore.getState().addHorse(
      { name: 'まき', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} },
      { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 },
    );
    // rewind the claim anchor 3 hours → some income should be waiting
    useStore.setState({ farmClaimedAt: Date.now() - 3 * 3600 * 1000 });
    const before = useStore.getState().coins;
    const got = useStore.getState().claimFarm();
    expect(got).toBeGreaterThan(0);
    expect(useStore.getState().coins).toBe(before + got);
    // claiming again immediately yields ~0 (anchor reset)
    expect(useStore.getState().claimFarm()).toBe(0);
  });

  it('retireHorse pays coins, removes the horse and frees the slot', () => {
    useStore.getState().resetAll();
    const h = useStore.getState().addHorse(
      { name: 'いんたい', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {} },
      { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 },
    )!;
    const before = useStore.getState().coins;
    const before_n = useStore.getState().horses.length;
    const got = useStore.getState().retireHorse(h.id);
    expect(got).toBeGreaterThan(0);
    expect(useStore.getState().coins).toBe(before + got);
    expect(useStore.getState().horses.length).toBe(before_n - 1);
    expect(useStore.getState().horses.find((x) => x.id === h.id)).toBeUndefined();
  });
});
