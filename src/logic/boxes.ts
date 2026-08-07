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
  if (!taken.frame && frameRoll < 1 / def.frameOdds) {
    return { kind, rarity: 'legend', label: 'げんていフレーム', reward: { type: 'frame' } };
  }
  if (!taken.title && titleRoll < 1 / def.titleOdds) {
    return { kind, rarity: 'legend', label: 'げんてい称号', reward: { type: 'title' } };
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
