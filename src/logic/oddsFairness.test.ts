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

// R は「1/確率」の平均なので裾がとても重い。万馬券が1回当たるだけで平均が跳ねる
// （実測：同じ設定でも顔ぶれを変えると 3連単 0.95〜1.84 まで動く）。平均だけを
// 狭く縛るとテストが運で落ちるので、平均は広めに・中央値は狭く見る。系統的なズレ
// （倍率がぜんぶ高すぎる／低すぎる）は中央値のほうにはっきり出る。
type Res = Record<BetKind, number> & { med: Record<BetKind, number>; maxTrifecta: number };

const KINDS: BetKind[] = ['win', 'place', 'quinella', 'wide', 'trifecta'];

function measure(races: number, laps: number | undefined, size: number): Res {
  const per: Record<string, number[]> = { win: [], place: [], quinella: [], wide: [], trifecta: [] };
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

    per.win.push(odds('win', [a]) / n);
    // 的中する選択をすべて数える（複勝=上位3頭・ワイド=その3組）
    per.place.push([a, b, c].reduce((s, i) => s + odds('place', [i]) / n, 0));
    per.quinella.push(odds('quinella', [a, b]) / M2);
    per.wide.push(([[a, b], [a, c], [b, c]] as number[][]).reduce((s, [i, j]) => s + odds('wide', [i, j]) / M2, 0));
    const tri = odds('trifecta', [a, b, c]);
    per.trifecta.push(tri / M3);
    maxTrifecta = Math.max(maxTrifecta, tri);
  }
  const out = { med: {} } as Res;
  for (const k of KINDS) {
    const v = per[k];
    out[k] = v.reduce((a, b) => a + b, 0) / v.length;
    const sorted = [...v].sort((x, y) => x - y);
    out.med[k] = sorted[Math.floor(sorted.length / 2)];
  }
  out.maxTrifecta = maxTrifecta;
  return out;
}

/** 共通のチェック。平均は裾で跳ねるので広め、中央値は狭く見る。 */
function expectBand(r: Res, label: string, maxTri: number) {
  const line = KINDS.map((k) => `${k}=${r[k].toFixed(2)}(中央${r.med[k].toFixed(2)})`).join(' ');
  console.log(`${label}: ${line} / 3連単の最高当選 ${Math.round(r.maxTrifecta).toLocaleString()}倍`);
  for (const k of KINDS) {
    // 平均：修正前は ワイド4.93 / 3連単4.48 だった。ここは「桁で壊れていないか」。
    expect(r[k]).toBeGreaterThan(0.35);
    expect(r[k]).toBeLessThan(2.0);
    // 中央値：ふつうの1点買いは必ず持っていかれる（=胴元の取り分がある）。
    // 1.0 を超えたら「買えば買うほど増える」なので絶対に許さない。
    expect(r.med[k]).toBeGreaterThan(0.15);
    expect(r.med[k]).toBeLessThan(1.0);
  }
  // 「当たってしまう万馬券」の上限。修正前は 60,144倍。
  expect(r.maxTrifecta).toBeLessThan(maxTri);
}

describe('倍率の期待払戻（0.80 が適正）', () => {
  it('どの馬券も 0.80 から大きく外れない（万馬券が当たり続けない）', () => {
    expectBand(measure(40, undefined, 8), '通常8頭2周', 20_000); // 通常レース 8頭 2周
  }, 600_000);

  it('1周でも同じ帯に収まる（周回数ごとに補正を変えている）', () => {
    // 1周は距離が短く決着が付ききらないぶん、いちばん荒れる＝倍率がいちばん
    // 外れやすい。補正を周回ごとの表にして合わせ直す前は、的中した3連単の最高が
    // 1万5千倍まで伸びていた（合わせ直して約5千倍）。
    expectBand(measure(40, 1, 8), '通常8頭1周', 12_000);
  }, 600_000);

  it('3周でも同じ帯に収まる（周回数を変えても壊れない）', () => {
    expectBand(measure(30, 3, 8), '通常8頭3周', 25_000);
  }, 600_000);

  it('6頭立て（GP予選）でも同じ帯に収まる', () => {
    expectBand(measure(30, 2, 6), '6頭2周', 20_000);
  }, 600_000);
});
