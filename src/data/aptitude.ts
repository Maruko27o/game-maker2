// コース適性（個体値厳選アップデート）。6つのコースそれぞれに C / B / A / S が付く。
//
// 出現比は C:B:A:S = 5:3:2:1（C が一番出やすく、S が一番レア＝約9%）。
// 色は 銅(C) / 銀(B) / 金(A) / 虹(S)。
//
// ★重要★ この時点では表示のみ。レースの挙動・倍率には一切つながっていない。
// シムへの接続は最後のPRでまとめて行い、倍率バランスの回帰テストと突き合わせて調整する。

export type Grade = 'C' | 'B' | 'A' | 'S';

/** 出現比（C:B:A:S = 5:3:2:1）。 */
export const GRADE_WEIGHTS: Record<Grade, number> = { C: 5, B: 3, A: 2, S: 1 };

export const GRADES: Grade[] = ['C', 'B', 'A', 'S'];

/** 表示用の色。S は虹（グラデーション）なので背景をまるごと持たせる。 */
export const GRADE_STYLE: Record<Grade, { label: string; ink: string; background: string; border: string }> = {
  C: { label: '銅', ink: '#5b3a1c', background: 'linear-gradient(180deg,#d9a273,#b97742)', border: '#8f5a2f' },
  B: { label: '銀', ink: '#3f4650', background: 'linear-gradient(180deg,#e9eef3,#b9c4cf)', border: '#8d99a6' },
  A: { label: '金', ink: '#5a3f00', background: 'linear-gradient(180deg,#ffe9a8,#e9b93c)', border: '#b8871f' },
  S: {
    label: '虹',
    ink: '#3a2c1c',
    background: 'linear-gradient(100deg,#ff9aa2,#ffd59a,#fdff9a,#9affb0,#9ad9ff,#c4a2ff)',
    border: '#8f7bd0',
  },
};

/** その等級が出る確率（0..1）。図鑑・説明の「出やすさ」に使う。 */
export function gradeChance(g: Grade): number {
  const total = GRADES.reduce((s, x) => s + GRADE_WEIGHTS[x], 0);
  return GRADE_WEIGHTS[g] / total;
}
