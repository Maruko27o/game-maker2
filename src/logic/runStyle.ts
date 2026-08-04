// Running style (脚質) derivation and pace curves (RACE_V2 §4.2).
import type { RunStyle, Stats } from '../types';
import { rngFromId, type RNG } from './stats';

// Pace multipliers on vMax by race phase — [early(0-40%), mid(40-75%), late(75-100%)].
// 脚質はレースの「形」を変えるだけで、速さそのものに有利不利を作ってはいけない。
//
// ここは以前「総仕事量はだいたい等しい」というつもりで手打ちしていたが、実際には
// 揃っていなかった。走破時計を決めるのは ∫ds/v なので、比べるべきは算術平均では
// なく調和平均で、素の値だと
//   逃げ 0.98499 ／ 先行 1.01224 ／ 差し 1.01551 ／ 追込 1.01261
// と逃げだけが約2.7%遅かった。全馬が数%差で競る設計なので2.7%は決定的で、
// 実測でも 2周で 逃げ2.9% ／ 先行39.6% ／ 差し18.3% ／ 追込39.2% と、
// 逃げのウマを引いたらほぼ勝てない状態になっていた。
// （スタミナ切れではない：バテている時間は逃げ2.3%・追込0.8%とほぼ差がなかった）
//
// そこで曲線は手で決めたまま、調和平均が必ず 1 になるようコードで正規化する。
// 形（前半で行く／後半に伸びる）はそのまま残り、速さの下駄だけが消える。
const PACE_RAW: Record<RunStyle, [number, number, number]> = {
  nige: [1.11, 1.0, 0.82],
  senko: [1.05, 1.01, 0.96],
  sashi: [0.95, 1.0, 1.17],
  oikomi: [0.91, 0.98, 1.31],
};
const PHASE_W: [number, number, number] = [0.4, 0.35, 0.25]; // 各区間の距離割合

// 前後の振れ幅。素の曲線（1.0）だと終盤の差が 逃げ0.83 対 追込1.29＝55% にもなり、
// 前半で作った差が最後の1/4で必ずひっくり返る＝逃げが構造的に勝てなかった。
// 0.7 まで落とすと「前で行く／後ろから伸びる」という形は残しつつ、勝負になる。
const SWING_AMP = 0.7;

/** 距離あたりの所要時間（＝調和平均）が 1 になるように揃える。 */
function normalizePace(p: [number, number, number]): [number, number, number] {
  const h = 1 / (PHASE_W[0] / p[0] + PHASE_W[1] / p[1] + PHASE_W[2] / p[2]);
  return [p[0] / h, p[1] / h, p[2] / h];
}

// 調和平均を揃えても、曲線の「形」そのものにコストが残る。速さは v^2.2 でスタミナを
// 食うので、前半で飛ばす形ほど同じ平均速度でも消費が大きく、勝負どころで垂れる。
// その分を埋める脚質ごとの水準。
//
// 合わせ込みは「実際に遊ぶときとまったく同じ分布」で行う。ここを取り違えると
// いくら回しても合わない：草むらのウマも対戦相手のCPUも
//   ① 脚質テンプレで能力を振り ② その能力から脚質を引き直す
// という手順なので、テンプレと実際の脚質は 34.9% しか一致しない。テンプレどおりの
// 8頭（各脚質2頭）で測ると、実戦とは逆向きの結果が出る。
//
// 全6コース × 1〜3周 × 各250レース、1頭あたりの勝率（均等なら12.5%）：
//   いちばん最初  逃げ 2.9% ／ 先行39.6% ／ 差し18.3% ／ 追込39.2%（各脚質2頭・均等25%）
//   合わせ込み前  逃げ13.0% ／ 先行13.1% ／ 差し11.4% ／ 追込12.4%
//   合わせ込み後  逃げ12.4% ／ 先行12.6% ／ 差し12.6% ／ 追込12.4%
// コース・周回ごとの得意不得意はそのまま残っている（例：ナイトサーキットは差しが
// 17%台で逃げが10%前後、やまみちトレイルはその逆）。
// 4つの平均は 1.0 に正規化してあるので、レース全体が速く／遅くなることはない。
const STYLE_LEVEL: Record<RunStyle, number> = {
  nige: 1.0007,
  senko: 0.9580,
  sashi: 1.0518,
  oikomi: 0.9896,
};

