import { describe, it, expect, beforeEach, vi } from 'vitest';
import { colorById, colorSlotById } from './data/parts';
import type { Horse, Stats } from './types';

// 時計は差し替えて操作する（端末の日付を変えられたときの挙動を確かめるため）。
let fakeNow = new Date(2026, 7, 3, 12).getTime(); // 2026-08-03（月）12:00
vi.mock('./logic/trustedClock', async () => {
  const actual = await vi.importActual<typeof import('./logic/trustedClock')>('./logic/trustedClock');
  return { ...actual, trustedNow: () => fakeNow };
});

const { useStore } = await import('./store');

const day = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const STATS: Stats = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 };
function horse(): Horse {
  return {
    id: 'H1', name: 'H1',
    colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' },
    decos: {}, stats: { ...STATS }, createdAt: 0, skill: 'straight_run',
  };
}

describe('ログインボーナス（曜日制）', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    useStore.setState({ coins: 0, refineTickets: 0, dyes: {}, login: undefined });
    fakeNow = day(2026, 8, 3); // 月曜
  });

  it('月曜はコイン。1回もらうと同じ日はもう受け取れない', () => {
    const r = useStore.getState().claimLoginBonus();
    expect(r).toEqual({ kind: 'coins', amount: 1000 });
    expect(useStore.getState().coins).toBe(1000);

    expect(useStore.getState().claimLoginBonus()).toBeNull();
    expect(useStore.getState().coins).toBe(1000); // 二度取りできない
  });

  it('日をまたげば、また受け取れる', () => {
    useStore.getState().claimLoginBonus();
    fakeNow = day(2026, 8, 4); // 火曜
    expect(useStore.getState().claimLoginBonus()).toEqual({ kind: 'coins', amount: 1000 });
    expect(useStore.getState().coins).toBe(2000);
  });

  it('同じ日のあいだは、何時になっても受け取れない', () => {
    useStore.getState().claimLoginBonus();
    fakeNow = day(2026, 8, 3, 23); // 同じ日の23時
    expect(useStore.getState().claimLoginBonus()).toBeNull();
    expect(useStore.getState().coins).toBe(1000);
  });

  it('水曜は厳選チケット', () => {
    fakeNow = day(2026, 8, 5); // 水曜
    expect(useStore.getState().claimLoginBonus()).toEqual({ kind: 'ticket', amount: 1 });
    expect(useStore.getState().refineTickets).toBe(1);
    expect(useStore.getState().coins).toBe(0);
  });

  it('土曜は染料が1つ増える', () => {
    fakeNow = day(2026, 8, 8); // 土曜
    const r = useStore.getState().claimLoginBonus();
    expect(r?.kind).toBe('dye');
    const dyes = useStore.getState().dyes ?? {};
    const ids = Object.keys(dyes);
    expect(ids).toHaveLength(1);
    expect(dyes[ids[0]]).toBe(1);
    expect(colorById[ids[0]]).toBeTruthy(); // 実在する色
  });

  it('日曜も染料。2日ぶん受け取ると合計2つになる', () => {
    fakeNow = day(2026, 8, 8); // 土
    useStore.getState().claimLoginBonus();
    fakeNow = day(2026, 8, 9); // 日
    useStore.getState().claimLoginBonus();
    const total = Object.values(useStore.getState().dyes ?? {}).reduce((a, b) => a + b, 0);
    expect(total).toBe(2);
  });
});

describe('染料をつかう', () => {
  beforeEach(() => {
    useStore.getState().resetAll();
    useStore.setState({ horses: [horse()], team: ['H1'], dyes: {} });
  });

  it('その色の場所（からだ/たてがみ/ひづめ）が塗り替わり、染料が1つ減る', () => {
    // からだの色をひとつ選ぶ（いまの色とは違うもの）
    const target = Object.keys(colorById).find(
      (id) => colorSlotById[id] === 'body' && id !== 'body_bay',
    )!;
    useStore.setState({ dyes: { [target]: 2 } });

    expect(useStore.getState().useDye('H1', target)).toBe(true);
    expect(useStore.getState().horses[0].colors.body).toBe(target);
    expect(useStore.getState().dyes![target]).toBe(1);
    // たてがみ・ひづめは触らない
    expect(useStore.getState().horses[0].colors.mane).toBe('mane_black');
    expect(useStore.getState().horses[0].colors.hoof).toBe('hoof_dark');
  });

  it('使い切ると持ち物から消える', () => {
    const target = Object.keys(colorById).find(
      (id) => colorSlotById[id] === 'mane' && id !== 'mane_black',
    )!;
    useStore.setState({ dyes: { [target]: 1 } });
    expect(useStore.getState().useDye('H1', target)).toBe(true);
    expect(useStore.getState().dyes![target]).toBeUndefined();
  });

  it('持っていない染料は使えない', () => {
    const target = Object.keys(colorById).find((id) => colorSlotById[id] === 'body' && id !== 'body_bay')!;
    expect(useStore.getState().useDye('H1', target)).toBe(false);
    expect(useStore.getState().horses[0].colors.body).toBe('body_bay');
  });

  it('すでに同じ色なら使わない（無駄づかい防止）', () => {
    useStore.setState({ dyes: { body_bay: 1 } });
    expect(useStore.getState().useDye('H1', 'body_bay')).toBe(false);
    expect(useStore.getState().dyes!.body_bay).toBe(1);
  });

  it('居ないウマ・色ではないIDには使えない', () => {
    const target = Object.keys(colorById).find((id) => colorSlotById[id] === 'body' && id !== 'body_bay')!;
    useStore.setState({ dyes: { [target]: 1, head_ribbon: 1 } });
    expect(useStore.getState().useDye('nope', target)).toBe(false);
    expect(useStore.getState().useDye('H1', 'head_ribbon')).toBe(false);
    expect(useStore.getState().dyes![target]).toBe(1);
  });
});
