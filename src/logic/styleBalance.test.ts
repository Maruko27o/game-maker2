import { describe, it, expect } from 'vitest';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES } from '../data/courses';
import { mulberry32, rollStatsForStyle } from './stats';
import { paceAt, paceCurve, styleFor } from './runStyle';
import type { RunStyle } from '../types';

// 脚質バランスの回帰ガード。
//
// 報告①：「逃げのウマを引くとほぼ勝てない」。実測すると 2周（標準距離）の勝率が
//   逃げ 2.9% ／ 先行39.6% ／ 差し18.3% ／ 追込39.2%（各脚質2頭なので均等は25%）
// で、逃げが構造的に勝てない状態だった。原因は2つ：
//   ① ペース曲線の調和平均（＝走破時計を決める量）が揃っておらず、逃げだけ約2.7%遅かった
//   ② 終盤の差が 逃げ0.83 対 追込1.29＝55% と大きすぎ、前半の貯金が必ず消えていた
//
// 報告②：「差しや追い込みで勝率がだいぶ違う」。実際に遊ぶ条件（下の realField）で
// 測り直すと 逃げ13.0 ／ 先行13.1 ／ 差し11.4 ／ 追込12.4（均等12.5）で、
// 差しがはっきり不利だった。STYLE_LEVEL を実測で合わせ直して均した。
//
// ここで固定したいのは「コース・距離ではしっかり差が出るのに、ぜんぶ足すと
// どの脚質も同じくらい勝てる」という状態。両方をこのファイルで見る。

const STYLES: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];

/** 実際に遊ぶときとまったく同じ作り方の8頭。
 *  草むらのウマも対戦相手のCPUも「脚質テンプレで能力を振る → その能力から
 *  脚質を引き直す」ので、テンプレと実際の脚質は一致しない（実測 一致率34.9%）。
 *  ここを取り違えると測っている分布が変わり、調整もずれる。 */
function realField(seed: number): Entrant[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 8 }, (_, i) => {
    const tmpl = STYLES[Math.floor(rng() * 4) % 4];
    const stats = rollStatsForStyle(rng, 40, tmpl);
    const id = `r${seed}_${i}`;
    return { horseId: id, name: `E${i}`, stats, style: styleFor(id, stats), isPlayer: false };
  });
}

/** 1コース・1周回数ぶんの「1頭あたり勝率(%)」。脚質ごとの出走数が違っても
 *  比べられるように、出走割合で割り戻す（均等なら 12.5）。 */
function cellRates(courseIdx: number, laps: number, n: number): Record<RunStyle, number> {
  const wins: Record<string, number> = { nige: 0, senko: 0, sashi: 0, oikomi: 0 };
  const runs: Record<string, number> = { nige: 0, senko: 0, sashi: 0, oikomi: 0 };
  const course = COURSES[courseIdx];
  const cell = (courseIdx * 3 + laps) * 1000003; // セルごとに別の顔ぶれを引く
  for (let s = 0; s < n; s++) {
    const f = realField(s * 7919 + 101 + cell);
    for (const e of f) runs[e.style]++;
    wins[f[simulate2(f, course, 60, s * 17 + 1, { laps }).order[0]].style]++;
  }
  const out = {} as Record<RunStyle, number>;
  for (const k of STYLES) {
    const share = runs[k] / (n * 8);
    out[k] = share > 0 ? (100 * wins[k]) / n / (share * 8) : 0;
  }
  return out;
}

describe('ペース曲線（脚質は形を変えるだけで、速さの下駄は履かせない）', () => {
  it('どの脚質も距離あたりの所要時間がほぼ同じ（調和平均が揃っている）', () => {
    const W = [0.4, 0.35, 0.25];
    const h = STYLES.map((s) => {
      const p = paceCurve(s);
      return 1 / (W[0] / p[0] + W[1] / p[1] + W[2] / p[2]);
    });
    // 水準合わせ（STYLE_LEVEL）のぶんだけ差が付く。前で行く形ほど v^2.2 のスタミナ
    // 消費が大きく勝負どころで垂れるので、その損を埋めるのに差しは＋5%ほど必要。
    // 「速さの下駄」が青天井にならないよう ±6% で頭を止める。
    for (const x of h) expect(Math.abs(x - 1)).toBeLessThan(0.06);
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

describe('脚質バランス（実戦と同じ8頭。1頭あたりの勝率は均等なら12.5%）', () => {
  it('コース×周回では差が出るのに、全部足すとどの脚質も同じくらい勝てる', () => {
    const N = 60; // 6コース × 3周回 × 60 = 1080レース
    const total: Record<string, number> = { nige: 0, senko: 0, sashi: 0, oikomi: 0 };
    let cells = 0;
    let cellSpread = 0; // セル内の最大−最小の平均（＝コースごとの個性の強さ）
    for (let ci = 0; ci < COURSES.length; ci++) {
      for (const laps of [1, 2, 3]) {
        const w = cellRates(ci, laps, N);
        const vals = STYLES.map((s) => w[s]);
        cellSpread += Math.max(...vals) - Math.min(...vals);
        for (const s of STYLES) total[s] += w[s];
        cells++;
      }
    }
    const avg = {} as Record<RunStyle, number>;
    for (const s of STYLES) avg[s] = total[s] / cells;
    console.log(`総合: ${STYLES.map((s) => `${s}${avg[s].toFixed(1)}%`).join(' ')} / コース内のばらつき平均 ${(cellSpread / cells).toFixed(1)}pt`);

    // ① 総合ではどの脚質も同じくらい勝てる（修正前は 逃げ13.1 対 差し11.4）
    for (const s of STYLES) {
      expect(avg[s]).toBeGreaterThan(10.5);
      expect(avg[s]).toBeLessThan(14.5);
    }
    // ② それでもコース・距離ごとには はっきり得意不得意がある（平らにしすぎない）
    expect(cellSpread / cells).toBeGreaterThan(3.0);
  }, 900_000);
});
