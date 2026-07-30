import { describe, it, expect } from 'vitest';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES, type Course } from '../data/courses';
import { mcWinProbs } from './odds';
import { selProb, type BetKind } from './betting';
import { makeCpu } from './cpu';
import { mulberry32 } from './stats';

// 倍率の妥当性の回帰ガード（報告バグ：3連単で1.4万倍→次のレースで2万倍が当たった）。
//
// 指標 R ＝「その馬券を1点買い続けたときの1コインあたり期待払戻」
//   R = 平均[ 0.80 / (組合せ数 × モデルが出した的中確率(実際に来た組合せ)) ]
// モデルの確率が正しければ R は TAKEOUT(0.80) に一致する。
// R が大きい＝実際に来る組合せの確率を低く見積もっている＝倍率が高すぎる。
//
// 修正前（素の Harville）は 通常8頭2周で ワイド4.93 / 3連単4.48、
// 3連単の最高当選倍率が 60,144倍 という壊れ方をしていた。
const TAKEOUT = 0.8;

function field(seed: number, size = 8): { entrants: Entrant[]; course: Course } {
  const rng = mulberry32(seed);
  const course = COURSES[Math.floor(rng() * COURSES.length)];
  const entrants: Entrant[] = [];
  for (let i = 0; i < size; i++) entrants.push(makeCpu(`c${i}`, rng, [36, 46], 0.5).entrant);
  return { entrants, course };
}

type Res = Record<BetKind, number> & { maxTrifecta: number };

function measure(races: number, laps: number | undefined, size: number): Res {
  const acc: Record<string, number> = { win: 0, place: 0, quinella: 0, wide: 0, trifecta: 0 };
  let maxTrifecta = 0;
  for (let r = 0; r < races; r++) {
    const { entrants, course } = field(r * 7919 + 13, size);
    const p = mcWinProbs(entrants, course, 60, { laps, samples: 60 });
    // オッズ計算に使っていない別シードで「本番」を1回走らせる
    const [a, b, c] = simulate2(entrants, course, 60, 0x51ee0000 + r, { laps }).order;
    const n = entrants.length;
    const M2 = (n * (n - 1)) / 2;
    const M3 = n * (n - 1) * (n - 2);
    const odds = (kind: BetKind, sel: number[]) => TAKEOUT / Math.max(selProb(kind, sel, p, laps ?? 2), 1e-12);

    acc.win += odds('win', [a]) / n;
    // 的中する選択をすべて数える（複勝=上位3頭・ワイド=その3組）
    for (const i of [a, b, c]) acc.place += odds('place', [i]) / n;
    acc.quinella += odds('quinella', [a, b]) / M2;
    for (const [i, j] of [[a, b], [a, c], [b, c]]) acc.wide += odds('wide', [i, j]) / M2;
    const tri = odds('trifecta', [a, b, c]);
    acc.trifecta += tri / M3;
    maxTrifecta = Math.max(maxTrifecta, tri);
  }
  const out = {} as Res;
  for (const k of ['win', 'place', 'quinella', 'wide', 'trifecta'] as BetKind[]) out[k] = acc[k] / races;
  out.maxTrifecta = maxTrifecta;
  return out;
}

describe('倍率の期待払戻（0.80 が適正）', () => {
  it('どの馬券も 0.80 から大きく外れない（万馬券が当たり続けない）', () => {
    const r = measure(40, undefined, 8); // 通常レース 8頭 2周
    const line = (['win', 'place', 'quinella', 'wide', 'trifecta'] as BetKind[])
      .map((k) => `${k}=${r[k].toFixed(2)}`).join(' ');
    console.log(`通常8頭2周: ${line} / 3連単の最高当選 ${Math.round(r.maxTrifecta).toLocaleString()}倍`);

    // 単勝は生の勝率そのまま（ここが崩れると倍率バランスの前提が壊れる）
    expect(r.win).toBeGreaterThan(0.55);
    expect(r.win).toBeLessThan(1.15);
    // 派生マーケットも同じ帯に収める。修正前は ワイド4.93 / 3連単4.48 だった。
    for (const k of ['place', 'quinella', 'wide', 'trifecta'] as BetKind[]) {
      expect(r[k]).toBeGreaterThan(0.45);
      expect(r[k]).toBeLessThan(1.6);
    }
    // 「当たってしまう万馬券」の上限。修正前は 60,144倍。
    expect(r.maxTrifecta).toBeLessThan(20_000);
  }, 600_000);

  it('1周でも同じ帯に収まる（周回数ごとに補正を変えている）', () => {
    const r = measure(30, 1, 8);
    console.log(`通常8頭1周: 3連単=${r.trifecta.toFixed(2)} ワイド=${r.wide.toFixed(2)} 馬連=${r.quinella.toFixed(2)} 複勝=${r.place.toFixed(2)} / 最高 ${Math.round(r.maxTrifecta).toLocaleString()}倍`);
    for (const k of ['place', 'quinella', 'wide', 'trifecta'] as BetKind[]) {
      expect(r[k]).toBeGreaterThan(0.45);
      expect(r[k]).toBeLessThan(1.6);
    }
  }, 600_000);

  it('3周でも同じ帯に収まる（周回数を変えても壊れない）', () => {
    const r = measure(30, 3, 8);
    console.log(`通常8頭3周: 3連単=${r.trifecta.toFixed(2)} ワイド=${r.wide.toFixed(2)} 馬連=${r.quinella.toFixed(2)} / 最高 ${Math.round(r.maxTrifecta).toLocaleString()}倍`);
    for (const k of ['place', 'quinella', 'wide', 'trifecta'] as BetKind[]) {
      expect(r[k]).toBeGreaterThan(0.4);
      expect(r[k]).toBeLessThan(1.8);
    }
    expect(r.maxTrifecta).toBeLessThan(25_000);
  }, 600_000);

  it('6頭立て（GP予選）でも同じ帯に収まる', () => {
    const r = measure(30, 2, 6);
    console.log(`6頭2周: 3連単=${r.trifecta.toFixed(2)} ワイド=${r.wide.toFixed(2)} 馬連=${r.quinella.toFixed(2)} / 最高 ${Math.round(r.maxTrifecta).toLocaleString()}倍`);
    for (const k of ['place', 'quinella', 'wide', 'trifecta'] as BetKind[]) {
      expect(r[k]).toBeGreaterThan(0.4);
      expect(r[k]).toBeLessThan(1.8);
    }
  }, 600_000);
});
