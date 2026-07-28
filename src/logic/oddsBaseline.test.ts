import { describe, it, expect } from 'vitest';
import { mcWinProbs } from './odds';
import { makeCpu } from './cpu';
import { mulberry32 } from './stats';
import { COURSES } from '../data/courses';
import { MAX_ODDS } from './betting';
import type { Entrant } from './raceSim2';

// 倍率バランスの基準（回帰ガード）。
// 「今のレースの倍率とそれに伴う勝率（高倍率がたまに出る塩梅）は丁度いい」という
// 大前提を守るための物差し。個体値・スキル・適性などをシムに接続する将来の変更が、
// この分布を壊していないかを検知する。パドックと同じ mcWinProbs（実シムのモンテカルロ）
// から単勝オッズを求め、多数のランダム8頭立てレースで分布を測る。決定的（固定シード）。
//
// 現状の実測（60レース時）:
//   favorite(各レース最低オッズ)  median≈2.6  p90≈3.4
//   longshot(各レース最高オッズ)  median≈51   max≈102
//   高倍率の出現: longshot>30 ≈82% / >60 ≈37% / 全オッズ中 >100 ≈5.8%
// バンドは将来のシム変更の“崩れ”を捕らえつつ、サンプル揺らぎで誤検知しない幅に設定。

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
const p10 = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length * 0.1)];

describe('odds balance baseline (倍率バランスの回帰ガード)', () => {
  it('keeps the favorite/longshot spread and the rare-high-odds feel', () => {
    const rng = mulberry32(20260101);
    const N = 24;
    const favs: number[] = [];
    const longs: number[] = [];
    let allN = 0;
    let over30 = 0;
    let over100 = 0;
    for (let f = 0; f < N; f++) {
      const { entrants, course } = field(rng);
      const odds = mcWinProbs(entrants, course, 60, { samples: 120 }).map(oddsOf);
      favs.push(Math.min(...odds));
      longs.push(Math.max(...odds));
      allN += odds.length;
      over100 += odds.filter((o) => o > 100).length;
      if (Math.max(...odds) > 30) over30++;
    }
    const favMed = median(favs);
    const longMed = median(longs);
    const overallMax = Math.max(...longs);
    const pctRacesLong30 = (over30 / N) * 100;
    const pctAll100 = (over100 / allN) * 100;

    // 人気馬（本命）は概ね 2〜3倍台。1倍台に張り付く（超一強）でも、平坦（本命でも高倍率）でもない。
    expect(favMed).toBeGreaterThan(2.0);
    expect(favMed).toBeLessThan(3.4);
    expect(p90(favs)).toBeLessThan(6); // 本命がいないレースにならない
    // 大穴（穴馬）は数十倍〜100倍前後。明確な穴が常に存在するが、暴走もしない。
    expect(longMed).toBeGreaterThan(30);
    expect(longMed).toBeLessThan(75);
    expect(p10(longs)).toBeGreaterThan(8); // 「全馬横一線」にならない
    expect(overallMax).toBeGreaterThan(70); // 高倍率は“たまに”ちゃんと出る
    expect(overallMax).toBeLessThan(150); // が、極端には出ない（現状 ~102）
    // 高倍率の出現頻度が現状の塩梅から大きくズレない。
    expect(pctRacesLong30).toBeGreaterThan(55);
    expect(pctRacesLong30).toBeLessThan(97);
    expect(pctAll100).toBeGreaterThan(1);
    expect(pctAll100).toBeLessThan(14);
  }, 120000);
});
