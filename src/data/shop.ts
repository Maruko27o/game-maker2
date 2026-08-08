// ショップ（コインの使い道）。
//
// 方針：**売るのは見た目だけ**。強さ・育成・確率に一切かかわらないものだけを置く。
// そうしておけば、値段をいくらにしてもレースのバランスが動かない。
//
// いまの品ぞろえは2つ。どちらも「10種類そろえるとコンプリート品がもらえる」形で、
// 集めきったことが見た目ではっきり分かるようにしてある。
//   ・フレームボックス（50万コイン）… 10種のアイコンフレーム
//   ・称号ボックス（25万コイン）  … 10種の称号
// どちらも確率は10種すべて同じ。すでに持っているものが出たら、その場でコインが戻る
// （＝ハズレでも損はするが無駄にはならない）。

/** ショップの動物。フレームも称号もこの10種でそろえる。 */
export const ANIMALS = [
  'cat',
  'dog',
  'rabbit',
  'bear',
  'fox',
  'panda',
  'chick',
  'frog',
  'penguin',
  'squirrel',
] as const;
export type AnimalId = (typeof ANIMALS)[number];

export const ANIMAL_NAME: Record<AnimalId, string> = {
  cat: 'ねこ',
  dog: 'いぬ',
  rabbit: 'うさぎ',
  bear: 'くま',
  fox: 'きつね',
  panda: 'パンダ',
  chick: 'ひよこ',
  frog: 'かえる',
  penguin: 'ペンギン',
  squirrel: 'りす',
};

/** ショップで売っているくじの種類。 */
export type ShopBoxKind = 'frame' | 'title';

export type ShopBoxDef = {
  kind: ShopBoxKind;
  name: string;
  /** 1回の値段（コイン）。 */
  price: number;
  /** すでに持っているものが出たときに戻るコイン。 */
  refund: number;
  /** 見出しの色（濃い→淡い）。 */
  colors: [string, string];
  lead: string;
  detail: string[];
};

export const SHOP_BOXES: Record<ShopBoxKind, ShopBoxDef> = {
  frame: {
    kind: 'frame',
    name: 'フレームボックス',
    price: 500_000,
    refund: 100_000,
    colors: ['#7a5fd0', '#c4b3f0'],
    lead: '10種類の動物フレームから1つ。どれが出るかは運まかせ。',
    detail: [
      '10種類のどれかが同じ割合で出るよ',
      'すでに持っているものが出たら 100,000コイン が戻ってくる',
      '10種類を全部集めると「コンプリートフレーム」がもらえる！',
      'コンプリートフレームは、10種類の動物をいつでも選んで飾れるよ',
    ],
  },
  title: {
    kind: 'title',
    name: '称号ボックス',
    price: 250_000,
    refund: 50_000,
    colors: ['#c9772a', '#f7d3a0'],
    lead: '10種類の動物称号から1つ。どれが出るかは運まかせ。',
    detail: [
      '10種類のどれかが同じ割合で出るよ',
      'すでに持っているものが出たら 50,000コイン が戻ってくる',
      '10種類を全部集めると「コンプリート称号」がもらえる！',
      'コンプリート称号は、10種類の動物をいつでも選んで飾れるよ',
    ],
  },
};

export const SHOP_BOX_KINDS: ShopBoxKind[] = ['frame', 'title'];

/** 動物フレームの表示名。 */
export function shopFrameName(a: AnimalId): string {
  return `${ANIMAL_NAME[a]}のフレーム`;
}
/** 動物称号の表示名。 */
export function shopTitleName(a: AnimalId): string {
  return `${ANIMAL_NAME[a]}のなかま`;
}
/** コンプリート品の表示名。 */
export const SHOP_COMPLETE_FRAME_NAME = 'アニマルマスター';
export const SHOP_COMPLETE_TITLE_NAME = 'どうぶつ園長';

/** その値が動物IDとして正しいか（外から来たデータの検証に使う）。 */
export function isAnimalId(v: unknown): v is AnimalId {
  return typeof v === 'string' && (ANIMALS as readonly string[]).includes(v);
}
