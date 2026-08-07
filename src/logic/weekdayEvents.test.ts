import { describe, it, expect } from 'vitest';
import {
  eventLive, grassRegenMs, okawariCost, trainingGain, ticketDayBonus,
  srRateMul, prefersUnowned, g1Attempts, arenaPrizeMul,
  TICKET_DAY_MIN_ODDS, TICKET_DAY_MAX_RATE, TICKET_DAY_MAX_BONUS,
} from './weekdayEvents';
import { dowOfTime } from '../data/events';
import { ENERGY_REGEN_MS, normalizeEnergy } from './energy';
import { applyTraining, trainingRoom } from './training';
import { pickOne, RARITY_WEIGHT, UNOWNED_MUL } from './gacha';
import { arenaPrize } from '../data/arena';
import { mulberry32 } from './stats';
import type { Stats } from '../types';

// 2026-08-03 は月曜。そこから1日ずつずらして各曜日の正午を作る。
const MON = new Date('2026-08-03T12:00:00Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
/** 0=日 … 6=土 の曜日ちょうどの時刻。 */
function at(dow: number): number {
  for (let i = 0; i < 7; i++) {
    const t = MON + i * DAY;
    if (dowOfTime(t) === dow) return t;
  }
  throw new Error('曜日が見つからない');
}

describe('曜日イベントの効果', () => {
  it('その日のイベントだけが有効（他の曜日には効かない）', () => {
    for (let d = 0; d < 7; d++) {
      expect(eventLive(at(d), d)).toBe(true);
      const other = (d + 1) % 7;
      expect(eventLive(at(d), other)).toBe(false);
    }
  });

  // ── 月：草むらデー ──
  it('月曜はストックが30分でたまり、おかわりが半額', () => {
    expect(grassRegenMs(at(1), ENERGY_REGEN_MS)).toBe(ENERGY_REGEN_MS / 2);
    expect(okawariCost(at(1), 300)).toBe(150);
    // 他の曜日は据え置き
    expect(grassRegenMs(at(2), ENERGY_REGEN_MS)).toBe(ENERGY_REGEN_MS);
    expect(okawariCost(at(2), 300)).toBe(300);
  });

  it('月曜は同じ放置時間で2倍たまる', () => {
    const start = { energy: 0, energyUpdatedAt: 0 };
    const threeHours = 3 * ENERGY_REGEN_MS;
    expect(normalizeEnergy(start, threeHours, ENERGY_REGEN_MS).energy).toBe(3);
    expect(normalizeEnergy(start, threeHours, ENERGY_REGEN_MS / 2).energy).toBe(6);
  });

  // ── 火：トレーニングデー ──
  it('火曜はまぐれで2つ上がる（他の曜日は必ず1）', () => {
    const rng = mulberry32(1);
    let two = 0;
    for (let i = 0; i < 20000; i++) if (trainingGain(at(2), rng, 10) === 2) two++;
    expect(two / 20000).toBeGreaterThan(0.2);
    expect(two / 20000).toBeLessThan(0.3);
    for (let i = 0; i < 200; i++) expect(trainingGain(at(3), rng, 10)).toBe(1);
  });

  it('合計48の上限は超えない（あと1しか入らないときは +1 のまま）', () => {
    const rng = () => 0; // 必ずまぐれを引く乱数
    expect(trainingGain(at(2), rng, 1)).toBe(1);
    expect(trainingGain(at(2), rng, 0)).toBe(0);

    // 合計47のウマ。+2 を渡しても 48 で止まる。
    const stats: Stats = { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 7 };
    expect(trainingRoom(stats, 'wit')).toBe(1);
    const next = applyTraining(stats, 'wit', 2)!;
    expect(next.wit).toBe(8);
    expect(Object.values(next).reduce((a, b) => a + b, 0)).toBe(48);
  });

  it('1項目の上限10も超えない', () => {
    const stats: Stats = { spd: 9, sta: 7, pwr: 7, jmp: 7, gut: 7, wit: 7 };
    const next = applyTraining(stats, 'spd', 2)!;
    expect(next.spd).toBe(10);
  });

  // ── 水：万馬券デー ──
  it('水曜は10倍以上の的中にだけ上乗せがつく', () => {
    const w = at(3);
    expect(ticketDayBonus(w, TICKET_DAY_MIN_ODDS - 0.1, 10000)).toBe(0); // 10倍未満は対象外
    expect(ticketDayBonus(w, 10, 10000)).toBe(500); // 5%
    expect(ticketDayBonus(w, 100, 10000)).toBe(3000); // 上限の30%
    expect(ticketDayBonus(w, 30000, 10000)).toBe(10000 * TICKET_DAY_MAX_RATE); // どこまでも増えない
    expect(ticketDayBonus(w, 50, 0)).toBe(0); // はずれには付かない
    expect(ticketDayBonus(at(4), 100, 10000)).toBe(0); // 他の曜日は0
  });

  it('1レースの上乗せには絶対額の上限がある（コイン経済を壊さない歯止め）', () => {
    const w = at(3);
    // 率だけの上限では歯止めにならない。3連単は1周で最高4,991倍まで出るので、
    // 1000コイン賭けの的中で払戻 4,991,000 → 30% なら約150万コインが一撃で入る。
    const huge = ticketDayBonus(w, 4991, 4_991_000);
    expect(huge).toBe(TICKET_DAY_MAX_BONUS);
    expect(huge).toBeLessThan(1_497_300); // 上限が無かったころの額
    // ふだんの当たり（払戻10万コイン級）は上限に当たらないので体感が変わらない
    expect(ticketDayBonus(w, 100, 100_000)).toBe(30_000);
    // 上限にちょうど届くのは払戻 166,667コイン（30%）あたりから
    expect(ticketDayBonus(w, 100, 166_666)).toBe(49_999);
    expect(ticketDayBonus(w, 100, 200_000)).toBe(TICKET_DAY_MAX_BONUS);
  });

  it('上乗せは倍率が高いほど大きい（単調）', () => {
    const w = at(3);
    let prev = -1;
    for (const odds of [10, 20, 40, 80, 100, 500]) {
      const b = ticketDayBonus(w, odds, 10000);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  // ── 木：図鑑デー ──
  it('木曜は SR が2倍出やすく、未所持が優先される', () => {
    expect(srRateMul(at(4))).toBe(2);
    expect(prefersUnowned(at(4))).toBe(true);
    expect(srRateMul(at(5))).toBe(1);
    expect(prefersUnowned(at(5))).toBe(false);

    const pool = [
      { id: 'n1', rarity: 'N' as const },
      { id: 'r1', rarity: 'R' as const },
      { id: 's1', rarity: 'SR' as const },
    ];
    const count = (opts?: Parameters<typeof pickOne>[2]) => {
      const rng = mulberry32(7);
      let sr = 0;
      for (let i = 0; i < 60000; i++) if (pickOne(rng, pool, opts).rarity === 'SR') sr++;
      return sr / 60000;
    };
    const base = count();
    const doubled = count({ srMul: 2 });
    expect(base).toBeCloseTo(RARITY_WEIGHT.SR / 100, 2);
    expect(doubled).toBeGreaterThan(base * 1.7);
  });

  it('図鑑が埋まってきた人ほど未所持優先の効きが分かる（終盤で体感がある）', () => {
    // 100種のうち90種を所持している状態で「引いた1つが未所持である確率」。
    // 重み2倍のころは 9.2% → 16.8% で、いちばん効いてほしい終盤に体感が無かった。
    const pool = Array.from({ length: 100 }, (_, i) => ({ id: `p${i}`, rarity: 'N' as const }));
    const owned: Record<string, number> = {};
    for (let i = 0; i < 90; i++) owned[`p${i}`] = 1;
    const rate = (opts?: Parameters<typeof pickOne>[2]) => {
      const rng = mulberry32(11);
      let hit = 0;
      for (let i = 0; i < 60000; i++) if (!owned[pickOne(rng, pool, opts).id]) hit++;
      return hit / 60000;
    };
    const plain = rate();
    const dexDay = rate({ owned });
    expect(plain).toBeCloseTo(0.1, 2);
    // 理論値 10*MUL / (90 + 10*MUL)。MUL=4 なら約30.8%
    expect(dexDay).toBeCloseTo((10 * UNOWNED_MUL) / (90 + 10 * UNOWNED_MUL), 2);
    expect(dexDay).toBeGreaterThan(0.25); // 終盤でもはっきり効く
  });

  it('未所持のパーツの重みが UNOWNED_MUL 倍になる', () => {
    const pool = [
      { id: 'a', rarity: 'N' as const },
      { id: 'b', rarity: 'N' as const },
    ];
    const rng = mulberry32(3);
    let b = 0;
    // a は所持済み、b は未所持
    for (let i = 0; i < 60000; i++) if (pickOne(rng, pool, { owned: { a: 1 } }).id === 'b') b++;
    expect(b / 60000).toBeCloseTo(UNOWNED_MUL / (1 + UNOWNED_MUL), 2);
  });

  // ── 金：グランプリデー ──
  it('金曜はG1が6回、対戦の優勝賞金が1.5倍', () => {
    expect(g1Attempts(at(5), 3)).toBe(6);
    expect(g1Attempts(at(4), 3)).toBe(3);
    expect(arenaPrizeMul(at(5))).toBe(1.5);
    expect(arenaPrize('champion', 1, arenaPrizeMul(at(5)))).toBe(18000);
    // 優勝以外と、他の曜日は据え置き
    expect(arenaPrize('final', 2, arenaPrizeMul(at(5)))).toBe(5000);
    expect(arenaPrize('champion', 1, arenaPrizeMul(at(4)))).toBe(12000);
  });
});
