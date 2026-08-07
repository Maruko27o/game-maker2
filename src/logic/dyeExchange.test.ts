import { describe, it, expect } from 'vitest';
import {
  dupeRows, pickedValue, canExchange, autoPick, spendDupes,
  DYE_EXCHANGE_COST, DUPE_VALUE,
} from './dyeExchange';
import { allParts, partRarity } from '../data/parts';
import type { Rarity } from '../types';

// 図鑑にある実際のパーツからレアさ別に1つずつ拾う（IDを手で書くと増減でずれる）。
const idOf = (r: Rarity) => allParts.find((p) => p.rarity === r)!.id;
const N = idOf('N');
const R = idOf('R');
const SR = idOf('SR');

describe('ダブり→染料の交換', () => {
  it('レアさごとの「個ぶん」は5の倍数（端数が出ない）', () => {
    expect(DUPE_VALUE.N).toBe(1);
    expect(DUPE_VALUE.R).toBe(5);
    expect(DUPE_VALUE.SR).toBe(10);
    for (const v of [DUPE_VALUE.R, DUPE_VALUE.SR]) expect(v % 5).toBe(0);
    // 100個ぶんちょうどで割り切れる＝「あと3個ぶん」のような半端が出ない
    for (const v of Object.values(DUPE_VALUE)) expect(DYE_EXCHANGE_COST % v).toBe(0);
  });

  it('1個目は交換に出せない（図鑑の記録が欠けない）', () => {
    expect(dupeRows({ [N]: 1 })).toEqual([]);
    expect(dupeRows({ [N]: 0 })).toEqual([]);
    const rows = dupeRows({ [N]: 5 });
    expect(rows).toHaveLength(1);
    expect(rows[0].dupes).toBe(4); // 5個持っていて出せるのは4個
  });

  it('レアさに応じた「個ぶん」で数える', () => {
    const rows = dupeRows({ [N]: 3, [R]: 3, [SR]: 3 });
    expect(pickedValue(rows, { [N]: 2 })).toBe(2);
    expect(pickedValue(rows, { [R]: 2 })).toBe(10);
    expect(pickedValue(rows, { [SR]: 2 })).toBe(20);
    expect(pickedValue(rows, { [N]: 2, [R]: 2, [SR]: 2 })).toBe(32);
  });

  it('持っている以上には選べない（数え上げで水増しできない）', () => {
    const rows = dupeRows({ [N]: 3 }); // 出せるのは2個
    expect(pickedValue(rows, { [N]: 999 })).toBe(2);
    expect(pickedValue(rows, { 'not-owned': 999 })).toBe(0);
  });

  it('100個ぶんたまってはじめて交換できる', () => {
    const rows = dupeRows({ [N]: 200 });
    expect(canExchange(rows, { [N]: 99 })).toBe(false);
    expect(canExchange(rows, { [N]: 100 })).toBe(true);
    // SR なら10個、R なら20個で足りる
    const rows2 = dupeRows({ [SR]: 20, [R]: 30 });
    expect(canExchange(rows2, { [SR]: 9 })).toBe(false);
    expect(canExchange(rows2, { [SR]: 10 })).toBe(true);
    expect(canExchange(rows2, { [R]: 20 })).toBe(true);
  });

  it('自動で選ぶと、ちょうど足りる組み合わせになる', () => {
    const rows = dupeRows({ [N]: 60, [R]: 20, [SR]: 5 });
    const picks = autoPick(rows);
    expect(canExchange(rows, picks)).toBe(true);
    // 安いものから詰めるので、レアなダブりは手元に残る
    expect(picks[N]).toBe(59); // 出せる59個ぜんぶ
    expect(picks[SR] ?? 0).toBe(0);
  });

  it('足りないときは何も選ばない（中途半端な状態にしない）', () => {
    const rows = dupeRows({ [N]: 50 }); // 出せるのは49個ぶん
    expect(autoPick(rows)).toEqual({});
    expect(dupeRows({})).toEqual([]);
    expect(autoPick([])).toEqual({});
  });

  it('ちょうど100個ぶんのときも成立する', () => {
    const rows = dupeRows({ [SR]: 11 }); // 出せる10個 × 10 = 100
    const picks = autoPick(rows);
    expect(pickedValue(rows, picks)).toBe(DYE_EXCHANGE_COST);
  });

  it('交換すると選んだぶんだけ減り、1個目は必ず残る', () => {
    const owned = { [N]: 60, [R]: 20, [SR]: 5 };
    const rows = dupeRows(owned);
    const picks = autoPick(rows);
    const next = spendDupes(owned, rows, picks);
    for (const id of Object.keys(owned)) expect(next[id]).toBeGreaterThanOrEqual(1);
    const spent = Object.keys(owned).reduce((n, id) => n + (owned[id] - next[id]) * DUPE_VALUE[partRarity(id)], 0);
    expect(spent).toBeGreaterThanOrEqual(DYE_EXCHANGE_COST);
    // 選んでいないものは減らない
    expect(next[SR]).toBe(owned[SR]);
  });

  it('並びはレアな順（レアなダブりが上に来て気づける）', () => {
    const rows = dupeRows({ [N]: 5, [R]: 5, [SR]: 5 });
    expect(rows.map((r) => r.rarity)).toEqual(['SR', 'R', 'N']);
  });
});
