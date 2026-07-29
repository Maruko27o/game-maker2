// コース適性の抽選。6コースそれぞれに C/B/A/S を独立に振る。
//
// 既存ウマにも“生まれつき持っていた”ことにして付与する。その際は ウマID＋コースID から
// 決まる固定の乱数を使うので、端末やクラウド同期をまたいでも必ず同じ等級になる。
import { mulberry32, hashString, type RNG } from './stats';
import { COURSES } from '../data/courses';
import { GRADES, GRADE_WEIGHTS, type Grade } from '../data/aptitude';

/** 比にしたがって等級を1つ選ぶ。 */
export function rollGrade(rng: RNG): Grade {
  const total = GRADES.reduce((s, g) => s + GRADE_WEIGHTS[g], 0);
  let x = rng() * total;
  for (const g of GRADES) {
    x -= GRADE_WEIGHTS[g];
    if (x < 0) return g;
  }
  return 'C';
}

/** 6コースぶんの適性をまとめて抽選する。 */
export function rollAptitude(rng: RNG): Record<string, Grade> {
  const out: Record<string, Grade> = {};
  for (const c of COURSES) out[c.id] = rollGrade(rng);
  return out;
}

/** ウマID＋コースIDから決まる固定の等級。既存ウマへの後付け付与に使う。 */
export function gradeForHorseCourse(horseId: string, courseId: string): Grade {
  return rollGrade(mulberry32(hashString(`apt:${horseId}:${courseId}`)));
}

/** ウマID から決まる6コースぶんの適性（後付け付与用）。 */
export function aptitudeForHorseId(horseId: string): Record<string, Grade> {
  const out: Record<string, Grade> = {};
  for (const c of COURSES) out[c.id] = gradeForHorseCourse(horseId, c.id);
  return out;
}

/** 保存値から適性を引く。欠けているコースは ID から決まる固定値で埋める。 */
export function aptitudeOf(horse: { id: string; apt?: Record<string, string> }): Record<string, Grade> {
  const saved = horse.apt ?? {};
  const out: Record<string, Grade> = {};
  for (const c of COURSES) {
    const v = saved[c.id];
    out[c.id] = v === 'C' || v === 'B' || v === 'A' || v === 'S' ? v : gradeForHorseCourse(horse.id, c.id);
  }
  return out;
}
