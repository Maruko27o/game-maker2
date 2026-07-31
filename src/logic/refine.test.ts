import { describe, it, expect } from 'vitest';
import { arenaTickets, canRefine, refineState, canRefineNow, REFINE_MAX } from './refine';
import { COURSES } from '../data/courses';
import type { Horse } from '../types';

const H = (over: Partial<Horse> = {}): Horse => ({
  id: 'h1', name: 'h1', colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' }, decos: {},
  stats: { spd: 10, sta: 6, pwr: 6, jmp: 6, gut: 6, wit: 6 }, createdAt: 0,
  skill: 'straight_run',
  apt: Object.fromEntries(COURSES.map((c) => [c.id, 'C'])),
  ...over,
});

describe('厳選チケット（対戦の入賞でもらえる）', () => {
  it('優勝3枚・準優勝2枚・3位1枚', () => {
    expect(arenaTickets('champion', 1)).toBe(3);
    expect(arenaTickets('final', 2)).toBe(2);
    expect(arenaTickets('final', 3)).toBe(1);
  });

  it('本戦4位以下・予選敗退は0枚', () => {
    expect(arenaTickets('final', 4)).toBe(0);
    expect(arenaTickets('final', 8)).toBe(0);
    expect(arenaTickets('q2out', null)).toBe(0);
    expect(arenaTickets('q1out', null)).toBe(0);
  });
});

describe('厳選の回数（全ウマ最大3回）', () => {
  it('どのウマも3回。新しく召喚したウマ（gen2）も対象', () => {
    expect(refineState(H()).rights).toBe(REFINE_MAX);
    expect(refineState(H({ gen2: true })).rights).toBe(3);
    expect(canRefine(H({ gen2: true }))).toBe(true);
  });

  it('使うたびに残りが減り、3回で打ち止め', () => {
    expect(refineState(H({ refineUsed: 0 })).left).toBe(3);
    expect(refineState(H({ refineUsed: 1 })).left).toBe(2);
    expect(refineState(H({ refineUsed: 3 })).left).toBe(0);
    expect(refineState(H({ refineUsed: 99 })).left).toBe(0); // 壊れた値でも増えない
  });

  it('旧仕様で厳選したことがあるウマは対象外（使い切り扱い）', () => {
    expect(canRefine(H({ rerollsUsed: 1 }))).toBe(false);
    expect(refineState(H({ rerollsUsed: 1 })).rights).toBe(0);
    expect(refineState(H({ rerollsUsed: 5 })).left).toBe(0);
  });

  it('旧仕様を1回も使っていないウマだけがチケットを使える', () => {
    expect(canRefine(H({ rerollsUsed: 0 }))).toBe(true);
    expect(canRefine(H())).toBe(true); // 未設定＝0回
  });

  it('チケットが無ければ、残り回数があっても振り直せない', () => {
    expect(canRefineNow(H(), 0)).toBe(false);
    expect(canRefineNow(H(), 1)).toBe(true);
    expect(canRefineNow(H({ refineUsed: 3 }), 99)).toBe(false);
    expect(canRefineNow(H({ rerollsUsed: 2 }), 99)).toBe(false);
  });
});