const PACE: Record<RunStyle, [number, number, number]> = Object.fromEntries(
  (Object.keys(PACE_RAW) as RunStyle[]).map((s) => {
    const raw = PACE_RAW[s];
    const k = STYLE_LEVEL[s];
    const swung: [number, number, number] = [
      1 + (raw[0] - 1) * SWING_AMP,
      1 + (raw[1] - 1) * SWING_AMP,
      1 + (raw[2] - 1) * SWING_AMP,
    ];
    const n = normalizePace(swung);
    return [s, [n[0] * k, n[1] * k, n[2] * k] as [number, number, number]];
  }),
) as Record<RunStyle, [number, number, number]>;

export function paceAt(style: RunStyle, progress: number): number {
  const p = PACE[style];
  if (progress < 0.4) return p[0];
  if (progress < 0.75) return p[1];
  return p[2];
}

/** テスト用：実際に使われるペース曲線（振れ幅・正規化・脚質水準こみ）。 */
export function paceCurve(style: RunStyle): [number, number, number] {
  return PACE[style];
}

// Preferred lateral offset as a fraction of half-width (−1 inner … +1 outer).
// Kept small: on an oval the outer lane is physically longer, so a big outward
// bias would hand front-runners a free distance edge over closers (RACE_V3 §4).
export const STYLE_BIAS: Record<RunStyle, number> = {
  nige: -0.4,
  senko: -0.2,
  sashi: 0.15,
  oikomi: 0.3,
};

/**
 * Choose a style from stats, weighted so spd pushes toward the front (逃げ/先行)
 * and gut pushes toward the back (差し/追込). Deterministic per horse id.
 */
function styleWeights(stats: Stats): Record<RunStyle, number> {
  const front = stats.spd - stats.gut; // >0 front-runner, <0 closer
  return {
    nige: 1 + Math.max(0, front) * 0.5,
    senko: 1.4 + Math.max(0, front) * 0.3,
    sashi: 1.4 + Math.max(0, -front) * 0.3,
    oikomi: 1 + Math.max(0, -front) * 0.5,
  };
}

/** 能力から脚質を1つ引く。u は 0..1 の一様乱数。
 *
 *  プレイヤーのウマは「脚質テンプレで能力を振る → その能力から脚質を引き直す」ので、
 *  テンプレどおりの脚質で走るのは実測 34.9% だけ（例：追込テンプレのウマが逃げで
 *  走るのが12.3%）。CPU だけがテンプレと100%一致していたため、同じ合計値でも
 *  プレイヤーが構造的に不利だった（実戦計測で勝率10.7%。均等なら12.5%）。
 *  CPU 側もこの関数を通すことで、両者の「脚質と能力のかみ合い方」を揃える。 */
export function pickStyle(stats: Stats, u: number): RunStyle {
  const w = styleWeights(stats);
  const styles: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
  const total = styles.reduce((n, s) => n + w[s], 0);
  let r = u * total;
  for (const s of styles) {
    r -= w[s];
    if (r < 0) return s;
  }
  return 'senko';
}

export function styleFor(id: string, stats: Stats): RunStyle {
  const rng: RNG = rngFromId(id + ':style');
  return pickStyle(stats, rng());
}

/** The most likely style for a stat spread, with no RNG — used to preview the
 *  running style live while the player allocates points (RACE_V3 §3.3). */
export function predictStyle(stats: Stats): RunStyle {
  const w = styleWeights(stats);
  const styles: RunStyle[] = ['nige', 'senko', 'sashi', 'oikomi'];
  return styles.reduce((best, s) => (w[s] > w[best] ? s : best), 'senko' as RunStyle);
}
