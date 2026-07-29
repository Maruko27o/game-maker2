import { describe, it, expect } from 'vitest';
import { rollGrade, rollAptitude, gradeForHorseCourse, aptitudeForHorseId, aptitudeOf } from './aptitude';
import { GRADES, GRADE_WEIGHTS, GRADE_STYLE, gradeChance, type Grade } from '../data/aptitude';
import { COURSES } from '../data/courses';
import { mulberry32 } from './stats';

describe('コース適性のデータ', () => {
  it('等級は C/B/A/S の4段階で、比は 5:3:2:1', () => {
    expect(GRADES).toEqual(['C', 'B', 'A', 'S']);
    expect(GRADES.map((g) => GRADE_WEIGHTS[g])).toEqual([5, 3, 2, 1]);
    expect(gradeChance('S')).toBeCloseTo(1 / 11, 5);
    expect(gradeChance('C')).toBeCloseTo(5 / 11, 5);
  });

  it('色は 銅/銀/金/虹 が割り当てられている', () => {
    expect(GRADE_STYLE.C.label).toBe('銅');
    expect(GRADE_STYLE.B.label).toBe('銀');
    expect(GRADE_STYLE.A.label).toBe('金');
    expect(GRADE_STYLE.S.label).toBe('虹');
    // 虹はグラデーション（単色ではない）
    expect(GRADE_STYLE.S.background).toContain('gradient');
  });

  it('コースは6つ（2×3の表で出せる）', () => {
    expect(COURSES).toHaveLength(6);
  });
});

describe('rollGrade の分布', () => {
  it('出現率がほぼ 5:3:2:1 になる', () => {
    const rng = mulberry32(777);
    const N = 30000;
    const hits: Record<string, number> = { C: 0, B: 0, A: 0, S: 0 };
    for (let i = 0; i < N; i++) hits[rollGrade(rng)]++;
    for (const g of GRADES) expect(hits[g] / N).toBeCloseTo(gradeChance(g), 1);
  });

  it('S はレア（おおよそ9%）', () => {
    const rng = mulberry32(31337);
    const N = 20000;
    let s = 0;
    for (let i = 0; i < N; i++) if (rollGrade(rng) === 'S') s++;
    const p = s / N;
    expect(p).toBeGreaterThan(0.07);
    expect(p).toBeLessThan(0.11);
  });
});

describe('rollAptitude', () => {
  it('6コースぶん、すべて有効な等級が入る', () => {
    const apt = rollAptitude(mulberry32(5));
    expect(Object.keys(apt).sort()).toEqual(COURSES.map((c) => c.id).sort());
    for (const c of COURSES) expect(GRADES).toContain(apt[c.id]);
  });

  it('コースごとに独立している（全部同じにならない）', () => {
    let varied = 0;
    for (let seed = 0; seed < 60; seed++) {
      const apt = rollAptitude(mulberry32(seed));
      if (new Set(Object.values(apt)).size > 1) varied++;
    }
    expect(varied).toBeGreaterThan(50);
  });
});

describe('既存ウマへの後付け付与（IDから決まる固定値）', () => {
  it('同じ ウマID×コースID なら必ず同じ等級（端末・クラウドでブレない）', () => {
    for (const id of ['h1', 'ウマ-01', '9f3a']) {
      for (const c of COURSES) {
        expect(gradeForHorseCourse(id, c.id)).toBe(gradeForHorseCourse(id, c.id));
      }
    }
  });

  it('ウマが違えば内容が変わる', () => {
    const a = aptitudeForHorseId('horse-a');
    const keys = COURSES.map((c) => c.id);
    let anyDifferent = false;
    for (let i = 0; i < 50; i++) {
      const b = aptitudeForHorseId(`horse-${i}`);
      if (keys.some((k) => a[k] !== b[k])) anyDifferent = true;
    }
    expect(anyDifferent).toBe(true);
  });

  it('aptitudeOf は保存値を優先し、欠けたコースだけ固定値で埋める', () => {
    const c0 = COURSES[0].id;
    const got = aptitudeOf({ id: 'x', apt: { [c0]: 'S' } });
    expect(got[c0]).toBe('S');
    for (const c of COURSES.slice(1)) expect(got[c.id]).toBe(gradeForHorseCourse('x', c.id));
  });

  it('壊れた保存値は無視して固定値にフォールバックする', () => {
    const c0 = COURSES[0].id;
    const got = aptitudeOf({ id: 'x', apt: { [c0]: 'Z' } });
    expect(GRADES).toContain(got[c0] as Grade);
    expect(got[c0]).toBe(gradeForHorseCourse('x', c0));
  });
});
