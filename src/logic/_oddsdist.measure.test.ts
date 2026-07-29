import { describe, it } from 'vitest';
import { mcWinProbs } from './odds';
import { makeCpu } from './cpu';
import { mulberry32 } from './stats';
import { COURSES } from '../data/courses';
import { MAX_ODDS } from './betting';
import type { Entrant } from './raceSim2';

// 計測用（恒久テストではない）。単勝オッズ帯ごとの「勝利発生率」を測り、
// 目標分布と比べる。目標＝ユーザー指定のゲーム用テーブル。

const TAKEOUT = 0.8;
const clampOdds = (o: number) => Math.min(MAX_ODDS, Math.max(1.1, o));
const oddsOf = (p: number) => clampOdds((1 / p) * TAKEOUT);

const BANDS: { lo: number; hi: number; label: string; target: number }[] = [
  { lo: 1.0, hi: 2.0, label: '1.0-1.9', target: 13.0 },
  { lo: 2.0, hi: 3.0, label: '2.0-2.9', target: 14.0 },
  { lo: 3.0, hi: 5.0, label: '3.0-4.9', target: 18.0 },
  { lo: 5.0, hi: 7.0, label: '5.0-6.9', target: 13.0 },
  { lo: 7.0, hi: 10.0, label: '7.0-9.9', target: 12.0 },
  { lo: 10, hi: 15, label: '10-14.9', target: 11.0 },
  { lo: 15, hi: 20, label: '15-19.9', target: 6.5 },
  { lo: 20, hi: 30, label: '20-29.9', target: 5.0 },
  { lo: 30, hi: 50, label: '30-49.9', target: 3.8 },
  { lo: 50, hi: 80, label: '50-79.9', target: 2.2 },
  { lo: 80, hi: 100, label: '80-99.9', target: 0.8 },
  { lo: 100, hi: 150, label: '100-149', target: 0.9 },
  { lo: 150, hi: 200, label: '150-199', target: 0.4 },
  { lo: 200, hi: 300, label: '200-299', target: 0.3 },
  { lo: 300, hi: Infinity, label: '300+', target: 0.1 },
];

function field(rng: () => number): { entrants: Entrant[]; course: (typeof COURSES)[number] } {
  const course = COURSES[Math.floor(rng() * COURSES.length)];
  const pt = 34 + Math.floor(rng() * 15);
  const wide = process.env.DIST_MIX === '1';
  const entrants: Entrant[] = [];
  if (wide) {
    // 「強い1〜2・中位4〜5・弱い1〜2」を混ぜた構成（本命/中穴/大穴が自然に出る）
    const tiers: [number, number][] = [
      [pt + 2, pt + 6], [pt, pt + 4],
      [pt - 2, pt + 2], [pt - 2, pt + 2], [pt - 3, pt + 1], [pt - 4, pt],
      [pt - 12, pt - 6], [pt - 18, pt - 11],
    ];
    for (let i = 0; i < 8; i++) {
      const b: [number, number] = [Math.max(24, tiers[i][0]), Math.min(48, Math.max(25, tiers[i][1]))];
      entrants.push(makeCpu(`h${i}`, rng, b, 0.3).entrant);
    }
  } else {
    const band: [number, number] = [Math.max(34, pt - 4), Math.min(48, pt + 4)];
    for (let i = 0; i < 8; i++) entrants.push(makeCpu(`h${i}`, rng, band, 0.3).entrant);
  }
  return { entrants, course };
}

describe('odds distribution vs target', () => {
  it('measures', () => {
    const rng = mulberry32(20260101);
    const N = Number(process.env.DIST_N ?? 40);
    // 各オッズ帯に入る「勝率の総和」を積む＝その帯から勝ちが出る割合。
    const mass = new Array(BANDS.length).fill(0);
    let total = 0;
    const favs: number[] = [];
    const longs: number[] = [];
    for (let f = 0; f < N; f++) {
      const { entrants, course } = field(rng);
      const ps = mcWinProbs(entrants, course, 60, { samples: 120 });
      const odds = ps.map(oddsOf);
      favs.push(Math.min(...odds));
      longs.push(Math.max(...odds));
      for (let i = 0; i < ps.length; i++) {
        const o = odds[i];
        const bi = BANDS.findIndex((b) => o >= b.lo && o < b.hi);
        if (bi >= 0) mass[bi] += ps[i];
        total += ps[i];
      }
    }
    const med = (a: number[]) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const rows = BANDS.map((b, i) => ({
      band: b.label,
      got: +((mass[i] / total) * 100).toFixed(1),
      target: b.target,
    }));
    console.log('N=' + N + ' races');
    console.log(JSON.stringify(rows));
    console.log('favMed=' + med(favs).toFixed(2), 'longMed=' + med(longs).toFixed(1), 'max=' + Math.max(...longs).toFixed(1));
    // 目標との差の合計（小さいほど近い）
    const err = rows.reduce((n, r) => n + Math.abs(r.got - r.target), 0);
    console.log('total abs error =', err.toFixed(1));
  }, 600000);
});
