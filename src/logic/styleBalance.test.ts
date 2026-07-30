import { describe, it, expect } from 'vitest';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES } from '../data/courses';
import { mulberry32, rollStatsForStyle } from './stats';
import { paceAt, paceCurve } from './runStyle';
import type { RunStyle } from '../types';

// 脚質バランスの回帰ガード。
//
// 報告：「逃げのウマを引くとほぼ勝てない」。実測すると 2周（標準距離）の勝率が
//   逃げ 2.9% ／ 先行39.6% ／ 差し18.3% ／ 追込39.2%（各脚質2頭なので均等は25%）
// で、逃げが構造的に勝てない状態だった。原因は2つ：
//   ① ペース曲線の調和平均（＝走破時計を決める量）が揃っておらず、逃げだけ約2.7%遅かった
//   ② 終盤の差が 逃げ0.83 対 追込1.29＝55% と大きすぎ、前半の貯金が必ず消えていた
// 曲線の正規化＋振れ幅の縮小＋脚質ごとの水準合わせで直した。ここではその状態を固定する。

const STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];

function field(seed: number): Entrant[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 8 }, (_, i) => {
    const style = STYLES[i % 4];
    return { horseId: `e${i}`, name: `E${i}`, stats: rollStatsForStyle(rng, 40, style), style, isPlayer: false };
  });
}

function winRates(laps: number, perCourse: number): Record<RunStyle, number> {
  const wins: Record<string, number> = { nige: 0, senko: 0, sashi: 0, oikomi: 0 };
  let n = 0;
  for (const course of COURSES) {
    for (let s = 0; s < perCourse; s++) {
      const f = field(s * 7919 + 101);
      wins[f[simulate2(f, course, 60, s * 17 + 1, { laps }).order[0]].style]++;
      n++;
    }
  }
  const out = {} as Record<RunStyle, number>;
  for (const k of STYLES) out[k] = (100 * wins[k]) / n;
  return out;
}

describe('ペース曲線（脚質は形を変えるだけで、速さの下駄は履かせない）', () => {
  it('どの脚質も距離あたりの所要時間がほぼ同じ（調和平均が揃っている）', () => {
    const W = [0.4, 0.35, 0.25];
    const h = STYLES.map((s) => {
      const p = paceCurve(s);
      return 1 / (W[0] / p[0] + W[1] / p[1] + W[2] / p[2]);
    });
    // 水準合わせのぶんだけ差が付くが、それは ±4% 以内に収める
    for (const x of h) expect(Math.abs(x - 1)).toBeLessThan(0.04);
    // 4脚質の平均は 1.0（レース全体が速く／遅くならない）
    expect(Math.abs(h.reduce((a, b) => a + b, 0) / 4 - 1)).toBeLessThan(0.01);
  });

  it('脚質の「形」は残っている（逃げは前で行って垂れる／追込は後ろから伸びる）', () => {
    const nige = paceCurve('nige');
    const oikomi = paceCurve('oikomi');
    expect(nige[0]).toBeGreaterThan(nige[2] + 0.1); // 前半 > 終盤
    expect(oikomi[2]).toBeGreaterThan(oikomi[0] + 0.1); // 終盤 > 前半
    expect(paceAt('nige', 0.1)).toBeGreaterThan(paceAt('oikomi', 0.1)); // 序盤は逃げが前
    expect(paceAt('oikomi', 0.9)).toBeGreaterThan(paceAt('nige', 0.9)); // 終盤は追込が上
  });
});

describe('脚質バランス（8頭・各脚質2頭。均等なら25%）', () => {
  it('2周（標準距離）でどの脚質も勝負になる', () => {
    const w = winRates(2, 30);
    console.log(`2周: ${STYLES.map((s) => `${s}${w[s].toFixed(1)}%`).join(' ')}`);
    for (const s of STYLES) {
      // 修正前は 逃げ2.9% ／ 追込39.2% だった
      expect(w[s]).toBeGreaterThan(13);
      expect(w[s]).toBeLessThan(37);
    }
  }, 300_000);

  it('1周・3周でも一方的にならない', () => {
    for (const laps of [1, 3]) {
      const w = winRates(laps, 20);
      console.log(`${laps}周: ${STYLES.map((s) => `${s}${w[s].toFixed(1)}%`).join(' ')}`);
      for (const s of STYLES) {
        expect(w[s]).toBeGreaterThan(8);
        expect(w[s]).toBeLessThan(45);
      }
    }
  }, 600_000);
});
