import { describe, it, expect } from 'vitest';
import { rollSkill, skillForHorseId, skillOf } from './skill';
import { SKILLS, SKILL_BY_ID, STAR_WEIGHTS, starChance, type SkillStar } from '../data/skills';
import { mulberry32 } from './stats';

describe('固有スキルのデータ', () => {
  it('30〜50種そろっていて、IDが重複しない', () => {
    expect(SKILLS.length).toBeGreaterThanOrEqual(30);
    expect(SKILLS.length).toBeLessThanOrEqual(50);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
  });

  it('名前も重複しない（図鑑で紛らわしくない）', () => {
    expect(new Set(SKILLS.map((s) => s.name)).size).toBe(SKILLS.length);
  });

  it('星1〜5がすべて存在し、レアなほど種類が少ない', () => {
    const counts = ([1, 2, 3, 4, 5] as SkillStar[]).map((st) => SKILLS.filter((s) => s.star === st).length);
    for (const c of counts) expect(c).toBeGreaterThan(0);
    // 星1 ≥ 星2 ≥ … ≥ 星5
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThanOrEqual(counts[i - 1]);
  });

  it('どのスキルにも効果の説明がある', () => {
    for (const s of SKILLS) expect(s.effect.length).toBeGreaterThan(3);
  });

  it('星の出現比は 5:4:3:2:1', () => {
    expect([1, 2, 3, 4, 5].map((s) => STAR_WEIGHTS[s as SkillStar])).toEqual([5, 4, 3, 2, 1]);
    expect(starChance(5)).toBeCloseTo(1 / 15, 5);
    expect(starChance(1)).toBeCloseTo(5 / 15, 5);
  });
});

describe('rollSkill の分布', () => {
  it('星の出現率がほぼ 5:4:3:2:1 になる', () => {
    const rng = mulberry32(12345);
    const N = 30000;
    const hits: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (let i = 0; i < N; i++) hits[rollSkill(rng).star]++;
    for (const st of [1, 2, 3, 4, 5] as SkillStar[]) {
      expect(hits[st] / N).toBeCloseTo(starChance(st), 1);
    }
  });

  it('星5は珍しい（おおよそ7%）', () => {
    const rng = mulberry32(999);
    const N = 20000;
    let five = 0;
    for (let i = 0; i < N; i++) if (rollSkill(rng).star === 5) five++;
    const p = five / N;
    expect(p).toBeGreaterThan(0.05);
    expect(p).toBeLessThan(0.09);
  });

  it('同じ段のスキルがどれも出る（偏って死に札にならない）', () => {
    const rng = mulberry32(4242);
    const seen = new Set<string>();
    for (let i = 0; i < 20000; i++) seen.add(rollSkill(rng).id);
    expect(seen.size).toBe(SKILLS.length);
  });
});

describe('既存ウマへの後付け付与（IDから決まる固定スキル）', () => {
  it('同じIDなら何度呼んでも同じスキル（端末・クラウドでブレない）', () => {
    for (const id of ['h1', 'abc', 'ウマ-01', '9f3a']) {
      expect(skillForHorseId(id).id).toBe(skillForHorseId(id).id);
    }
  });

  it('IDが違えばバラける（全員同じにならない）', () => {
    const ids = Array.from({ length: 200 }, (_, i) => `horse-${i}`);
    const got = new Set(ids.map((id) => skillForHorseId(id).id));
    expect(got.size).toBeGreaterThan(10);
  });

  it('skillOf は保存値を優先し、無ければIDから決まる固定スキルを返す', () => {
    const saved = SKILLS[7];
    expect(skillOf({ id: 'x', skill: saved.id }).id).toBe(saved.id);
    expect(skillOf({ id: 'x' }).id).toBe(skillForHorseId('x').id);
    // 壊れた保存値でも落ちない
    expect(SKILL_BY_ID[skillOf({ id: 'x', skill: 'no_such_skill' }).id]).toBeDefined();
  });
});
