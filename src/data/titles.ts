import type { SaveData } from '../types';

// 称号。プロフィールで好きなものに付け替えられて、ランキングのアイコンを
// タップしたときの画面に「名前の下の肩書き」と「上の背景」として出る。
//
// 難しさは「1か月ふつうに遊んだとき、だいたい何割の人が持っているか」で6段階に
// そろえた。背景の作り込みも段でそろえる（下位はあっさり・上位ほど手が込む）。
// ここを揃えないと「簡単なのに一番派手」みたいな逆転が起きて、称号が意味を失う。
//
// 段ごとの数はそろえていない。「1万戦」「10万頭」のような長くやりこむ目標は
// どうしても最上段に集まるので、数を無理にそろえると難しさの方がゆがむ。
// 揃えるのは「難しさ ↔ 段 ↔ 背景の格」の対応であって、段ごとの点数ではない。

export type TitleTier = 1 | 2 | 3 | 4 | 5 | 6;

/** 段ごとの「1か月でどのくらいの人が持っているか」の目安と、背景の作り込み。 */
export const TIER_INFO: Record<TitleTier, { label: string; share: string; art: string }> = {
  1: { label: 'ふつう', share: 'ほぼ全員', art: '一色' },
  2: { label: 'なれてきた', share: '10人に6人', art: '二色＋斜めの帯' },
  3: { label: 'やりこみ', share: '10人に3人', art: 'グラデ＋ストライプ' },
  4: { label: 'かなり', share: '10人に1人', art: 'グラデ＋放射' },
  5: { label: 'ごく一部', share: '50人に1人', art: '放射＋流れる光' },
  6: { label: '伝説', share: '500人に1人', art: 'オーロラ＋きらめき' },
};

export type TitleDef = {
  id: string;
  name: string;
  /** 獲得条件の説明（プロフィールにそのまま出す）。 */
  desc: string;
  tier: TitleTier;
  /** 背景と名札の色（濃い→淡い）。 */
  colors: [string, string];
  /** 達成しているか。セーブ全体を見て判定する。 */
  check: (s: TitleCtx) => boolean;
};

/** 判定に使う値だけをまとめたもの（セーブそのものを持ち回らないため）。 */
export type TitleCtx = {
  races: number; // 走ったレースの数
  horsesFound: number; // 草むらで見つけたウマの通算数（引退させても減らない）
  wins: number; // 1着の数
  betsPlaced: number; // 買った馬券の枚数
  maxOdds: number; // 的中した最高倍率
  maxPayout: number; // 1レースの最大払戻
  totalEarned: number; // 通算で手に入れた賞金の合計（1人でレース・グランプリ・対戦）
  coins: number;
  streakBest: number; // 最高連勝
  collectPct: number; // 図鑑の集まり具合（0..100）
  gpTop3: number; // グランプリで3位以内に入った回数（G1のみトロフィーが出る）
  gpWins: number; // グランプリ優勝の回数
};

export function titleCtx(s: SaveData, collectPct: number): TitleCtx {
  // レースを走った数はタスクの通算カウンタが唯一の正確な値
  //（raceRecords は「コース×モードごとの自己ベスト」なので最大12件しかない）。
  return {
    races: s.tasks?.racesFinished ?? 0,
    // 「見つけた数」は手持ちの数とは別。引退させても減らないので、
    // ボックスの上限（30頭）に縛られずどこまでも伸びる。
    //
    // 草むらの回数（grassSpawns）とくらべて多い方を採る。草むらは1回引けば必ず
    // 1頭出るので、この2つは本来おなじ数になる。以前 stats を作り直して
    // horsesFound を消してしまう不具合があり、そのせいで称号が外れたので、
    // 片方が欠けても復帰できるように二重で持つ。
    horsesFound: Math.max(s.stats?.horsesFound ?? 0, s.tasks?.grassSpawns ?? 0),
    // 1着の数は 1着バッジの枚数で数える（レースごとに1枚もらえる）。
    wins: (s.badges ?? []).filter((b) => b.id === 'badge_1st').length,
    betsPlaced: s.stats?.betsPlaced ?? 0,
    maxOdds: s.stats?.maxOdds ?? 0,
    maxPayout: s.stats?.maxPayout ?? 0,
    totalEarned: s.stats?.totalEarned ?? 0,
    coins: s.coins ?? 0,
    streakBest: s.streakBest ?? 0,
    collectPct,
    gpTop3: (s.trophies ?? []).length,
    gpWins: (s.trophies ?? []).filter((t) => t.rank === 1).length,
  };
}

