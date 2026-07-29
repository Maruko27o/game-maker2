// 固有スキルとコース適性を「レースの走りに効く倍率」に変換する層。
//
// 設計方針：
//  ・効果はすべて 1.0 を基準にした倍率。掛け合わせても壊れないよう、1つ1つは小さく保つ。
//  ・星が高いほど効果が大きい（★1 の効果 × 星の数）。
//  ・コース・距離（30秒/60秒）で効く／効かないが決まるスキルがあるので、文脈を受け取る。
//  ・ここは純粋関数なので、倍率テストから直接呼んで分布を測れる。
//
// ★倍率バランスの大前提★ 「今のレースの倍率と勝率がちょうどいい」を壊さないため、
// 効果の大きさは UNIT を1か所で調整できるようにしてある。強すぎたら UNIT を下げる。
import type { Surface } from '../data/courses';
import type { Grade } from '../data/aptitude';
import { SKILL_BY_ID } from '../data/skills';

/** 走りに効く倍率のセット。すべて 1.0 が「効果なし」。 */
export type Mods = {
  vMax: number; // 最高速
  accel: number; // 加速力
  spMax: number; // スタミナタンクの大きさ
  drain: number; // スタミナの減りやすさ（小さいほど長持ち）
  early: number; // 序盤（前半）の伸び
  late: number; // 終盤（後半）の伸び
  gate: number; // スタートの出やすさ
  corner: number; // コーナーでの速度維持
  farm: number; // 牧場の収入（レース外）
};

export const NO_MODS: Mods = {
  vMax: 1, accel: 1, spMax: 1, drain: 1, early: 1, late: 1, gate: 1, corner: 1, farm: 1,
};

/** 星1つぶんの効き幅。全体の強さはここ1か所で調整する。 */
export const UNIT = 0.006;

/** レースの文脈（どのコースを何秒で走るか）。 */
export type RaceCtx = { surface: Surface; mode: 30 | 60 };

type Knob = keyof Mods;
/** スキルID -> どの項目に効くか。値は「星1つあたり UNIT の何倍か」。 */
type Spec = {
  base?: Partial<Record<Knob, number>>; // いつでも効く
  onSurface?: { surfaces: Surface[]; mods: Partial<Record<Knob, number>> };
  onMode?: { mode: 30 | 60; mods: Partial<Record<Knob, number>> };
};

