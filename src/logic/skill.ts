// 固有スキルの抽選。
//
// 方式：まず星の段を比 5:4:3:2:1 で選び、その段の中から等確率で1つ選ぶ。
// これで「星5はレア（約6.7%）、星1はよく出る（約33%）」になる。
//
// 既存ウマにも“生まれつき持っていた”ことにして付与する（アップデートで置いていかれない
// ようにするため）。その際は ウマID から決まる固定の乱数を使うので、端末やクラウド同期を
// またいでも必ず同じスキルになる。
import { mulberry32, hashString, type RNG } from './stats';
import { SKILLS, STAR_WEIGHTS, SKILL_BY_ID, type Skill, type SkillStar } from '../data/skills';

/** 比にしたがって星の段を1つ選ぶ。 */
function rollStar(rng: RNG): SkillStar {
  const stars = [1, 2, 3, 4, 5] as SkillStar[];
  const total = stars.reduce((s, st) => s + STAR_WEIGHTS[st], 0);
  let x = rng() * total;
  for (const st of stars) {
    x -= STAR_WEIGHTS[st];
    if (x < 0) return st;
  }
  return 1;
}

/** スキルを1つ抽選する。 */
export function rollSkill(rng: RNG): Skill {
  const star = rollStar(rng);
  const pool = SKILLS.filter((s) => s.star === star);
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

/** ウマIDから決まる固定のスキル。既存ウマへの後付け付与に使う（どこで開いても同じ）。 */
export function skillForHorseId(id: string): Skill {
  return rollSkill(mulberry32(hashString(`skill:${id}`)));
}

/** 保存値からスキルを引く。未設定・不正なIDならIDから決まる固定スキルにフォールバック。 */
export function skillOf(horse: { id: string; skill?: string }): Skill {
  const found = horse.skill ? SKILL_BY_ID[horse.skill] : undefined;
  return found ?? skillForHorseId(horse.id);
}
