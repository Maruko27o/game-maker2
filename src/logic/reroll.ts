// 厳選（振り直し）の権利計算と適用。
//
// 対象は「既存ウマ」だけ。新世代(gen2)のウマは、草むらから何頭でも召喚して選べること
// 自体が厳選になるので、振り直しの権利は持たない。
// 既存ウマは召喚し直せない代わりに、これまでの活躍に応じた回数だけ振り直せる。
//
// 権利（最大10回）：
//   ベース                 3回
//   トロフィーを持っている  +2回
//   トロフィー5個以上       +1回
//   バッジ（メダル）を持っている +1回
//   バッジ10枚以上          +1回
//   バッジ50枚以上          +1回
//   バッジ100枚以上         +1回
//
// 振り直しは「固有スキル1枠＋コース6枠」のうち、プレイヤーが“更新する”と選んだ枠だけを
// まとめて引き直す。選ばなかった枠は確定のまま動かない（＝良い枠を残していける）。
import type { Horse, Trophy, Badge } from '../types';
import type { RNG } from './stats';
import { rollSkill } from './skill';
import { rollGrade } from './aptitude';
import { COURSES } from '../data/courses';
import type { Grade } from '../data/aptitude';

export const REROLL_BASE = 3;
export const REROLL_MAX = 10;
export const SKILL_SLOT = 'skill'; // 枠のID：スキルはこれ、コースはコースID

/** 振り直しの権利（総数）。活躍したウマほど多い。 */
export function rerollRights(trophyCount: number, badgeCount: number): number {
  let n = REROLL_BASE;
  if (trophyCount >= 1) n += 2;
  if (trophyCount >= 5) n += 1;
  if (badgeCount >= 1) n += 1;
  if (badgeCount >= 10) n += 1;
  if (badgeCount >= 50) n += 1;
  if (badgeCount >= 100) n += 1;
  return Math.min(REROLL_MAX, n);
}

/** 権利の内訳（UIでどこまで伸ばせるか見せるため）。 */
export type RightsBreakdown = { label: string; got: boolean; plus: number }[];
export function rightsBreakdown(trophyCount: number, badgeCount: number): RightsBreakdown {
  return [
    { label: 'ベース', got: true, plus: REROLL_BASE },
    { label: 'トロフィーを持っている', got: trophyCount >= 1, plus: 2 },
    { label: 'トロフィー5個以上', got: trophyCount >= 5, plus: 1 },
    { label: 'バッジを持っている', got: badgeCount >= 1, plus: 1 },
    { label: 'バッジ10枚以上', got: badgeCount >= 10, plus: 1 },
    { label: 'バッジ50枚以上', got: badgeCount >= 50, plus: 1 },
    { label: 'バッジ100枚以上', got: badgeCount >= 100, plus: 1 },
  ];
}

/** そのウマが厳選できるか（新世代は対象外）。 */
export function canReroll(horse: Horse): boolean {
  return !horse.gen2;
}

/** そのウマの権利・使用済み・残り。 */
export function rerollState(horse: Horse, trophies: Trophy[], badges: Badge[]): {
  rights: number;
  used: number;
  left: number;
  trophyCount: number;
  badgeCount: number;
} {
  const trophyCount = trophies.filter((t) => t.horseId === horse.id).length;
  const badgeCount = badges.filter((b) => b.horseId === horse.id).length;
  const rights = canReroll(horse) ? rerollRights(trophyCount, badgeCount) : 0;
  const used = Math.max(0, Math.floor(horse.rerollsUsed ?? 0));
  return { rights, used, left: Math.max(0, rights - used), trophyCount, badgeCount };
}

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