// drain は「小さいほど良い」ので、効果はマイナス方向に入れる。
const SPECS: Record<string, Spec> = {
  // ---- 星1 ----
  straight_run: { base: { vMax: 1 } },
  morning_pep: { base: { early: 1.2 } },
  brave_gate: { base: { gate: 1.5 } },
  friendly: { base: { farm: 2 } },
  tight_turn: { base: { corner: 1.2 } },
  rain_ear: { onSurface: { surfaces: ['dirt'], mods: { vMax: 1.5 } } },
  easy_going: { base: { drain: -1 } },
  big_eater: { base: { farm: 3 } },
  side_by_side: { base: { late: 0.8 } },
  early_bird: { onMode: { mode: 30, mods: { vMax: 1.4 } } },
  sand_lover: { onSurface: { surfaces: ['sand'], mods: { vMax: 1.6 } } },
  grass_lover: { onSurface: { surfaces: ['turf'], mods: { vMax: 1.2 } } },

  // ---- 星2 ----
  start_dash: { base: { gate: 2, accel: 1 } },
  sticky_legs: { base: { late: 1.2, drain: -0.6 } },
  inner_gate: { base: { corner: 1.4 } },
  outer_gate: { base: { vMax: 0.7, corner: 0.7 } },
  uphill: { onSurface: { surfaces: ['trail'], mods: { vMax: 1.5, accel: 1 } } },
  downhill: { onSurface: { surfaces: ['trail'], mods: { late: 1.6 } } },
  muddy: { onSurface: { surfaces: ['dirt', 'sand'], mods: { vMax: 1.4, drain: -0.8 } } },
  my_pace: { base: { drain: -1.2 } },
  deep_breath: { base: { drain: -1.6 } },
  slipstream: { base: { drain: -1, late: 0.8 } },

  // ---- 星3 ----
  cornering: { base: { corner: 2 } },
  last_spurt: { base: { late: 1.6 } },
  front_hold: { base: { early: 1.2, vMax: 0.7 } },
  guts_lump: { base: { late: 1.4, drain: -0.6 } },
  race_read: { base: { corner: 1, accel: 0.8, drain: -0.6 } },
  supple: { base: { vMax: 0.7, corner: 0.8, drain: -0.6 } },
  solo_lead: { base: { early: 1.6, vMax: 0.6 } },
  closer_pro: { base: { late: 2 } },

  // ---- 星4 ----
  burst: { base: { accel: 2 } },
  ironwall: { base: { corner: 1.4, drain: -1 } },
  stayer_king: { onMode: { mode: 60, mods: { vMax: 1.2, spMax: 2 } } },
  sprint_king: { onMode: { mode: 30, mods: { vMax: 1.4, accel: 1.2 } } },
  clutch: { base: { late: 1.8 } },
  endless: { base: { spMax: 2, drain: -2 } },

  // ---- 星5 ----
  sky_legs: { base: { late: 2.2, vMax: 0.8 } },
  unbroken: { base: { vMax: 0.8, drain: -1.2, corner: 1, late: 0.8 } },
  lightning: { base: { gate: 3, early: 1.6, accel: 1.2 } },
  thousand_wind: { base: { vMax: 0.7, accel: 0.7, spMax: 1, drain: -0.7, late: 0.7 } },
};

function apply(out: Mods, mods: Partial<Record<Knob, number>>, amount: number): void {
  for (const k of Object.keys(mods) as Knob[]) out[k] += (mods[k] ?? 0) * amount;
}

/** そのスキルが、この文脈で生む倍率。 */
export function skillMods(skillId: string | undefined, ctx: RaceCtx): Mods {
  const out: Mods = { ...NO_MODS };
  if (!skillId) return out;
  const skill = SKILL_BY_ID[skillId];
  const spec = SPECS[skillId];
  if (!skill || !spec) return out;
  const amount = skill.star * UNIT;
  if (spec.base) apply(out, spec.base, amount);
  if (spec.onSurface && spec.onSurface.surfaces.includes(ctx.surface)) apply(out, spec.onSurface.mods, amount);
  if (spec.onMode && spec.onMode.mode === ctx.mode) apply(out, spec.onMode.mods, amount);
  return out;
}

/** 牧場収入だけを見たい場合（レース文脈がいらない）。 */
export function skillFarmMultiplier(skillId: string | undefined): number {
  if (!skillId) return 1;
  const skill = SKILL_BY_ID[skillId];
  const spec = SPECS[skillId];
  const v = spec?.base?.farm;
  if (!skill || !v) return 1;
  return 1 + v * skill.star * UNIT;
}

/** コース適性 C/B/A/S が全体の走りにかける倍率。S と C で勝率が体感できる差になる。 */
export const APT_MULT: Record<Grade, number> = { C: 0.990, B: 1.0, A: 1.008, S: 1.016 };

export function aptitudeMods(grade: Grade | undefined): Mods {
  const m = APT_MULT[grade ?? 'B'] ?? 1;
  // 適性は「そのコースへの合い方」なので、速度・加速・スタミナに薄く広く効かせる。
  return { ...NO_MODS, vMax: m, accel: m, spMax: 1 + (m - 1) * 1.5 };
}

/** スキルと適性を掛け合わせた最終倍率。 */
export function combineMods(a: Mods, b: Mods): Mods {
  const out = {} as Mods;
  for (const k of Object.keys(NO_MODS) as Knob[]) out[k] = a[k] * b[k];
  return out;
}

