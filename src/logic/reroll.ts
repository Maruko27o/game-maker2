// 厳選（振り直し）の適用そのもの。回数やコストの制度は logic/refine.ts が持つ。
//
// 振り直しは「固有スキル1枠＋コース6枠」のうち、プレイヤーが“更新する”と選んだ枠だけを
// まとめて引き直す。選ばなかった枠は確定のまま動かない（＝良い枠を残していける）。
import type { Horse } from '../types';
import type { RNG } from './stats';
import { rollSkill } from './skill';
import { rollGrade } from './aptitude';
import { COURSES } from '../data/courses';
import type { Grade } from '../data/aptitude';

export const SKILL_SLOT = 'skill'; // 枠のID：スキルはこれ、コースはコースID

/** 有効な枠IDの一覧（スキル1つ＋コース6つ）。 */
export function allSlots(): string[] {
  return [SKILL_SLOT, ...COURSES.map((c) => c.id)];
}

/** 選ばれた枠だけを引き直した結果を返す（元のウマは変更しない）。 */
export function applyReroll(
  horse: Horse,
  slots: string[],
  rng: RNG,
): { skill: string; apt: Record<string, Grade> } {
  const valid = new Set(allSlots());
  const pick = new Set(slots.filter((s) => valid.has(s)));

  const skill = pick.has(SKILL_SLOT) ? rollSkill(rng).id : (horse.skill ?? '');
  const apt: Record<string, Grade> = {};
  for (const c of COURSES) {
    const cur = horse.apt?.[c.id];
    const keep = cur === 'C' || cur === 'B' || cur === 'A' || cur === 'S' ? cur : 'C';
    apt[c.id] = pick.has(c.id) ? rollGrade(rng) : keep;
  }
  return { skill, apt };
}
