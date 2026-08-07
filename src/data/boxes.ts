import type { StatKey } from '../types';

// 週末のごほうびボックス（曜日イベント）。
//
// 土曜＝ラッキーボックス（育成系）／日曜＝ゴールドボックス（お金系）。
// 「同じ箱のランク違い」ではなく中身のジャンルで分けているので、
// どちらを開けているのか迷わない。
//
// もらえるのは「馬券を買った一人でレース」で1着をとったときだけ。無料の練習で
// いくらでも増やせると、1/1000 のフレームが的当てゲームになってしまうため。
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
  /** 限定フレームの当たる確率の分母（1/1000 など）。 */
  frameOdds: number;
  /** 限定称号の当たる確率の分母。フレームとわざと入れ替えてある。 */
  titleOdds: number;
  slots: BoxSlot[];
};

// 限定枠（フレーム・称号）は重みではなく「1/N」で先に判定する（重みに混ぜると、
// 他の中身を増減させたときに確率が動いてしまう）。slots には入れず別に持つ。
// どちらの箱も フレーム＝1/10000（最レア）／称号＝1/1000 でそろえてある。

/** 土曜：育成系。ウマを強くするものが出る。 */
export const LUCKY_BOX: BoxDef = {
  kind: 'lucky',
  name: 'ラッキーボックス',
  colors: ['#d0417a', '#ffb3cd'],
  lead: '育てるためのごほうびが入っているよ。',
  frameOdds: 10000,
  titleOdds: 1000,
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
  frameOdds: 10000,
  titleOdds: 1000,
  // 1箱あたりの平均は約 7,800 コイン。以前（平均 19,350）は出しすぎだったので、
  // 下の段を大きく下げた。最高額の 100,000 は据え置きで、当たったときの
  // 「やった！」は残している（平均の4割はこの1段が担っている）。
  slots: [
    { weight: 32, rarity: 'normal', label: 'コイン 1,000', reward: { type: 'coins', amount: 1000 } },
    { weight: 26, rarity: 'normal', label: 'コイン 2,500', reward: { type: 'coins', amount: 2500 } },
    { weight: 20, rarity: 'rare', label: 'コイン 5,000', reward: { type: 'coins', amount: 5000 } },
    { weight: 13, rarity: 'rare', label: 'コイン 10,000', reward: { type: 'coins', amount: 10000 } },
    { weight: 6, rarity: 'epic', label: 'コイン 25,000', reward: { type: 'coins', amount: 25000 } },
    { weight: 3, rarity: 'epic', label: 'コイン 100,000', reward: { type: 'coins', amount: 100000 } },
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

/** 開封演出：レアリティごとの色と「溜め」の長さ(ms)。 */
export const RARITY_FX: Record<BoxRarity, { label: string; glow: string; ring: string; holdMs: number }> = {
  normal: { label: 'ノーマル', glow: '#cfd6dd', ring: '#8d99a6', holdMs: 700 },
  rare: { label: 'レア', glow: '#7fc6ff', ring: '#2f7fb8', holdMs: 1300 },
  epic: { label: 'エピック', glow: '#d8a6ff', ring: '#8a4fd0', holdMs: 2100 },
  legend: { label: 'レジェンド', glow: '#ffe066', ring: '#e0a92e', holdMs: 3200 },
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
  const framePct = 100 / def.frameOdds;
  const titlePct = 100 / def.titleOdds;
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
