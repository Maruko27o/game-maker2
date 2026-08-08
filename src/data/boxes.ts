import type { StatKey } from '../types';

// 週末のごほうびボックス（曜日イベント）。
//
// 土曜＝ラッキーボックス（育成系）／日曜＝ゴールドボックス（お金系）。
// 「同じ箱のランク違い」ではなく中身のジャンルで分けているので、
// どちらを開けているのか迷わない。
//
// もらえるのは「馬券を買った一人でレース」で1着をとったときだけ。無料の練習で
// いくらでも増やせると、0.1% のフレームが的当てゲームになってしまうため。
// 受信箱に種類ごと1行でたまり、個数が ×4 のように増える。開けるのはいつでもよい。

export type BoxKind = 'lucky' | 'gold';

/** 中身のレアリティ。開封演出の派手さと溜めの長さもこれで決める。 */
export type BoxRarity = 'normal' | 'rare' | 'epic' | 'legend';

export type BoxReward =
  | { type: 'coins'; amount: number }
  | { type: 'ticket'; amount: number } // 厳選チケット
  | { type: 'item'; stat: StatKey | 'any'; amount: number } // 育成アイテム
  | { type: 'dye' } // 染料（色は開けたときに抽選）
  | { type: 'frame' } // その箱だけの限定フレーム
  | { type: 'title' }; // その箱だけの限定称号

export type BoxSlot = {
  /** 抽選の重み。合計に対する割合が排出率になる。 */
  weight: number;
  rarity: BoxRarity;
  /** i ボタンの一覧に出す名前。 */
  label: string;
  reward: BoxReward;
};

export type BoxDef = {
  kind: BoxKind;
  name: string;
  /** 受信箱と開封画面の色（濃い→淡い）。 */
  colors: [string, string];
  lead: string;
  /** 限定フレームの当たる割合（0.001 ＝ 0.1%）。 */
  frameRate: number;
  /** 限定称号の当たる割合（0.003 ＝ 0.3%）。フレームより少しだけ出やすい。 */
  titleRate: number;
  slots: BoxSlot[];
};

// 限定枠（フレーム・称号）は重みではなく「1/N」で先に判定する（重みに混ぜると、
// 他の中身を増減させたときに確率が動いてしまう）。slots には入れず別に持つ。
// どちらの箱も フレーム＝0.1%（最レア）／称号＝0.3% でそろえてある。

/** 土曜：育成系。ウマを強くするものが出る。 */
export const LUCKY_BOX: BoxDef = {
  kind: 'lucky',
  name: 'ラッキーボックス',
  colors: ['#d0417a', '#ffb3cd'],
  lead: '育てるためのご褒美が入っているよ。',
  frameRate: 0.001,
  titleRate: 0.003,
  slots: [
    { weight: 34, rarity: 'normal', label: '育成アイテム ×1', reward: { type: 'item', stat: 'any', amount: 1 } },
    { weight: 20, rarity: 'normal', label: 'コイン 2,000', reward: { type: 'coins', amount: 2000 } },
    { weight: 16, rarity: 'normal', label: '染料 ×1', reward: { type: 'dye' } },
    { weight: 14, rarity: 'rare', label: '育成アイテム ×3', reward: { type: 'item', stat: 'any', amount: 3 } },
    { weight: 10, rarity: 'rare', label: '厳選チケット ×1', reward: { type: 'ticket', amount: 1 } },
    { weight: 5, rarity: 'epic', label: '厳選チケット ×3', reward: { type: 'ticket', amount: 3 } },
    { weight: 1, rarity: 'epic', label: '育成アイテム ×10', reward: { type: 'item', stat: 'any', amount: 10 } },
  ],
};

/** 日曜：お金系。とにかくコインが出る。 */
export const GOLD_BOX: BoxDef = {
  kind: 'gold',
  name: 'ゴールドボックス',
  colors: ['#b8860b', '#ffd76a'],
  lead: 'コインがたっぷり入っているよ。',
  frameRate: 0.001,
  titleRate: 0.003,
  // 1箱あたりの平均は約 3,700 コイン。上の段を絞って、下に 500 を足した。
  // 100,000 は 1% ＝ 100箱に1回。それでも平均の3割弱をこの1段が担っているので、
  // 「たまに大当たりする箱」という手ざわりは残る。
  slots: [
    // 1箱あたりの平均は 2,350コイン。
    //
    // 以前は平均 3,730 で、10個開ければ約37,000コイン。対戦の優勝賞金 12,000 を
    // ボックス3個ぶんで超えてしまい、勝ち抜きトーナメントを戦う意味が薄かった。
    // **100,000コインの1%はそのまま残し**、その下の段を絞って平均だけ下げている
    // （夢のある一撃は残したまま、日常的な稼ぎだけを減らす）。
    { weight: 60, rarity: 'normal', label: 'コイン 500', reward: { type: 'coins', amount: 500 } },
    { weight: 25, rarity: 'normal', label: 'コイン 1,000', reward: { type: 'coins', amount: 1000 } },
    { weight: 10, rarity: 'normal', label: 'コイン 2,500', reward: { type: 'coins', amount: 2500 } },
    { weight: 3, rarity: 'rare', label: 'コイン 10,000', reward: { type: 'coins', amount: 10000 } },
    { weight: 1, rarity: 'epic', label: 'コイン 25,000', reward: { type: 'coins', amount: 25000 } },
    { weight: 1, rarity: 'epic', label: 'コイン 100,000', reward: { type: 'coins', amount: 100000 } },
  ],
};

