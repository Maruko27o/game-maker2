import { describe, it, expect } from 'vitest';
import { EFFECTS } from '../data/effects';
import { layout, FRAME } from '../components/HorseEffect';

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
