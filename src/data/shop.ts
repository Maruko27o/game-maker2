// ショップ（コインの使い道）。
//
// 方針：**売るのは見た目だけ**。強さ・育成・確率に一切かかわらないものだけを置く。
// そうしておけば、値段をいくらにしてもレースのバランスが動かない。
//
// いまの品ぞろえは2つ。どちらも「10種類そろえるとコンプリート品がもらえる」形で、
// 集めきったことが見た目ではっきり分かるようにしてある。
//   ・フレームボックス（50万コイン）… 10種のアイコンフレーム
//   ・称号ボックス（25万コイン）  … 10種の称号
// **被りは出ない**。まだ持っていない10種の中から等しい確率で1つ出るので、
// 10回引けば必ずそろう（1種あたりの値段がそのまま確定でかかる形）。
// 被りを無くしたぶん返却の仕組みも要らないので、値段＝そのまま総額になる。

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
    colors: ['#7a5fd0', '#c4b3f0'],
    lead: 'まだ持っていない動物フレームから1つ。被りは出ないよ。',
    detail: [
      'まだ持っていないものだけが、同じ割合で出るよ',
      '被りが無いので、10回で必ず10種そろう',
      '10種類を全部集めると「コンプリートフレーム」がもらえる！',
      'コンプリートフレームは、10種類の動物をいつでも選んで飾れるよ',
    ],
  },
  title: {
    kind: 'title',
    name: '称号ボックス',
    price: 250_000,
    colors: ['#c9772a', '#f7d3a0'],
    lead: 'まだ持っていない動物称号から1つ。被りは出ないよ。',
    detail: [
      'まだ持っていないものだけが、同じ割合で出るよ',
      '被りが無いので、10回で必ず10種そろう',
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