export const TITLES: TitleDef[] = [
  // ── 1段：ほぼ全員 ───────────────────────────────────────────
  { id: 'rookie', name: 'かけだし', desc: 'はじめから持っている', tier: 1, colors: ['#8a7a5c', '#c9bda1'], check: () => true },
  { id: 'horse_lover', name: 'ウマ好き', desc: 'ウマを5頭見つける', tier: 1, colors: ['#8a6a3f', '#cdae83'], check: (c) => c.horsesFound >= 5 },
  { id: 'first_win', name: 'はじめの一勝', desc: 'レースで1着をとる', tier: 1, colors: ['#6f8f4a', '#b9d99a'], check: (c) => c.wins >= 1 },
  { id: 'first_bet', name: 'ちょこっと予想', desc: '馬券を10枚買う', tier: 1, colors: ['#4a7f8f', '#a5d2dd'], check: (c) => c.betsPlaced >= 10 },
  { id: 'millionaire', name: 'ミリオネア', desc: '総獲得賞金100万コイン', tier: 1, colors: ['#5f7f4f', '#b6cf9a'], check: (c) => c.totalEarned >= 1_000_000 },

  // ── 2段：10人に6人 ──────────────────────────────────────────
  { id: 'regular', name: '常連さん', desc: 'レースを50回走る', tier: 2, colors: ['#5f8f4a', '#b6e08e'], check: (c) => c.races >= 50 },
  { id: 'rancher', name: '牧場主', desc: 'ウマを25頭見つける', tier: 2, colors: ['#8f6a35', '#e0bd80'], check: (c) => c.horsesFound >= 25 },
  { id: 'longshot', name: '穴党', desc: '20倍以上を的中させる', tier: 2, colors: ['#37b98a', '#a9f0d6'], check: (c) => c.maxOdds >= 20 },
  { id: 'dresser', name: 'おしゃれさん', desc: '図鑑を30%あつめる', tier: 2, colors: ['#a05f8f', '#e3b6da'], check: (c) => c.collectPct >= 30 },
  { id: 'multi_millionaire', name: 'マルチミリオネア', desc: '総獲得賞金1000万コイン', tier: 2, colors: ['#3f8f6a', '#a8e0c4'], check: (c) => c.totalEarned >= 10_000_000 },

  // ── 3段：10人に3人 ──────────────────────────────────────────
  { id: 'forecaster', name: 'ベテラン予想家', desc: '100倍以上を的中させる', tier: 3, colors: ['#3f7fd6', '#a9caf5'], check: (c) => c.maxOdds >= 100 },
  { id: 'streaker', name: '連勝の使い手', desc: '3連勝する', tier: 3, colors: ['#d68a2f', '#f5d296'], check: (c) => c.streakBest >= 3 },
  { id: 'gp_finalist', name: 'グランプリ入賞', desc: 'グランプリG1で3位以内', tier: 3, colors: ['#c07b45', '#eec49a'], check: (c) => c.gpTop3 >= 1 },
  { id: 'collector', name: '収集家', desc: '図鑑を60%あつめる', tier: 3, colors: ['#7a5fd0', '#c4b3f0'], check: (c) => c.collectPct >= 60 },
  { id: 'big_rancher', name: '大牧場主', desc: 'ウマを100頭見つける', tier: 3, colors: ['#8f7a30', '#dfcd90'], check: (c) => c.horsesFound >= 100 },
  { id: 'mega_millionaire', name: 'メガミリオネア', desc: '総獲得賞金5000万コイン', tier: 3, colors: ['#2f8fa0', '#a4dfe8'], check: (c) => c.totalEarned >= 50_000_000 },

  // ── 4段：10人に1人 ──────────────────────────────────────────
  { id: 'sharp_eye', name: '大穴の目利き', desc: '500倍以上を的中させる', tier: 4, colors: ['#e0a92e', '#ffe6a0'], check: (c) => c.maxOdds >= 500 },
  { id: 'tycoon', name: '大富豪', desc: 'コインを50万まで貯める', tier: 4, colors: ['#c9a227', '#ffe9a8'], check: (c) => c.coins >= 500_000 },
  { id: 'veteran', name: 'ひとすじ', desc: 'レースを300回走る', tier: 4, colors: ['#4a7a5f', '#a8d9bd'], check: (c) => c.races >= 300 },
  { id: 'turf_dweller', name: 'ターフの住人', desc: 'レースを500回走る', tier: 4, colors: ['#3f7a6a', '#a3ddcd'], check: (c) => c.races >= 500 },
  { id: 'many_wins', name: '常勝', desc: '1着を50回とる', tier: 4, colors: ['#c05a7a', '#f0aec2'], check: (c) => c.wins >= 50 },
  { id: 'century_win', name: '百勝の名手', desc: '1着を100回とる', tier: 4, colors: ['#9b4f8f', '#e3b0dd'], check: (c) => c.wins >= 100 },
  { id: 'plains_lord', name: '草原の主', desc: 'ウマを500頭見つける', tier: 4, colors: ['#4f8f3a', '#bde79b'], check: (c) => c.horsesFound >= 500 },
  { id: 'okuman', name: '億万長者', desc: '総獲得賞金1億コイン', tier: 4, colors: ['#c08a2a', '#f6dfa2'], check: (c) => c.totalEarned >= 100_000_000 },

  // ── 5段：50人に1人 ──────────────────────────────────────────
  { id: 'ticket_hunter', name: '万馬券ハンター', desc: '1000倍以上を的中させる', tier: 5, colors: ['#e0485f', '#ffb3bf'], check: (c) => c.maxOdds >= 1000 },
  { id: 'almost_all', name: '完全収集', desc: '図鑑を90%あつめる', tier: 5, colors: ['#9a5fe0', '#d8bcff'], check: (c) => c.collectPct >= 90 },
  { id: 'unbeaten', name: '無敗の采配', desc: '7連勝する', tier: 5, colors: ['#2f8fa8', '#a4dcea'], check: (c) => c.streakBest >= 7 },
  { id: 'champion', name: '頂点の証', desc: 'グランプリG1で優勝する', tier: 5, colors: ['#d8a72f', '#ffe9a8'], check: (c) => c.gpWins >= 1 },
  { id: 'lucky_hand', name: '豪運の持ち主', desc: '1レースで50万コイン以上の払戻', tier: 5, colors: ['#e08a2f', '#ffd8a0'], check: (c) => c.maxPayout >= 500_000 },
  { id: 'thousand_runs', name: '千戦の走り手', desc: 'レースを1000回走る', tier: 5, colors: ['#3f6fb8', '#aec7ee'], check: (c) => c.races >= 1000 },
  { id: 'five_hundred_wins', name: '五百勝の名将', desc: '1着を500回とる', tier: 5, colors: ['#b8452f', '#f2b3a3'], check: (c) => c.wins >= 500 },
  { id: 'ranch_king', name: '千頭の牧場王', desc: 'ウマを1000頭見つける', tier: 5, colors: ['#2f9a6a', '#a9e8c9'], check: (c) => c.horsesFound >= 1000 },
  { id: 'billionaire', name: 'ビリオネア', desc: '総獲得賞金10億コイン', tier: 5, colors: ['#e0b52a', '#fff0b0'], check: (c) => c.totalEarned >= 1_000_000_000 },

  // ── 6段：500人に1人 ─────────────────────────────────────────
  { id: 'legend_hit', name: '伝説の的中王', desc: '5000倍以上を的中させる', tier: 6, colors: ['#b06bff', '#ffd7f2'], check: (c) => c.maxOdds >= 5000 },
  { id: 'jackpot', name: '一攫千金', desc: '1レースで100万コイン以上の払戻', tier: 6, colors: ['#ffcf3a', '#fff2b6'], check: (c) => c.maxPayout >= 1_000_000 },
  { id: 'miracle_ten', name: '十連の奇跡', desc: '10連勝する', tier: 6, colors: ['#ff5fae', '#ffc4e4'], check: (c) => c.streakBest >= 10 },
  { id: 'dex_complete', name: '図鑑コンプリート', desc: '図鑑を100%あつめる', tier: 6, colors: ['#3ad7ff', '#c8f2ff'], check: (c) => c.collectPct >= 100 },
  { id: 'brave_5000', name: '五千戦の猛者', desc: 'レースを5000回走る', tier: 6, colors: ['#5fc0b0', '#c6f0e9'], check: (c) => c.races >= 5000 },
  { id: 'iron_runner', name: '万戦の鉄人', desc: 'レースを1万回走る', tier: 6, colors: ['#9aa8b8', '#e3ecf5'], check: (c) => c.races >= 10_000 },
  { id: 'thousand_wins', name: '千勝の英雄', desc: '1着を1000回とる', tier: 6, colors: ['#e03f5f', '#ffb0bf'], check: (c) => c.wins >= 1000 },
  { id: 'pioneer_5000', name: '五千頭の開拓者', desc: 'ウマを5000頭見つける', tier: 6, colors: ['#4fd08a', '#c8ffe4'], check: (c) => c.horsesFound >= 5000 },
  { id: 'lord_10000', name: '万頭のあるじ', desc: 'ウマを1万頭見つける', tier: 6, colors: ['#ffb648', '#ffe7bb'], check: (c) => c.horsesFound >= 10_000 },
  { id: 'ruler_50000', name: '五万頭の覇者', desc: 'ウマを5万頭見つける', tier: 6, colors: ['#ff7a5f', '#ffd0c2'], check: (c) => c.horsesFound >= 50_000 },
  { id: 'legend_100000', name: '十万頭の伝説', desc: 'ウマを10万頭見つける', tier: 6, colors: ['#8f7aff', '#d5cdff'], check: (c) => c.horsesFound >= 100_000 },
  { id: 'gold_emperor', name: 'ゴールドエンペラー', desc: '総獲得賞金100億コイン', tier: 6, colors: ['#7a3fd0', '#ffd76a'], check: (c) => c.totalEarned >= 10_000_000_000 },
];

export const titleById: Record<string, TitleDef> = Object.fromEntries(TITLES.map((t) => [t.id, t]));

/** いま獲得できている称号のID一覧（定義順）。 */
export function earnedTitles(c: TitleCtx): string[] {
  return TITLES.filter((t) => t.check(c)).map((t) => t.id);
}

/** 装備中の称号。未設定・未達成なら、達成しているうちで一番上の段のものを返す。 */
export function activeTitle(equipped: string | null | undefined, c: TitleCtx): TitleDef {
  const eq = equipped ? titleById[equipped] : undefined;
  if (eq && eq.check(c)) return eq;
  const owned = TITLES.filter((t) => t.check(c));
  return owned.reduce((best, t) => (t.tier > best.tier ? t : best), TITLES[0]);
}
