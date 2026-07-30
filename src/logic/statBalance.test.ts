import { describe, it, expect } from 'vitest';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES } from '../data/courses';
import { STAT_KEYS, type Stats, type StatKey, type RunStyle } from '../types';

// 能力バランスの回帰ガード。
//
// 「合計値が同じなら、どの能力に振っても同じくらい勝てる」を担保する。
// 修正前は 合計48 の同条件で
//   スタミナ35.3% ／ パワー16.0% ／ スピード12.7% ／ こんじょう8.0% ／
//   ジャンプ5.3% ／ かしこさ4.0%（均等なら12.5%）
// と、スタミナ一強でかしこさ・ジャンプはほぼ死に能力だった。
// コースの重み表の組み替え（各能力の「山」を高くしつつ6コース合計を揃える）と、
// ジャンプにコーナー、かしこさに燃費、こんじょうに終い脚の役割を足して均した。
//
// なお「コース適性（得意コースで2倍以上勝つ）」とは表裏の関係にある。能力の価値を
// 平らにしすぎると適性が消えるので、raceSim2.test.ts の #11 と必ずセットで見ること。

function build(k: StatKey | null, total: number): Stats {
  const s = {} as Stats;
  if (!k) {
    const b = Math.floor(total / 6);
    for (const x of STAT_KEYS) s[x] = b;
    let r = total - b * 6;
    for (const x of STAT_KEYS) if (r > 0 && s[x] < 10) { s[x]++; r--; }
    return s;
  }
  s[k] = 10;
  const others = STAT_KEYS.filter((x) => x !== k);
  let acc = 0;
  others.forEach((x, i) => {
    const v = i === others.length - 1 ? total - 10 - acc : Math.round((total - 10) / 5);
    s[x] = Math.max(1, Math.min(10, v));
    acc += s[x];
  });
  return s;
}

/** 「1つの能力だけ10・残りは均等」の6頭＋バランス2頭で走らせ、勝率を返す。 */
function winRates(total: number, perCourse: number): Record<string, number> {
  const wins: Record<string, number> = {};
  [...STAT_KEYS, 'balance'].forEach((k) => (wins[k] = 0));
  let races = 0;
  for (const course of COURSES) {
    for (let s = 0; s < perCourse; s++) {
      const names = [...STAT_KEYS, 'balance', 'balance2'];
      const f: Entrant[] = names.map((n, i) => ({
        horseId: `${n}_${s}_${i}`,
        name: n,
        isPlayer: false,
        stats: n.startsWith('balance') ? build(null, total) : build(n as StatKey, total),
        style: 'senko' as RunStyle, // 脚質の影響を消して能力だけを比べる
      }));
      const w = f[simulate2(f, course, 60, s * 17 + 1, { laps: 2 }).order[0]].name;
      wins[w.startsWith('balance') ? 'balance' : w]++;
      races++;
    }
  }
  const out: Record<string, number> = {};
  for (const k of [...STAT_KEYS, 'balance']) out[k] = (100 * wins[k]) / races;
  return out;
}

describe('能力バランス（合計が同じなら、どの能力も勝負になる）', () => {
  it('合計48でどの能力も死に能力にならない', () => {
    const w = winRates(48, 25);
    console.log(`合計48: ${[...STAT_KEYS, 'balance'].map((k) => `${k}${w[k].toFixed(1)}%`).join(' ')}（均等12.5%）`);
    for (const k of STAT_KEYS) {
      // 修正前は かしこさ4.0% ／ ジャンプ5.3% だった
      expect(w[k]).toBeGreaterThan(5);
      // 修正前は スタミナ35.3% だった
      expect(w[k]).toBeLessThan(32);
    }
    // 最強と最弱の開きを4倍以内に（修正前は 8.8倍）
    const vals = STAT_KEYS.map((k) => w[k]);
    expect(Math.max(...vals) / Math.max(1e-9, Math.min(...vals))).toBeLessThan(4.5);
  }, 600_000);
});