export const BOXES: Record<BoxKind, BoxDef> = { lucky: LUCKY_BOX, gold: GOLD_BOX };
export const BOX_KINDS: BoxKind[] = ['lucky', 'gold'];

/** その曜日にもらえる箱（0=日 … 6=土）。それ以外の曜日はもらえない。 */
export function boxOfDow(dow: number): BoxKind | null {
  if (dow === 6) return 'lucky';
  if (dow === 0) return 'gold';
  return null;
}

/** 受信箱の1行のID。種類ごとに1行にまとめて、個数だけ増やす。 */
export const boxMailId = (kind: BoxKind) => `box-${kind}`;

/**
 * 開封演出：レアリティごとの色。
 *
 * 光り方は「段を1つずつ上げていく」形にしてある。
 *   ノーマル … 灰に1回
 *   レア     … 灰 → 青
 *   エピック … 灰 → 青 → 紫
 *   レジェンド… 灰 → 青 → 紫 → 金
 * 光った回数がそのままレアさになるので、最後まで見なくても「まだ続く＝当たりだ」
 * と分かる。ここが1回で終わるか続くかが、開けるときのいちばんの見どころ。
 */
export const RARITY_FX: Record<BoxRarity, { label: string; glow: string; ring: string }> = {
  normal: { label: 'ノーマル', glow: '#cfd6dd', ring: '#8d99a6' },
  rare: { label: 'レア', glow: '#7fc6ff', ring: '#2f7fb8' },
  epic: { label: 'エピック', glow: '#d8a6ff', ring: '#8a4fd0' },
  legend: { label: 'レジェンド', glow: '#ffe066', ring: '#e0a92e' },
};

/** 光る順番。手前の段から順に光って、そのレアリティの色で止まる。 */
export const FLASH_STEPS: Record<BoxRarity, BoxRarity[]> = {
  normal: ['normal'],
  rare: ['normal', 'rare'],
  epic: ['normal', 'rare', 'epic'],
  legend: ['normal', 'rare', 'epic', 'legend'],
};

/**
 * 画面に並べる段の**全部**。
 *
 * 開ける演出では、この数だけ点を並べて「光った数」で当たりを示す。
 * 結果ごとの段数（FLASH_STEPS）で点を並べてしまうと、光り出す前に点を数える
 * だけで当たりの大きさが分かってしまい、開ける楽しみが無くなる。
 * どの結果でも見た目の点の数は同じにすること。
 */
export const ALL_FLASH_STEPS: BoxRarity[] = FLASH_STEPS.legend;

/** 1段ぶんの光の長さ(ms)。段が上がるほど溜めを長くして、期待を引っぱる。 */
export const FLASH_MS: Record<BoxRarity, number> = {
  normal: 620,
  rare: 780,
  epic: 950,
  legend: 1400,
};

/** 限定フレームの表示名。 */
export const BOX_FRAME_NAME: Record<BoxKind, string> = {
  lucky: 'ラッキーボックス限定フレーム',
  gold: 'ゴールドボックス限定フレーム',
};

/** 限定称号の ID（data/titles.ts のものと合わせる）。 */
export const BOX_TITLE_ID: Record<BoxKind, string> = {
  lucky: 'box_lucky_tail',
  gold: 'box_gold_hoof',
};

/** 限定称号の表示名。 */
export const BOX_TITLE_NAME: Record<BoxKind, string> = {
  lucky: '幸運のしっぽ',
  gold: '黄金のひづめ',
};

/** i ボタンに出す排出率（%）。限定枠を含めて合計100%になるようにそろえる。 */
export function dropTable(def: BoxDef): { label: string; rarity: BoxRarity; pct: number }[] {
  const framePct = def.frameRate * 100;
  const titlePct = def.titleRate * 100;
  const rest = 100 - framePct - titlePct;
  const total = def.slots.reduce((n, s) => n + s.weight, 0);
  const rows = def.slots.map((s) => ({
    label: s.label,
    rarity: s.rarity,
    pct: (s.weight / total) * rest,
  }));
  // 限定枠は当たりにくい順に下へ。
  const specials = [
    { label: BOX_FRAME_NAME[def.kind], rarity: 'legend' as BoxRarity, pct: framePct },
    { label: `称号「${BOX_TITLE_NAME[def.kind]}」`, rarity: 'legend' as BoxRarity, pct: titlePct },
  ].sort((a, b) => b.pct - a.pct);
  return [...rows, ...specials];
}
