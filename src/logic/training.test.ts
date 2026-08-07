import { describe, it, expect } from 'vitest';
import {
  canApply, applyTraining, canTrim, applyTrim, isPityHit, rollTraining,
  TRAIN_PITY_AFTER, STAT_MIN,
} from './training';
import {
  trimCost, TRIM_COST, TRIM_COST_DAY,
  TRAINING_SUCCESS_RATE, TRAINING_SUCCESS_RATE_DAY,
} from './weekdayEvents';
import { mulberry32 } from './stats';
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

describe('成功・失敗（アイテムを入れれば必ず上がる、をやめた）', () => {
  it('確率どおりに成功する（ふだん50%・トレーニングデー75%）', () => {
    for (const rate of [TRAINING_SUCCESS_RATE, TRAINING_SUCCESS_RATE_DAY]) {
      const rng = mulberry32(4242);
      const n = 200_000;
      let ok = 0;
      // misses は毎回0（＝救済が効かない状態）で、素の確率を見る
      for (let i = 0; i < n; i++) if (rollTraining(rng, rate, 0)) ok++;
      const mu = n * rate;
      const band = 4 * Math.sqrt(n * rate * (1 - rate));
      expect(ok).toBeGreaterThan(mu - band);
      expect(ok).toBeLessThan(mu + band);
    }
  });

  it('2回つづけて失敗したら次は必ず成功（理不尽にしない）', () => {
    expect(isPityHit(0)).toBe(false);
    expect(isPityHit(TRAIN_PITY_AFTER - 1)).toBe(false);
    expect(isPityHit(TRAIN_PITY_AFTER)).toBe(true);
    // 乱数がずっと外れを返しても、救済が効いていれば成功する
    const alwaysMiss = () => 0.999999;
    expect(rollTraining(alwaysMiss, 0.5, TRAIN_PITY_AFTER)).toBe(true);
    expect(rollTraining(alwaysMiss, 0.5, TRAIN_PITY_AFTER - 1)).toBe(false);
  });

  it('3回押せば必ず1回は成功する（最悪でも失敗2回まで）', () => {
    // 失敗が続いても3回目には必ず上がる、を回数で確かめる
    const alwaysMiss = () => 0.999999;
    let misses = 0;
    const got: boolean[] = [];
    for (let i = 0; i < 9; i++) {
      const ok = rollTraining(alwaysMiss, 0.5, misses);
      got.push(ok);
      misses = ok ? 0 : misses + 1;
    }
    expect(got).toEqual([false, false, true, false, false, true, false, false, true]);
  });
});

describe('調整（−1）', () => {
  it('1つ下げると合計も1つ減る（別の項目に振り直せる）', () => {
    const s = applyTrim(base, 'spd')!;
    expect(s.spd).toBe(base.spd - 1);
    expect(statTotal(s)).toBe(statTotal(base) - 1);
    // 減ったぶん、上限まで余裕ができている＝振り直せる
    expect(canApply(s, 'gut')).toBe(true);
  });

  it('1より下には下げられない（脚質やレースの計算が壊れるため）', () => {
    const s: Stats = { ...base, gut: STAT_MIN };
    expect(canTrim(s, 'gut')).toBe(false);
    expect(applyTrim(s, 'gut')).toBeNull();
    expect(canTrim(s, 'spd')).toBe(true);
  });

  it('上限いっぱいのウマでも調整できる（詰んだ状態から抜けられる）', () => {
    const full: Stats = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 }; // 48
    for (const k of Object.keys(full) as (keyof Stats)[]) expect(canApply(full, k)).toBe(false);
    const s = applyTrim(full, 'wit')!;
    expect(canApply(s, 'spd')).toBe(true); // 振り直す先ができた
  });

  it('もとの stats を書き換えない', () => {
    const snap = { ...base };
    applyTrim(base, 'spd');
    expect(base).toEqual(snap);
  });

  it('曜日で値段が変わる（火曜は半分）', () => {
    const at = (dow: number) => {
      const d = new Date('2026-08-02T12:00:00Z'); // 日曜
      d.setUTCDate(d.getUTCDate() + dow);
      return d.getTime();
    };
    expect(trimCost(at(2))).toBe(TRIM_COST_DAY); // 火曜
    expect(trimCost(at(3))).toBe(TRIM_COST); // 水曜
    expect(TRIM_COST_DAY * 2).toBe(TRIM_COST);
  });
});
