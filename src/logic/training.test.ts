import { describe, it, expect } from 'vitest';
import { canApply, applyTraining } from './training';
import { statTotal } from './stats';
import type { Stats } from '../types';

const base: Stats = { spd: 5, sta: 5, pwr: 5, jmp: 5, gut: 3, wit: 3 }; // total 26

describe('canApply', () => {
  it('rejects a stat already at 10', () => {
    const s: Stats = { ...base, spd: 10 };
    expect(canApply(s, 'spd')).toBe(false);
    expect(canApply(s, 'sta')).toBe(true);
  });

  it('rejects every stat when total is at the 48 cap', () => {
    const s: Stats = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 }; // 48
    for (const k of Object.keys(s) as (keyof Stats)[]) expect(canApply(s, k)).toBe(false);
  });

  it('allows a raise at total 47 then blocks at 48', () => {
    const s: Stats = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 7 }; // 47
    expect(canApply(s, 'wit')).toBe(true);
    const s2 = applyTraining(s, 'wit')!;
    expect(statTotal(s2)).toBe(48);
    expect(canApply(s2, 'spd')).toBe(false);
    expect(canApply(s2, 'wit')).toBe(false);
  });
});

describe('applyTraining', () => {
  it('raises the target stat by exactly 1', () => {
    const s = applyTraining(base, 'gut')!;
    expect(s.gut).toBe(4);
    expect(statTotal(s)).toBe(statTotal(base) + 1);
  });

  it('returns null when not allowed (no mutation)', () => {
    const s: Stats = { ...base, jmp: 10 };
    expect(applyTraining(s, 'jmp')).toBeNull();
  });

  it('does not mutate the input', () => {
    const snap = { ...base };
    applyTraining(base, 'spd');
    expect(base).toEqual(snap);
  });
});
