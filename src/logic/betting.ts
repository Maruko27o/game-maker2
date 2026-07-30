// Betting markets (RACE_V4 §4 / 改修①). Five 馬券 types, all priced off the same
// deterministic win probabilities (`winProbs`) so odds are consistent with the
// popularity shown in the paddock. A Harville top-3 model turns win probabilities
// into place/pair/triple probabilities. Everything carries the 0.80 takeout.
// No real money — stakes and payouts are in-game coins.
import { winProbs } from './grandprix';
import type { Entrant } from './raceSim2';
import type { Course } from '../data/courses';
import type { BetKind } from '../types';

export type { BetKind };

// Display metadata + selection rules per market.
export const BET_KINDS: { kind: BetKind; label: string; pick: number; ordered: boolean; hint: string }[] = [
  { kind: 'win', label: '単勝', pick: 1, ordered: false, hint: '1着を当てる' },
  { kind: 'place', label: '複勝', pick: 1, ordered: false, hint: '3着以内に入れば的中' },
  { kind: 'quinella', label: '馬連', pick: 2, ordered: false, hint: '1・2着の組み合わせ（順不同）' },
  { kind: 'wide', label: 'ワイド', pick: 2, ordered: false, hint: '選んだ2頭がともに3着以内' },
  { kind: 'trifecta', label: '3連単', pick: 3, ordered: true, hint: '1・2・3着を着順どおりに' },
];

const TAKEOUT = 0.8; // 80% payout
// 倍率の上限：以前は9999で頭打ちだったが、大波乱の妙味を削っていたので大きく緩めた。
// 単勝・複勝・馬連・ワイドは実測でも最大3万倍ほどなので、事実上「上限なし」で動く。
// 3連単だけは組み合わせが爆発して1000万倍級になりうるため、ここで頭を止める
// （最大賭け金1000コインでも払戻が青天井にならないようにするための安全弁）。
export const MAX_ODDS = 100_000;
//
// 下限は 1.0 倍（元返し）。ここを 1.1 にしていたことで、複勝のように的中率が
// 9割を超える買い目で「公正倍率(0.8/確率) < 1.1」となり、期待値が1を超えて
// “必ず儲かる”状態になっていた（実測 複勝の最大期待値 1.0719）。
// 1.0 なら 期待値 = 確率 × max(1.0, 0.8/確率) ≤ 1 が常に成り立つ。
const clampOdds = (o: number) =>
  Number.isFinite(o) ? Math.min(MAX_ODDS, Math.max(1.0, o)) : MAX_ODDS;

export type Bet = { kind: BetKind; sel: number[]; amount: number; odds: number };

// ── 2着・3着の確率モデル ────────────────────────────────────────────────
// 素の Harville（1着を決め、残りから2着…と順に引く）だと「本命が勝てないなら
// 次の人気馬が2着」という形に確率が集中しすぎる。実際のレース（このゲームのシムも）
// 2着・3着はもっとばらけるので、それ以外の組み合わせの確率を低く見積もり過ぎ、
// 馬連・ワイド・3連単の倍率が跳ね上がっていた。
//
// 実測（各設定120レース。「その馬券を1点買い続けたときの1コインあたり期待払戻」で、
// 本来は TAKEOUT=0.80 になるはず）：
//   通常8頭2周   複勝1.37 馬連2.08 ワイド4.93 3連単4.48（3連単の最高当選 60,144倍）
//   GP本戦8頭3周 複勝1.44 馬連1.44 ワイド3.20 3連単4.60（同 68,842倍）
// つまり倍率が数倍高すぎ、当たるはずのない万馬券が普通に当たる状態だった。
//
// 対策は競馬のオッズ理論で標準的な Henery 型の割引。2着・3着の条件付き確率を
// p^λ（λ<1）でなだらかにする。各段で分母を取り直すので Σ=1 は保たれ、確率分布と
// しては正しいまま。あわせてモンテカルロ推定のゆらぎ（1/p は凸なので薄い確率ほど
// 倍率が跳ねる）を抑えるため、この中だけで確率をわずかに一様へ寄せる。
//
// 単勝は生の p をそのまま使う（raceOddsFromProbs）ので、「単勝の倍率＝実際の勝率」
// という今のバランスは一切動かない。
// 補正後（同じ120レース）：
//   通常8頭2周   複勝0.79 馬連0.87 ワイド0.81 3連単0.82（最高 4,042倍）
//   GP本戦8頭3周 複勝0.81 馬連0.77 ワイド0.83 3連単0.77（最高 1,507倍）
//   通常8頭1周   複勝0.80 馬連0.84 ワイド0.83 3連単0.80（最高 4,261倍）
// 補正の強さは周回数で変える。長いレースほど道中で順位が入れ替わり、2着3着が
// 1着の勝率から離れていくので、強く割り引く必要がある。実測（各設定120レース）で
// 周回ごとに最適値を探し、直線で結んだもの：
//   1周 λ2=1.00 λ3=0.90 ε=0.08 ／ 2周 0.88/0.65/0.14 ／ 3周 0.75/0.40/0.20
// これで 1周〜3周・6頭〜8頭のどれでも期待払戻が 0.77〜0.97 に収まる
// （固定値だと1周が 0.58 まで落ちていた）。
export const DEFAULT_LAPS = 2;
export function top3Params(laps: number): { l2: number; l3: number; mix: number } {
  const L = Math.max(1, Math.min(3, laps || DEFAULT_LAPS));
  return { l2: 1.125 - 0.125 * L, l3: 1.15 - 0.25 * L, mix: 0.08 + 0.06 * (L - 1) };
}