/** そのウマの、このレースでの最終倍率。 */
export function racerMods(skillId: string | undefined, grade: Grade | undefined, ctx: RaceCtx): Mods {
  return combineMods(skillMods(skillId, ctx), aptitudeMods(grade));
}

/** 倍率のセットを「総合的な強さ1つ」に畳み込む。
 *  オッズの事前分布（解析モデル）で使う。レース本体はモード別に細かく効かせるが、
 *  事前分布はざっくり「どれくらい強いか」だけ分かればよい。
 *  重みは、実際のレースでの効きやすさの目安（最高速がいちばん効く）。 */
export function strengthFactor(m: Mods): number {
  return (
    Math.pow(m.vMax, 1.0) *
    Math.pow(m.late, 0.5) *
    Math.pow(m.early, 0.2) *
    Math.pow(m.accel, 0.3) *
    Math.pow(m.spMax, 0.3) *
    Math.pow(1 / m.drain, 0.3) *
    Math.pow(m.corner, 0.2) *
    Math.pow(m.gate, 0.1)
  );
}

/** そのウマの、このレースでの総合的な強さ倍率（1.0 が標準）。 */
export function racerStrength(skillId: string | undefined, grade: Grade | undefined, ctx: RaceCtx): number {
  return strengthFactor(racerMods(skillId, grade, ctx));
}

// ---- 図鑑用：効果を具体的な数値の文章にする ---------------------------------
// 実際に使っている SPECS から生成するので、効果を変えれば図鑑の数値も自動で変わる
// （説明文と中身がズレない）。

const KNOB_LABEL: Record<Knob, string> = {
  vMax: '最高速',
  accel: '加速力',
  spMax: 'スタミナ',
  drain: 'スタミナ長持ち',
  early: '序盤の伸び',
  late: '終盤の伸び',
  gate: 'スタート',
  corner: 'コーナー',
  farm: '牧場の収入',
};

const SURFACE_LABEL: Record<Surface, string> = {
  turf: '芝', dirt: 'ダート', sand: '砂', trail: '山道', circuit: 'ナイター', steeple: '障害',
};

export type EffectLine = { when: string; text: string };

/** そのスキルの効果を「いつ・何が・何%」の形で並べる（図鑑用）。 */
export function skillEffectLines(skillId: string): EffectLine[] {
  const skill = SKILL_BY_ID[skillId];
  const spec = SPECS[skillId];
  if (!skill || !spec) return [];
  const amount = skill.star * UNIT;
  const fmt = (knob: Knob, mult: number): string => {
    const pct = Math.abs(mult) * amount * 100;
    // drain は「減りにくくなる」ので、マイナス指定＝プラスの効果として見せる。
    const up = knob === 'drain' ? mult < 0 : mult > 0;
    return `${KNOB_LABEL[knob]} ${up ? '＋' : '−'}${pct.toFixed(1)}%`;
  };
  const lines: EffectLine[] = [];
  const push = (when: string, mods: Partial<Record<Knob, number>>) => {
    const parts = (Object.keys(mods) as Knob[]).map((k) => fmt(k, mods[k] ?? 0));
    if (parts.length) lines.push({ when, text: parts.join('・') });
  };
  if (spec.base) push('いつでも', spec.base);
  if (spec.onSurface) push(spec.onSurface.surfaces.map((s) => SURFACE_LABEL[s]).join('・') + 'のとき', spec.onSurface.mods);
  if (spec.onMode) push(`${spec.onMode.mode}秒レースのとき`, spec.onMode.mods);
  return lines;
}

/** 適性の効果を数値で（図鑑用）。 */
export function aptitudeEffectText(grade: Grade): string {
  const d = (APT_MULT[grade] - 1) * 100;
  if (Math.abs(d) < 0.001) return '基準（増減なし）';
  return `最高速・加速 ${d > 0 ? '＋' : '−'}${Math.abs(d).toFixed(1)}%・スタミナ ${d > 0 ? '＋' : '−'}${Math.abs(d * 1.5).toFixed(1)}%`;
}
