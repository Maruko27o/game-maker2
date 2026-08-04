import { describe, it, expect } from 'vitest';
import { simulate2, type Entrant } from './raceSim2';
import { COURSES } from '../data/courses';
import { ARENA_FORM_SCALE } from '../data/arena';
import { mulberry32, rollStatsForStyle } from './stats';

// 対戦（アリーナ）は「固有スキル・適性・能力値の勝負」にしたいので、調子と運のブレを
// ARENA_FORM_SCALE で弱めている。ここはその効き目のガード：
//   ・弱めたぶん、強いウマが勝つ割合が確実に上がること
//   ・とはいえ0にはしていないので、番狂わせの余地は残ること
// 通常レース（formScale=1）の分布は触っていないので、倍率バランスには影響しない。

function mkField(seed: number): Entrant[] {
  const rng = mulberry32(seed);
  return Array.from({ length: 8 }, (_, i) => {
    const style = (['nige', 'senko', 'sashi', 'oikomi'] as const)[i % 4];
    const stats = rollStatsForStyle(rng, 34 + i * 2, style); // i=7 が最強（合計48）
    return { horseId: `e${i}`, name: `E${i}`, stats, style, isPlayer: i === 0 } as Entrant;
  });
}

/** 最強馬（idx 7）の勝率(%)。 */
// サンプルは多めに取る。効き幅は3〜5ポイントしかないので、少ないと当たり外れで
// 逆転して落ちる（45シード＝270レースだと 38.9→43.3 と 38.5→41.5 の間で揺れ、
// 「3ポイント以上」を満たしたり満たさなかったりした）。120シード＝720レースなら
// 片側の誤差が2ポイント弱に収まる。
function strongestWinRate(form: number): number {
  const courses = COURSES;
  const seeds = 120;
  let wins = 0;
  let n = 0;
  for (const course of courses) {
    for (let s = 0; s < seeds; s++) {
      const r = simulate2(mkField(s * 37 + 5), course, 60, s * 13 + 1, { formScale: form });
      if (r.order[0] === 7) wins++;
      n++;
    }
  }
  return (100 * wins) / n;
}

describe('対戦の調子ブレ（ARENA_FORM_SCALE）', () => {
  it('通常より能力どおりに決まりやすいが、番狂わせの余地は残る', () => {
    const normal = strongestWinRate(1);
    const arena = strongestWinRate(ARENA_FORM_SCALE);
    console.log(`最強馬の勝率: 通常 ${normal.toFixed(1)}% → 対戦 ${arena.toFixed(1)}%`);
    // 能力勝負に寄る（実測 39% → 43%。効き幅そのものが3〜5ポイントなので、
    // 「確かに上がっている」と言える 2ポイントを下限にする）
    expect(arena).toBeGreaterThan(normal + 2);
    // ただし一強ではない（強い馬でも半分近くは取りこぼす＝読み合いが残る）
    expect(arena).toBeLessThan(80);
    expect(ARENA_FORM_SCALE).toBeGreaterThan(0); // 完全な能力順にはしない
    expect(ARENA_FORM_SCALE).toBeLessThan(1);
  }, 180000);

  it('formScale は通常レースの既定値を変えない（倍率バランスに影響しない）', () => {
    const field = mkField(11);
    const a = simulate2(field, COURSES[0], 60, 4242);
    const b = simulate2(field, COURSES[0], 60, 4242, { formScale: 1 });
    expect(a.order).toEqual(b.order);
    expect(a.finishTimes).toEqual(b.finishTimes);
  });

  it('formScale=0 なら調子のブレが消え、同じ顔ぶれなら結果がぶれにくい', () => {
    const field = mkField(11);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const winners = new Set(seeds.map((s) => simulate2(field, COURSES[0], 60, s, { formScale: 0 }).order[0]));
    const winnersNoisy = new Set(seeds.map((s) => simulate2(field, COURSES[0], 60, s).order[0]));
    expect(winners.size).toBeLessThanOrEqual(winnersNoisy.size);
  }, 60000);
});
