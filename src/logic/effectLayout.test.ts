import { describe, it, expect } from 'vitest';
import { EFFECTS } from '../data/effects';
import { layout, FRAME, rainbowBands, RAINBOW_COLORS } from '../components/HorseEffect';

// エフェクトの粒の散らばり。
// 完全な乱数だと、8粒くらいでは必ずどこかが団子になり、反対側がぽっかり空く
//（「あまいかおり」がまさにそれ）。かといって等間隔に並べると機械的で面白くない。
// ここでは「大きすぎる空きが無いこと」だけを見て、粒ごとのばらつき自体は残す。
const f = FRAME.body;

/** 中心から見た角度の並び。いちばん大きい「すき間」を平均の何倍かで返す。 */
function worstGapRatio(pts: { x: number; y: number }[]) {
  const angles = pts.map((p) => Math.atan2(p.y - f.cy, p.x - f.cx)).sort((a, b) => a - b);
  let worst = 0;
  for (let i = 0; i < angles.length; i++) {
    const next = i + 1 < angles.length ? angles[i + 1] : angles[0] + Math.PI * 2;
    worst = Math.max(worst, next - angles[i]);
  }
  return worst / ((Math.PI * 2) / angles.length);
}

const SCATTERED = new Set(['motes', 'glow']);

describe('エフェクトの粒の散らばり', () => {
  const targets = EFFECTS.filter((e) => SCATTERED.has(e.kind));

  it('ぐるりを囲む種類（motes / glow）に、大きな空きが残らない', () => {
    expect(targets.length).toBeGreaterThan(5);
    for (const def of targets) {
      const ratio = worstGapRatio(layout(def, f, 1));
      // 平均のすき間の 2.6 倍まで。完全な乱数だと 4〜6 倍まで開くことがある。
      expect(ratio, `${def.name}(${def.id}) のすき間が広すぎる: ${ratio.toFixed(2)}`).toBeLessThan(2.6);
    }
  });

  it('かといって等間隔に整列はしていない（機械的な円にしない）', () => {
    // すき間の比が全部 1.0 ちょうどなら、まったく揺らいでいない＝つまらない。
    const ratios = targets.map((d) => worstGapRatio(layout(d, f, 1)));
    expect(Math.max(...ratios)).toBeGreaterThan(1.25);
    // 半径もばらけていること（一定なら真円に並んでいる）
    for (const def of targets) {
      const rr = layout(def, f, 1).map((m) => Math.hypot(m.x - f.cx, (m.y - f.cy) / 0.9));
      expect(Math.max(...rr) - Math.min(...rr)).toBeGreaterThan(f.r * 0.12);
    }
  });

  it('上から降る／下から昇る種類も、左右どちらかに固まらない', () => {
    for (const def of EFFECTS.filter((e) => e.kind === 'petals' || e.kind === 'bubbles')) {
      const pts = layout(def, f, 1);
      const left = pts.filter((p) => p.x < f.cx).length;
      // 片側に全部寄っていない（n=7〜10 なので 2:8 くらいまでは許す）
      expect(left, `${def.name} が左右に偏っている`).toBeGreaterThanOrEqual(2);
      expect(pts.length - left, `${def.name} が左右に偏っている`).toBeGreaterThanOrEqual(2);
    }
  });

  it('同じエフェクトなら毎回まったく同じ配置（見るたびに変わらない）', () => {
    for (const def of EFFECTS) {
      expect(layout(def, f, 1)).toEqual(layout(def, f, 1));
    }
  });
});

// にじのアーチ。以前は6本の帯がすべて同じ両端（cx±1.05r）を結んでいたため、
// 半径を小さくしても SVG が「弦に届かない半径」を弦に合わせて拡大し直し、
// 結局ぜんぶ同じ半円に重なっていた（＝虹に見えない）。
describe('虹のアーチ', () => {
  for (const view of ['body', 'face'] as const) {
    const bands = rainbowBands(FRAME[view]);

    it(`${view}：6色ぶんの帯がある`, () => {
      expect(bands).toHaveLength(RAINBOW_COLORS.length);
      expect(bands.map((b) => b.color)).toEqual(RAINBOW_COLORS);
    });

    it(`${view}：半径が外から内へ必ず小さくなる`, () => {
      for (let i = 1; i < bands.length; i++) {
        expect(bands[i].rx).toBeLessThan(bands[i - 1].rx);
      }
      expect(Math.min(...bands.map((b) => b.rx))).toBeGreaterThan(0);
    });

    it(`${view}：隣どうしの間隔が線の太さと同じ（すき間も重なりも出ない）`, () => {
      for (let i = 1; i < bands.length; i++) {
        expect(bands[i - 1].rx - bands[i].rx).toBeCloseTo(bands[i].width, 6);
      }
    });

    it(`${view}：弦の半分が半径を超えない（SVG に拡大し直されない）`, () => {
      // ここが崩れると、半径の違いが無視されて全部おなじ半円になる＝以前のバグ。
      for (const b of bands) {
        const halfChord = (b.x2 - b.x1) / 2;
        expect(halfChord).toBeLessThanOrEqual(b.rx + 1e-9);
      }
    });

    it(`${view}：どの帯も上に開いた弧で、足もとの高さがそろっている`, () => {
      const y = bands[0].y;
      for (const b of bands) {
        expect(b.y).toBe(y);
        expect(b.x1).toBeLessThan(b.x2);
        expect(b.ry).toBeGreaterThan(0);
      }
    });
  }
});