// Top-3 orderings: P((a,b,c) finish 1st/2nd/3rd). Σ = 1. n=8 → 336 terms.
function top3(p0: number[], laps: number): { a: number; b: number; c: number; prob: number }[] {
  const { l2, l3, mix } = top3Params(laps);
  const n = p0.length;
  const p = p0.map((x) => (1 - mix) * x + mix / n);
  const q2 = p.map((x) => Math.pow(Math.max(x, 1e-12), l2));
  const q3 = p.map((x) => Math.pow(Math.max(x, 1e-12), l3));
  const out: { a: number; b: number; c: number; prob: number }[] = [];
  for (let a = 0; a < n; a++) {
    let d2 = 0;
    for (let k = 0; k < n; k++) if (k !== a) d2 += q2[k];
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      let d3 = 0;
      for (let k = 0; k < n; k++) if (k !== a && k !== b) d3 += q3[k];
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        out.push({ a, b, c, prob: p[a] * (q2[b] / (d2 || 1e-12)) * (q3[c] / (d3 || 1e-12)) });
      }
    }
  }
  return out;
}

/** Probability that a selection hits, by market. `sel` are entrant indices.
 *  `laps` は2着3着モデルの補正の強さに効く（周回数が多いほど強く割り引く）。 */
export function selProb(kind: BetKind, sel: number[], p: number[], laps = DEFAULT_LAPS): number {
  if (kind === 'win') return p[sel[0]] ?? 0;
  const tr = top3(p, laps);
  if (kind === 'place') return tr.reduce((s, t) => s + (t.a === sel[0] || t.b === sel[0] || t.c === sel[0] ? t.prob : 0), 0);
  if (kind === 'trifecta') return tr.reduce((s, t) => s + (t.a === sel[0] && t.b === sel[1] && t.c === sel[2] ? t.prob : 0), 0);
  const [i, j] = sel;
  if (kind === 'quinella') return tr.reduce((s, t) => s + (((t.a === i && t.b === j) || (t.a === j && t.b === i)) ? t.prob : 0), 0);
  if (kind === 'wide') return tr.reduce((s, t) => s + ([t.a, t.b, t.c].includes(i) && [t.a, t.b, t.c].includes(j) ? t.prob : 0), 0);
  return 0;
}

/** Decimal odds for a selection (with takeout, clamped). */
export function oddsFor(kind: BetKind, sel: number[], p: number[], laps = DEFAULT_LAPS): number {
  const prob = selProb(kind, sel, p, laps);
  return prob > 0 ? clampOdds((1 / prob) * TAKEOUT) : MAX_ODDS;
}

/** 倍率の表示用フォーマット：小数第2位まで・切り捨て（四捨五入しない）。
 *  払戻＝floor(賭け金×倍率) と一致させ、「1.5倍」表示なのに実際は1.48倍…という
 *  誤差をなくす。例）1.4837→"1.48"、2→"2.00"。FP 誤差対策に微小値を足す。 */
