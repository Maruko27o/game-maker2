import { describe, it, expect } from 'vitest';
import { allCandidates, pickInOddsRange, oddsFor, fmtOdds } from './betting';
import { CUSTOM_BET, normalizeCustomBet } from '../data/customBet';

// 8頭ぶんのそれらしい勝率（合計1）
const P = [0.30, 0.20, 0.15, 0.12, 0.09, 0.07, 0.04, 0.03];

describe('カスタムベットの買い目さがし', () => {
  it('数え上げは5種類ぜんぶを含み、既存の倍率計算と一致する', () => {
    const cands = allCandidates(P, 2);
    const kinds = new Set(cands.map((c) => c.kind));
    expect(kinds).toEqual(new Set(['win', 'place', 'quinella', 'wide', 'trifecta']));
    // 8頭なら 単勝8 + 複勝8 + 馬連28 + ワイド28 + 3連単336
    expect(cands.length).toBe(8 + 8 + 28 + 28 + 336);
    // 抜き取りで oddsFor と突き合わせる（別経路で同じ値になること）
    for (const c of [cands[0], cands[20], cands[100], cands[300]]) {
      expect(c.odds).toBeCloseTo(oddsFor(c.kind, c.sel, P, 2), 6);
    }
  });

  it('指定した範囲の倍率だけが返る', () => {
    for (const [lo, hi] of [[1, 3], [3, 4], [10, 50], [100, 1000]] as [number, number][]) {
      for (let i = 0; i < 20; i++) {
        const hit = pickInOddsRange(P, 2, lo, hi, Math.random);
        if (!hit) continue;
        expect(hit.odds).toBeGreaterThanOrEqual(lo);
        expect(hit.odds).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('組めない範囲では null（＝「その倍率は組めません」）', () => {
    // 1.0倍ちょうどより下は存在しない（下限が元返し）
    expect(pickInOddsRange(P, 2, 0.1, 0.5, Math.random)).toBeNull();
  });

  it('候補が複数あるときは毎回同じものにならない（ランダムに選ぶ）', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const hit = pickInOddsRange(P, 2, 5, 60, Math.random);
      if (hit) seen.add(`${hit.kind}:${hit.sel.join(',')}`);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('表示倍率でも範囲から外れない（切り捨て表示との食い違いを防ぐ）', () => {
    for (let i = 0; i < 40; i++) {
      const hit = pickInOddsRange(P, 2, 3, 4, Math.random);
      if (!hit) continue;
      expect(Number(fmtOdds(hit.odds))).toBeLessThanOrEqual(4);
    }
  });
});

describe('カスタムベットの設定値', () => {
  it('金額は100〜5000の100きざみに丸まる', () => {
    expect(normalizeCustomBet({ amount: 137, minOdds: 2, maxOdds: 5 }).amount).toBe(100);
    expect(normalizeCustomBet({ amount: 199, minOdds: 2, maxOdds: 5 }).amount).toBe(100);
    expect(normalizeCustomBet({ amount: 250, minOdds: 2, maxOdds: 5 }).amount).toBe(200);
    expect(normalizeCustomBet({ amount: 99, minOdds: 2, maxOdds: 5 }).amount).toBe(CUSTOM_BET.amountMin);
    expect(normalizeCustomBet({ amount: 99999, minOdds: 2, maxOdds: 5 }).amount).toBe(CUSTOM_BET.amountMax);
  });

  it('倍率は1〜10000の整数で、下限が上限を超えない', () => {
    const a = normalizeCustomBet({ amount: 500, minOdds: 3.7, maxOdds: 4.2 });
    expect(a.minOdds).toBe(3);
    expect(a.maxOdds).toBe(4);
    const b = normalizeCustomBet({ amount: 500, minOdds: 900, maxOdds: 5 });
    expect(b.minOdds).toBeLessThanOrEqual(b.maxOdds);
    const c = normalizeCustomBet({ amount: 500, minOdds: 0, maxOdds: 99999 });
    expect(c.minOdds).toBe(CUSTOM_BET.oddsMin);
    expect(c.maxOdds).toBe(CUSTOM_BET.oddsMax);
  });
});
