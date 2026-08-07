import { BOXES, boxMailId, type BoxDef, type BoxKind, type BoxRarity, type BoxReward } from '../data/boxes';
import type { MailItem } from '../types';

// ボックスを1つ開けた結果を決める。乱数は引数で受け取る純関数なので、
// テストで狙った目を出せる（＝限定フレームの確率をちゃんと検証できる）。

export type BoxResult = {
  kind: BoxKind;
  rarity: BoxRarity;
  label: string;
  reward: BoxReward;
};

/**
 * 1回開ける。
 *
 * 限定枠（フレーム・称号）は重みに混ぜず「1/N」で先に判定する。重みに入れて
 * しまうと、他の中身を足し引きしたときに限定の確率まで動いてしまうため。
 * 判定用の乱数は取得済みかどうかに関わらず必ず2つ引く。こうしておくと、
 * 「もう持っているぶんだけ乱数の並びがずれる」ということが起きない。
 *
 * @param rng 0以上1未満を返す乱数
 * @param taken すでに持っている限定枠。持っているものは出さない（一度きりの
 *   約束）。そのぶんは通常の抽選に回る。
 */
export function openBox(
  kind: BoxKind,
  rng: () => number,
  taken: { frame: boolean; title: boolean },
): BoxResult {
  const def: BoxDef = BOXES[kind];

  const frameRoll = rng();
  const titleRoll = rng();
  if (!taken.frame && frameRoll < def.frameRate) {
    return { kind, rarity: 'legend', label: '限定フレーム', reward: { type: 'frame' } };
  }
  if (!taken.title && titleRoll < def.titleRate) {
    return { kind, rarity: 'legend', label: '限定称号', reward: { type: 'title' } };
  }

  const total = def.slots.reduce((n, s) => n + s.weight, 0);
  let r = rng() * total;
  for (const s of def.slots) {
    r -= s.weight;
    if (r < 0) return { kind, rarity: s.rarity, label: s.label, reward: s.reward };
  }
  // 丸め誤差で落ちてきたときの保険：いちばん出やすいものを返す。
  const first = def.slots[0];
  return { kind, rarity: first.rarity, label: first.label, reward: first.reward };
}

/**
 * 受信箱にボックスを1つ足す。
 *
 * 同じ種類は行を増やさず個数だけ増やす（×2 → ×3 → ×4 …）。増えた行は未読にして
 * いちばん手前に出すので、たまったことがすぐ分かる。土と日は別の箱なので別の行。
 */
export function stackBox(mailbox: MailItem[], kind: BoxKind, at: number): MailItem[] {
  const id = boxMailId(kind);
  const i = mailbox.findIndex((m) => m.id === id);
  if (i < 0) return [{ id, at, read: false, kind: 'box', box: kind, count: 1 }, ...mailbox];
  const rest = mailbox.filter((_, k) => k !== i);
  return [{ ...mailbox[i], at, read: false, count: (mailbox[i].count ?? 1) + 1 }, ...rest];
}

/**
 * 受信箱からボックスを1つ取り出す（開けるとき）。
 * 0個になった行は消す。持っていなければ null。
 */
export function takeBox(mailbox: MailItem[], kind: BoxKind): MailItem[] | null {
  const id = boxMailId(kind);
  const i = mailbox.findIndex((m) => m.id === id);
  if (i < 0) return null;
  const have = mailbox[i].count ?? 1;
  if (have <= 0) return null;
  const next = mailbox.slice();
  if (have <= 1) next.splice(i, 1);
  else next[i] = { ...next[i], count: have - 1 };
  return next;
}

/** 受信箱に入っているその箱の個数。 */
export function boxCount(mailbox: MailItem[], kind: BoxKind): number {
  const m = mailbox.find((x) => x.id === boxMailId(kind));
  return m ? (m.count ?? 1) : 0;
}

/** レアリティの格。まとめて開けたときに「いちばんレアだったもの」を選ぶのに使う。 */
export const RARITY_RANK: Record<BoxRarity, number> = { normal: 0, rare: 1, epic: 2, legend: 3 };

export type BoxTally = {
  /** 中身ごとの行（出た順を保ったまま、同じものはまとめる）。 */
  rows: { label: string; rarity: BoxRarity; count: number }[];
  /** 合計。0 のものは表示しない側で落とす。 */
  coins: number;
  tickets: number;
  items: number;
  dyes: number;
  /** 限定枠が出たか（演出をそれに合わせる）。 */
  frame: boolean;
  title: boolean;
  /** いちばんレアだった1件。まとめ開けの溜め演出はこれ1回だけ流す。 */
  best: BoxResult | null;
};

/**
 * まとめて開けた結果を1つにまとめる。
 *
 * 1つずつ演出を見るのは10個もあると苦行なので、演出は「いちばんレアだったもの」
 * だけ流し、中身は一覧で見せる。並び順は出た順のまま（レア順に並べ替えると
 * 「何が出たか」ではなく「何がレアか」の表になってしまい、開けた実感が薄れる）。
 */
export function tallyBoxResults(results: BoxResult[]): BoxTally {
  const rows: BoxTally['rows'] = [];
  const at = new Map<string, number>();
  let coins = 0;
  let tickets = 0;
  let items = 0;
  let dyes = 0;
  let frame = false;
  let title = false;
  let best: BoxResult | null = null;

  for (const r of results) {
    const i = at.get(r.label);
    if (i === undefined) {
      at.set(r.label, rows.length);
      rows.push({ label: r.label, rarity: r.rarity, count: 1 });
    } else {
      rows[i].count++;
    }
    const w = r.reward;
    if (w.type === 'coins') coins += w.amount;
    else if (w.type === 'ticket') tickets += w.amount;
    else if (w.type === 'item') items += w.amount;
    else if (w.type === 'dye') dyes += 1;
    else if (w.type === 'frame') frame = true;
    else if (w.type === 'title') title = true;

    if (!best || RARITY_RANK[r.rarity] > RARITY_RANK[best.rarity]) best = r;
  }

  return { rows, coins, tickets, items, dyes, frame, title, best };
}
