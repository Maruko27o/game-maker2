import type { AptGrade, Horse } from '../types';
import { APT_GRADES } from '../types';
import { aptitudeOf } from './aptitude';
import { COURSES } from '../data/courses';

// 適性フレーム（スペシャルタスク）。
// 6コースすべての適性が同じ等級のウマを手に入れると、その等級のフレームがもらえる。
//
// ★ 一度もらったら二度と取り上げない ★
// 授与の記録はセーブに「等級だけ」を残す。だからそのウマを引退させても、厳選で
// 適性を振り直しても、フレームは手元に残る。判定は「今いるウマ」を見るが、
// 結果は必ず既存の記録に足しこむ（差し替えない）。

/** そのウマの6コースの適性がすべて同じなら、その等級を返す。 */
export function uniformGrade(horse: Horse): AptGrade | null {
  const apt = aptitudeOf(horse);
  const first = apt[COURSES[0].id];
  if (!first) return null;
  for (const c of COURSES) if (apt[c.id] !== first) return null;
  return first as AptGrade;
}

/** 保存されている等級リストを正規化（不明な値・重複を落とす）。 */
export function normAptFrames(v: unknown): AptGrade[] {
  if (!Array.isArray(v)) return [];
  const out: AptGrade[] = [];
  for (const g of v) {
    if (APT_GRADES.includes(g as AptGrade) && !out.includes(g as AptGrade)) out.push(g as AptGrade);
  }
  return APT_GRADES.filter((g) => out.includes(g)); // 表示順を C→B→A→S に固定
}

/** 今いるウマから新しく授与できる等級（すでに持っているものは除く）。 */
export function newlyEarned(horses: Horse[], owned: AptGrade[]): AptGrade[] {
  const have = new Set(owned);
  const found = new Set<AptGrade>();
  for (const h of horses) {
    const g = uniformGrade(h);
    if (g && !have.has(g)) found.add(g);
  }
  return APT_GRADES.filter((g) => found.has(g));
}

/** 記録に足しこむ（差し替えない＝取り上げない）。 */
export function mergeAptFrames(owned: AptGrade[], add: AptGrade[]): AptGrade[] {
  return APT_GRADES.filter((g) => owned.includes(g) || add.includes(g));
}