export function fmtOdds(x: number): string {
  // 桁の見間違いを無くすため、書式を常に揃える。
  //   ・小数第1位を必ず表示する（".0" でも省略しない）→ 小数点の位置が毎回同じ。
  //   ・1000倍以上は3桁ごとにカンマを入れる → "1,001.0" と "100.1" が一目で違う。
  // 第2位以下は切り捨て（切り上げない）。"1.5倍" と出ていれば必ず1.5倍以上あるので、
  // 連勝条件（払戻1.5倍以上）の判定と食い違わない。
  const t = Math.floor(x * 10 + 1e-6) / 10;
  return t.toLocaleString('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Win odds/popularity table for the paddock header (people bet from 人気).
export type OddsRow = { idx: number; odds: number; pop: number };
export function raceOdds(entrants: Entrant[], course: Course): OddsRow[] {
  return raceOddsFromProbs(winProbs(entrants, course));
}

/** Same as raceOdds but from pre-computed win probabilities (e.g. Monte-Carlo). */
export function raceOddsFromProbs(p: number[]): OddsRow[] {
  const order = p.map((_, i) => i).sort((a, b) => p[b] - p[a]);
  const pop = new Array<number>(p.length);
  order.forEach((idx, place) => (pop[idx] = place + 1));
  return p.map((pi, idx) => ({ idx, odds: clampOdds((1 / pi) * TAKEOUT), pop: pop[idx] }));
}

/** Settle a bet against a finishing order (entrant indices, 1st..last). Returns
 *  the payout in coins (0 if it lost). */
export function settle(bet: Bet, order: number[]): number {
  const top = order.slice(0, 3);
  const [a, b] = order; // 1st, 2nd entrant indices
  let won = false;
  switch (bet.kind) {
    case 'win':
      won = bet.sel[0] === order[0];
      break;
    case 'place':
      won = top.includes(bet.sel[0]);
      break;
    case 'quinella': {
      const s = new Set([a, b]);
      won = bet.sel.length === 2 && bet.sel.every((x) => s.has(x));
      break;
    }
    case 'wide':
      won = bet.sel.length === 2 && bet.sel.every((x) => top.includes(x));
      break;
    case 'trifecta':
      won = bet.sel[0] === order[0] && bet.sel[1] === order[1] && bet.sel[2] === order[2];
      break;
  }
  return won ? Math.floor(bet.amount * bet.odds) : 0;
}

/** Would this bet win if the race ended right now? Used for the in-race
 *  "的中見込み" glow. `ranks[entrantIdx]` = current rank (1..n). */
export function wouldWin(bet: Bet, ranks: number[]): boolean {
  const order = ranks.map((_, i) => i).sort((x, y) => ranks[x] - ranks[y]);
  return settle({ ...bet, amount: Math.max(1, bet.amount) }, order) > 0;
}

// 馬券が当たるのに必要な着順の数（払戻圏の広さ）。単勝は1着だけ、複勝/ワイド/3連単は3着まで。
const PAYLINE: Record<BetKind, number> = { win: 1, place: 3, quinella: 2, wide: 3, trifecta: 3 };

// How close a bet is to hitting *right now* (RACE §in-race見込み): 3 的中 (would pay
// if the race ended now), 2 ニアピン, 1 普通, 0 圏外. Drives the tag colour and the sort.
//
// 判定は「いちばん出遅れている買い目」で決める。1頭でも払戻圏から大きく離れていたら、
// 残りが1着2着でも色は付かない（3連単の1頭が最下位なのに金、を防ぐ）。
// slack = そのウマの現在順位 − 払戻圏の着順（0以下＝圏内、1＝1つ外）。
export type BetTier = 0 | 1 | 2 | 3;
export function betTier(bet: Bet, ranks: number[]): BetTier {
  if (wouldWin(bet, ranks)) return 3;
  const n = ranks.length;
  const line = PAYLINE[bet.kind];
  // 圏外に落ちるまでの猶予。頭数が少ないレースで「全員が普通」にならないよう頭数で絞る。
  const reach = Math.min(3, Math.max(1, Math.ceil((n - line) / 2)));
  // いちばん悪い買い目の slack。未出走・不明なウマは圏外扱い。
  const worst = bet.sel.reduce((w, i) => {
    const r = ranks[i];
    return Math.max(w, r == null ? Infinity : r - line);
  }, -Infinity);
  if (worst <= 1) return 2; // 全頭が圏内、または1つ外まで＝ニアピン（3連単の順違いもここ）
  if (worst <= reach) return 1; // 全頭がまだ射程内＝普通
  return 0; // 1頭でも大きく離れていたら圏外
}
