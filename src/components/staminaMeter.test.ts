import { describe, it, expect } from 'vitest';
import { spDisplay, spColor } from './RankPanel';
import { simulate2, type Entrant } from '../logic/raceSim2';
import { COURSES } from '../data/courses';
import { mulberry32, rollStatsForStyle } from '../logic/stats';

// スタミナメーターの見せ方のガード。
// 素の残量はゴール時点で 99% が 0.22 以下に張り付く（タンクを使い切る設計で、挙動は
// これで正しい）。そのまま出すと全頭まっ赤で誰が余しているか読めないので、空に近い
// ほど目盛りを細かく取るガンマ補正をかけている。ここでは
//   ・順序は絶対に入れ替わらない（速さの読み筋を壊さない）
//   ・実際のレースのゴール時点で色がばらける（全頭まっ赤にならない）
// を担保する。

function mkField(seed: number): Entrant[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 8 }, (_, i) => {
    const style = (['nige', 'senko', 'sashi', 'oikomi'] as const)[i % 4];
    const stats = rollStatsForStyle(rng, 40, style);
    return { horseId: `e${i}`, name: `E${i}`, stats, style, isPlayer: i === 0 } as Entrant;
  });
}

// hsl(H …) の H を取り出す。0=赤 / 30前後=橙 / 60前後=黄 / 130=緑
function hueOf(css: string): number {
  return Number(/hsl\((\d+)/.exec(css)![1]);
}

describe('spDisplay（スタミナ表示のガンマ補正）', () => {
  it('0と1は動かさず、範囲外は丸める', () => {
    expect(spDisplay(0)).toBe(0);
    expect(spDisplay(1)).toBe(1);
    expect(spDisplay(-5)).toBe(0);
    expect(spDisplay(9)).toBe(1);
  });

  it('順序を絶対に入れ替えない（残量が多い方が必ず長い）', () => {
    let prev = -1;
    for (let v = 0; v <= 1.0001; v += 0.01) {
      const d = spDisplay(v);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it('少ない残量ほど目盛りを広げる（素の値より大きく出る）', () => {
    for (const v of [0.02, 0.065, 0.13, 0.25, 0.5]) {
      expect(spDisplay(v)).toBeGreaterThan(v);
    }
  });
});

describe('spColor（緑→黄→橙→赤の連続変化）', () => {
  it('満タンは緑、空はまっ赤', () => {
    expect(hueOf(spColor(1))).toBeGreaterThan(110);
    expect(hueOf(spColor(0))).toBe(0);
  });

  it('残量が減るほど赤に寄る（逆転しない）', () => {
    let prev = Infinity;
    for (let v = 1; v >= 0; v -= 0.05) {
      const h = hueOf(spColor(v));
      expect(h).toBeLessThanOrEqual(prev);
      prev = h;
    }
  });
});

describe('実際のレースのゴール時点で、メーターの色がばらける', () => {
  it('全頭まっ赤にならず、橙〜黄の帯にも散る', () => {
    const hues: number[] = [];
    for (const course of COURSES.slice(0, 3)) {
      for (let s = 0; s < 8; s++) {
        const r = simulate2(mkField(s * 31 + 7), course, 60, s + 1, { recordFrames: true });
        const last = r.frames[r.frames.length - 1];
        for (const run of last.runners) hues.push(hueOf(spColor(spDisplay(run.sp))));
      }
    }
    const band = (lo: number, hi: number) => (100 * hues.filter((h) => h >= lo && h < hi).length) / hues.length;
    console.log(`ゴール時の色: 赤(0-19) ${band(0, 20).toFixed(1)}% / 橙(20-44) ${band(20, 45).toFixed(1)}% / 黄(45-79) ${band(45, 80).toFixed(1)}% / 緑(80+) ${band(80, 999).toFixed(1)}%`);
    expect(hues.length).toBeGreaterThan(100);
    const red = hues.filter((h) => h < 20).length / hues.length; // まっ赤〜赤
    const orangeUp = hues.filter((h) => h >= 20).length / hues.length; // 橙より上
    // 素の値のままだと red が 99% を超えてしまう。補正後は橙以上が多数派になる。
    expect(orangeUp).toBeGreaterThan(0.45);
    expect(red).toBeLessThan(0.55);
    // ただし「全部同じ色」にもならない（力尽きた馬はちゃんと赤い）
    expect(red).toBeGreaterThan(0.02);
    expect(new Set(hues).size).toBeGreaterThan(10);
  }, 120000);
});
