import { eventByDow, dowOfTime } from '../data/events';

// 曜日イベントの「効果」をここに集める。
//
// 各画面が個別に曜日を見に行くと、イベントを止めたい／数値を変えたいときに
// 探し回ることになる。効果はぜんぶこのファイルの純関数にして、画面と store は
// ここを呼ぶだけにする。時刻は必ず引数で受け取る（端末の時計いじり対策で
// 呼ぶ側が trustedNow() を渡す前提。テストでも狙った曜日を作れる）。
//
// status: 'soon' の日は効果なし。events.ts のフラグを戻せば全部止まる。

/** その曜日のイベントが本番あつかいか。 */
export function eventLive(now: number, dow: number): boolean {
  return dowOfTime(now) === dow && eventByDow[dow]?.status === 'live';
}

// ── 月：草むらデー ───────────────────────────────────────────
/** ストックのたまる間隔(ms)。ふだん1時間、草むらデーは30分。 */
export function grassRegenMs(now: number, baseMs: number): number {
  return eventLive(now, 1) ? Math.round(baseMs / 2) : baseMs;
}
/** 「草をおかわり」の値段。草むらデーは半額。 */
export function okawariCost(now: number, base: number): number {
  return eventLive(now, 1) ? Math.floor(base / 2) : base;
}

// ── 火：トレーニングデー ─────────────────────────────────────
/** まぐれで2つ上がる確率。 */
export const TRAINING_CRIT_RATE = 0.25;
/** 育成が成功する割合。ふだんは半々。 */
export const TRAINING_SUCCESS_RATE = 0.5;
/** トレーニングデーの成功する割合。 */
export const TRAINING_SUCCESS_RATE_DAY = 0.75;
/** その日の成功する割合。 */
export function trainingSuccessRate(now: number): number {
  return eventLive(now, 2) ? TRAINING_SUCCESS_RATE_DAY : TRAINING_SUCCESS_RATE;
}

/** 能力値を1つ下げる「調整」に必要なアイテムの数。 */
export const TRIM_COST = 10;
/** トレーニングデーの調整の値段。半分で済む。 */
export const TRIM_COST_DAY = 5;
/** その日の調整の値段。 */
export function trimCost(now: number): number {
  return eventLive(now, 2) ? TRIM_COST_DAY : TRIM_COST;
}
/**
 * ステータスを1つ振ったときに実際に上がる量。
 * トレーニングデーは 25% で +2。ただし合計48の上限は超えないので、
 * あと1しか入らないときは +1 のまま（上限を破る抜け道にしない）。
 *
 * @param room 上限までの残り（48 - 現在の合計、かつ 1項目の上限までの残り）
 */
export function trainingGain(now: number, rng: () => number, room: number): number {
  if (room <= 1) return Math.max(0, Math.min(1, room));
  if (!eventLive(now, 2)) return 1;
  return rng() < TRAINING_CRIT_RATE ? 2 : 1;
}

// ── 水：万馬券デー ───────────────────────────────────────────
/** ボーナスがつく最低倍率。 */
export const TICKET_DAY_MIN_ODDS = 10;
/** 倍率に対する上乗せ率の上限（＝どんなに高倍率でも払戻の30%まで）。 */
export const TICKET_DAY_MAX_RATE = 0.3;
/**
 * 1レースの上乗せ額の上限（コイン）。
 *
 * 率だけの上限では歯止めにならない。3連単は1周で最高4,991倍まで出るので、
 * 上限1000コインを賭けて当てると払戻 4,991,000 → 上乗せだけで約150万コインが
 * 入り、ボックスや牧場の稼ぎが一瞬で意味を失う。率は据え置いたまま、絶対額でも
 * 頭を止める。払戻 166,666コイン（＝1000コインで167倍）までは上限に当たらないので、
 * ふだん遊ぶぶんには体感が変わらない。
 */
export const TICKET_DAY_MAX_BONUS = 50_000;
/**
 * 万馬券デーの上乗せ額。10倍以上の的中だけが対象で、倍率が高いほど率が上がる
 * （10倍で5%、100倍で上限の30%）。倍率そのものは動かさないので、
 * オッズのバランス（期待払戻0.80）には影響しない。
 * さらに TICKET_DAY_MAX_BONUS で絶対額にも上限をかける。
 */
export function ticketDayBonus(now: number, odds: number, payout: number): number {
  if (!eventLive(now, 3)) return 0;
  if (odds < TICKET_DAY_MIN_ODDS || payout <= 0) return 0;
  // 10倍→0.05、100倍→0.30 を対数でつなぐ。
  const t = Math.log10(odds / TICKET_DAY_MIN_ODDS); // 10倍で0、100倍で1
  const rate = Math.min(TICKET_DAY_MAX_RATE, 0.05 + t * 0.25);
  return Math.min(TICKET_DAY_MAX_BONUS, Math.floor(payout * rate));
}

// ── 木：図鑑デー ─────────────────────────────────────────────
/** SR の出る割合の倍率。図鑑デーは2倍。 */
export function srRateMul(now: number): number {
  return eventLive(now, 4) ? 2 : 1;
}
/** 未所持のパーツを優先して出すか。 */
export function prefersUnowned(now: number): boolean {
  return eventLive(now, 4);
}

// ── 金：グランプリデー ───────────────────────────────────────
/** G1 の1日の挑戦回数。ふだん3回、グランプリデーは6回。 */
export function g1Attempts(now: number, base: number): number {
  return eventLive(now, 5) ? base * 2 : base;
}
/** 対戦（トーナメント）の優勝賞金の倍率。 */
export function arenaPrizeMul(now: number): number {
  return eventLive(now, 5) ? 1.5 : 1;
}
