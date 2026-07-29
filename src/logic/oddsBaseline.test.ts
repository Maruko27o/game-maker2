import { describe, it, expect } from 'vitest';
import { mcWinProbs } from './odds';
import { makeCpu } from './cpu';
import { mulberry32 } from './stats';
import { COURSES } from '../data/courses';
import { MAX_ODDS } from './betting';
import type { Entrant } from './raceSim2';

// 倍率バランスの回帰ガード。
//
// 目標（ゲーム用の単勝オッズ帯ごとの勝利発生率）:
//   1.0-1.9  13% / 2.0-2.9 14% / 3.0-4.9 18% / 5.0-6.9 13% / 7.0-9.9 12%
//   10-14.9  11% / 15-19.9 6.5% / 20-29.9  5% / 30-49.9 3.8% / 50-79.9 2.2%
//   80-99.9 0.8% / 100-149 0.9% / 150-199 0.4% / 200-299 0.3% / 300+   0.1%
//
// 狙いは
//   ・本命は2〜3倍台（1倍台に張り付く超一強でも、平坦＝本命不在でもない）
//   ・中位が厚い（5〜15倍に手が届く馬が複数いる）
//   ・大穴が段階的に並ぶ（50倍・100倍・200倍…が別々に出る）
//   ・「100倍以上の大波乱」がちゃんと起こりうる
// バンドはサンプル揺らぎで誤検知しない幅にしてある（狭めすぎると毎回落ちる）。
//
// ※ 以前は約100倍が単勝の上限だった。これはレースではなく確率計算の平滑化による
//   人工的な天井で、勝てなかった馬が全員まったく同じ値に潰れていた。能力に比例した
//   事前分布での平滑化に変えたことで、いまは裾がなだらかに解ける。

const TAKEOUT = 0.8;
const clampOdds = (o: number) => Math.min(MAX_ODDS, Math.max(1.1, o));
const oddsOf = (p: number) => clampOdds((1 / p) * TAKEOUT);

function field(rng: () => number): { entrants: Entrant[]; course: (typeof COURSES)[number] } {
  const course = COURSES[Math.floor(rng() * COURSES.length)];
  const pt = 34 + Math.floor(rng() * 15); // 合計 34..48（単走レース相当の帯）
  const band: [number, number] = [Math.max(34, pt - 4), Math.min(48, pt + 4)];
  const entrants: Entrant[] = [];
  for (let i = 0; i < 8; i++) entrants.push(makeCpu(`h${i}`, rng, band, 0.3).entrant);
  return { entrants, course };
}
const median = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const p90 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.9)];

describe('odds balance baseline (倍率バランスの回帰ガード)', () => {
  it('keeps the favourite/mid/longshot shape and lets big upsets happen', () => {
    const rng = mulberry32(20260101);
    const N = 24;
    const favs: number[] = [];
    const longs: number[] = [];
    // オッズ帯ごとの「勝率の総和」＝その帯から勝ちが出る割合。
    let mLow = 0; // 1.0-4.9倍（本命〜対抗）
    let mMid = 0; // 5.0-14.9倍（3〜5番人気・中穴）
    let mHigh = 0; // 15-49.9倍（穴馬）
    let mLong = 0; // 50倍以上（大穴）
    let total = 0;
    for (let f = 0; f < N; f++) {
      const { entrants, course } = field(rng);
      const ps = mcWinProbs(entrants, course, 60, { samples: 120 });
      const odds = ps.map(oddsOf);
      favs.push(Math.min(...odds));
      longs.push(Math.max(...odds));
      for (let i = 0; i < ps.length; i++) {
        const o = odds[i];
        if (o < 5) mLow += ps[i];
        else if (o < 15) mMid += ps[i];
        else if (o < 50) mHigh += ps[i];
        else mLong += ps[i];
        total += ps[i];
      }
    }
    const pct = (x: number) => (x / total) * 100;
    const favMed = median(favs);
    const longMed = median(longs);
    const overallMax = Math.max(...longs);

    // 本命：2〜3倍台。
    expect(favMed).toBeGreaterThan(1.8);
    expect(favMed).toBeLessThan(3.6);
    expect(p90(favs)).toBeLessThan(6); // 本命がいないレースにならない

    // 大穴：数十〜数百倍。ここが潰れていない＝裾がちゃんと解けている。
    expect(longMed).toBeGreaterThan(60);
    expect(longMed).toBeLessThan(900);
    expect(overallMax).toBeGreaterThan(150); // 「100倍以上の大波乱」が起こりうる
    expect(overallMax).toBeLessThan(5000); // が、青天井にはしない

    // 勝ちの出どころの形。目標は 1-4.9=45% / 5-14.9=36% / 15-49.9=15.3% / 50+=4.7%。
    expect(pct(mLow)).toBeGreaterThan(45);
    expect(pct(mLow)).toBeLessThan(78); // 本命ばかりに寄りすぎない
    expect(pct(mMid)).toBeGreaterThan(14); // 中位が薄くなりすぎない
    expect(pct(mHigh)).toBeGreaterThan(2); // 穴馬からも勝ちが出る
    expect(pct(mLong)).toBeGreaterThan(0.1); // 大穴からも（まれに）勝ちが出る
    expect(pct(mLong)).toBeLessThan(8); // が、大穴だらけにはしない
  }, 180000);
});
