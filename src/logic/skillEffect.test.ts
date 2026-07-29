import { describe, it, expect } from 'vitest';
import {
  skillMods, aptitudeMods, racerMods, racerStrength, skillFarmMultiplier,
  strengthFactor, NO_MODS, UNIT, APT_MULT,
} from './skillEffect';
import { SKILLS } from '../data/skills';
import { probsFromWins } from './odds';

const TURF = { surface: 'turf' as const, mode: 60 as const };
const SAND = { surface: 'sand' as const, mode: 60 as const };
const SHORT = { surface: 'turf' as const, mode: 30 as const };

describe('skillMods（スキル → 走りの倍率）', () => {
  it('スキルが無ければ何も変わらない', () => {
    expect(skillMods(undefined, TURF)).toEqual(NO_MODS);
    expect(skillMods('no_such_skill', TURF)).toEqual(NO_MODS);
  });

  it('全40種が何かしらの効果を持つ（飾りのスキルを作らない）', () => {
    // 全路面 × 両モードを回して、どこかで効くことを確かめる。
    const surfaces = ['turf', 'dirt', 'sand', 'trail', 'circuit', 'steeple'] as const;
    for (const s of SKILLS) {
      const seen: string[] = [];
      for (const surface of surfaces) {
        for (const mode of [30, 60] as const) seen.push(JSON.stringify(skillMods(s.id, { surface, mode })));
      }
      const changed = seen.some((x) => x !== JSON.stringify(NO_MODS));
      expect(changed, `${s.id} に効果が無い`).toBe(true);
    }
  });

  it('星が高いほど効果が大きい', () => {
    const one = SKILLS.find((s) => s.star === 1 && s.id === 'straight_run')!;
    const five = SKILLS.find((s) => s.star === 5 && s.id === 'sky_legs')!;
    expect(skillMods(one.id, TURF).vMax - 1).toBeCloseTo(UNIT, 6);
    expect(skillMods(five.id, TURF).late - 1).toBeCloseTo(2.2 * 5 * UNIT, 6);
  });

  it('路面で効いたり効かなかったりする', () => {
    expect(skillMods('sand_lover', SAND).vMax).toBeGreaterThan(1);
    expect(skillMods('sand_lover', TURF).vMax).toBe(1); // 芝では効かない
    expect(skillMods('grass_lover', TURF).vMax).toBeGreaterThan(1);
    expect(skillMods('grass_lover', SAND).vMax).toBe(1);
  });

  it('距離（30秒/60秒）で効いたり効かなかったりする', () => {
    expect(skillMods('sprint_king', SHORT).vMax).toBeGreaterThan(1); // 短距離王は30秒で
    expect(skillMods('sprint_king', TURF).vMax).toBe(1); // 60秒では効かない
    expect(skillMods('stayer_king', TURF).spMax).toBeGreaterThan(1); // 長距離王は60秒で
    expect(skillMods('stayer_king', SHORT).spMax).toBe(1);
  });

  it('スタミナ長持ち系は drain が下がる（小さいほど良い）', () => {
    expect(skillMods('endless', TURF).drain).toBeLessThan(1);
    expect(skillMods('deep_breath', TURF).drain).toBeLessThan(1);
  });

  it('効果は現実的な範囲に収まる（1頭で壊れない）', () => {
    for (const s of SKILLS) {
      const surfaces = ['turf', 'dirt', 'sand', 'trail', 'circuit', 'steeple'] as const;
      const ctxs = surfaces.flatMap((surface) => ([30, 60] as const).map((mode) => ({ surface, mode })));
      for (const ctx of ctxs) {
        const m = skillMods(s.id, ctx);
        for (const v of Object.values(m)) {
          expect(v).toBeGreaterThan(0.7);
          expect(v).toBeLessThan(1.35);
        }
      }
    }
  });
});

