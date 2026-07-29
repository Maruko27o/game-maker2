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

// Harville top-3 orderings: P((a,b,c) finish 1st/2nd/3rd). Σ ≈ 1. n=8 → 336 terms.
function top3(p: number[]): { a: number; b: number; c: number; prob: number }[] {
  const n = p.length;
  const out: { a: number; b: number; c: number; prob: number }[] = [];
  for (let a = 0; a < n; a++) {
    const da = 1 - p[a];
    for (let b = 0; b < n; b++) {
      if (b === a) continue;
      const dab = da - p[b];
      for (let c = 0; c < n; c++) {
        if (c === a || c === b) continue;
        out.push({ a, b, c, prob: p[a] * (p[b] / (da || 1e-9)) * (p[c] / (dab || 1e-9)) });
      }
    }
  }
  return out;
}

/** Probability that a selection hits, by market. `sel` are entrant indices. */
export function selProb(kind: BetKind, sel: number[], p: number[]): number {
  if (kind === 'win') return p[sel[0]] ?? 0;
  const tr = top3(p);
  if (kind === 'place') return tr.reduce((s, t) => s + (t.a === sel[0] || t.b === sel[0] || t.c === sel[0] ? t.prob : 0), 0);
  if (kind === 'trifecta') return tr.reduce((s, t) => s + (t.a === sel[0] && t.b === sel[1] && t.c === sel[2] ? t.prob : 0), 0);
  const [i, j] = sel;
  if (kind === 'quinella') return tr.reduce((s, t) => s + (((t.a === i && t.b === j) || (t.a === j && t.b === i)) ? t.prob : 0), 0);
  if (kind === 'wide') return tr.reduce((s, t) => s + ([t.a, t.b, t.c].includes(i) && [t.a, t.b, t.c].includes(j) ? t.prob : 0), 0);
  return 0;
}

/** Decimal odds for a selection (with takeout, clamped). */
export function oddsFor(kind: BetKind, sel: number[], p: number[]): number {
  const prob = selProb(kind, sel, p);
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