describe('aptitudeMods（コース適性 → 倍率）', () => {
  it('S > A > B > C の順で強い', () => {
    expect(APT_MULT.S).toBeGreaterThan(APT_MULT.A);
    expect(APT_MULT.A).toBeGreaterThan(APT_MULT.B);
    expect(APT_MULT.B).toBeGreaterThan(APT_MULT.C);
  });

  it('B は効果なし（基準）', () => {
    expect(aptitudeMods('B')).toEqual(NO_MODS);
    expect(aptitudeMods(undefined)).toEqual(NO_MODS);
  });

  it('S でも1頭で壊れるほどの差にはしない', () => {
    expect(APT_MULT.S).toBeLessThan(1.06);
    expect(APT_MULT.C).toBeGreaterThan(0.95);
  });
});

describe('strengthFactor（オッズ用のひとまとめの強さ）', () => {
  it('効果なしなら 1.0', () => {
    expect(strengthFactor(NO_MODS)).toBeCloseTo(1, 6);
  });

  it('良いスキル・良い適性ほど強くなる', () => {
    const weak = racerStrength('straight_run', 'C', TURF);
    const strong = racerStrength('sky_legs', 'S', TURF);
    expect(strong).toBeGreaterThan(weak);
  });

  it('スタミナ長持ちは強さに反映される（drain が下がると強くなる）', () => {
    expect(racerStrength('endless', 'B', TURF)).toBeGreaterThan(1);
  });

  it('適性 S と C で意味のある差がつく', () => {
    const s = racerStrength(undefined, 'S', TURF);
    const c = racerStrength(undefined, 'C', TURF);
    expect(s / c).toBeGreaterThan(1.02);
    expect(s / c).toBeLessThan(1.15); // ただし壊れるほどではない
  });
});

describe('skillFarmMultiplier（牧場収入に効くスキル）', () => {
  it('収入スキルは収入を増やす', () => {
    expect(skillFarmMultiplier('big_eater')).toBeGreaterThan(1);
    expect(skillFarmMultiplier('friendly')).toBeGreaterThan(1);
  });

  it('収入に関係ないスキルは1.0', () => {
    expect(skillFarmMultiplier('straight_run')).toBe(1);
    expect(skillFarmMultiplier(undefined)).toBe(1);
  });
});

describe('racerMods（合成）', () => {
  it('スキルと適性が掛け合わさる', () => {
    const m = racerMods('straight_run', 'S', TURF);
    expect(m.vMax).toBeCloseTo((1 + UNIT) * APT_MULT.S, 6);
  });
});

describe('probsFromWins（能力に比例した平滑化）', () => {
  it('確率の合計は必ず1', () => {
    const wins = [50, 30, 20, 10, 5, 3, 2, 0];
    const p = probsFromWins(wins, 120, [0.3, 0.2, 0.15, 0.12, 0.1, 0.07, 0.05, 0.01]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('勝てなかったウマ同士でも、実力差があれば別の確率になる（裾が潰れない）', () => {
    // 2頭とも0勝。でも事前分布（実力）が違う。
    const p = probsFromWins([100, 20, 0, 0], 120, [0.6, 0.3, 0.09, 0.01]);
    expect(p[2]).toBeGreaterThan(p[3]); // 惜しかった馬のほうが低いオッズになる
    expect(p[2] / p[3]).toBeGreaterThan(3);
  });

  it('事前分布を渡さなければ従来どおり一様に平滑化する', () => {
    const p = probsFromWins([10, 10, 0, 0], 20);
    expect(p[2]).toBeCloseTo(p[3], 10);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('実際に勝った回数のほうが事前分布より強く効く（オッズ＝実際の勝率であること）', () => {
    // 事前分布では2番手だが、実際には一度も勝っていない
    const p = probsFromWins([120, 0], 120, [0.4, 0.6]);
    expect(p[0]).toBeGreaterThan(0.9);
    expect(p[1]).toBeLessThan(0.1);
  });
});
