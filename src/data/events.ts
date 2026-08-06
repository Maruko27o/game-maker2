import type { IconName } from '../components/Icon';

// 曜日イベント。
//
// レース画面のいちばん上に「月〜日」のカレンダーを出して、その日どんなイベントを
// やっているかが一目で分かるようにする。今はまだ中身（効果）は入っていないので、
// 全部「準備中」。先に側（カレンダー・詳細・見た目）を作って、あとから1つずつ
// 効果を実装していく。status を 'live' に変えるだけで本番あつかいになる。
//
// dow は Date#getDay と同じ 0=日曜 … 6=土曜。カレンダーの表示は月曜はじまり。

export type EventStatus =
  | 'live' // 効果が入っている
  | 'soon'; // 準備中（表示だけ）

export type WeeklyEvent = {
  id: string;
  dow: number;
  name: string;
  icon: IconName;
  /** 濃い→淡い。カレンダーのコマと詳細の見出しに使う。 */
  colors: [string, string];
  /** 一行の説明（カレンダーの詳細の先頭に出る）。 */
  lead: string;
  /** 詳しい中身。箇条書きでそのまま出す。 */
  detail: string[];
  status: EventStatus;
};

export const DOW_SHORT = ['日', '月', '火', '水', '木', '金', '土'];
/** 表示順は月曜はじまり（月火水木金土日）。 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export const WEEKLY_EVENTS: WeeklyEvent[] = [
  {
    id: 'ev_mon_grass',
    dow: 1,
    name: '草むらデー',
    icon: 'leaf',
    colors: ['#4f8f3a', '#bde79b'],
    lead: '草むらに出かける日。ウマとの出会いが増える。',
    detail: [
      'ストックのたまりが早くなる（1時間 → 40分を予定）',
      '「草をおかわり」が半額になる',
      '見つけたウマの数がのびるので、「牧場主」系の称号を狙う日',
    ],
    status: 'soon',
  },
  {
    id: 'ev_tue_training',
    dow: 2,
    name: 'トレーニングデー',
    icon: 'bolt',
    colors: ['#c9772a', '#f7d3a0'],
    lead: 'ウマを鍛える日。育成の伸びが大きくなる。',
    detail: [
      '育成でのステータスの伸びが上がる',
      '育成アイテムの消費が軽くなる',
      'グランプリ前日なので、金曜にむけて仕上げる日',
    ],
    status: 'soon',
  },
  {
    id: 'ev_wed_ticket',
    dow: 3,
    name: '万馬券デー',
    icon: 'ticket',
    colors: ['#2f6fb8', '#a9caf5'],
    lead: '大穴をねらう日。高い倍率の的中に上乗せがつく。',
    detail: [
      '倍率が高いほど払戻に上乗せ（倍率そのものは変えない）',
      '※ 倍率のバランスには手を入れず、当たったあとの上乗せだけで調整する',
      '「万馬券ハンター」「伝説の的中王」を狙う日',
    ],
    status: 'soon',
  },
  {
    id: 'ev_thu_dex',
    dow: 4,
    name: '図鑑デー',
    icon: 'book',
    colors: ['#7a5fd0', '#c4b3f0'],
    lead: 'めずらしい飾りが出やすくなる日。',
    detail: [
      '草むらで SR のパーツが出やすくなる',
      'まだ持っていないパーツが優先して出る',
      '図鑑のコンプリートを進める日',
    ],
    status: 'soon',
  },
  {
    id: 'ev_fri_gp',
    dow: 5,
    name: 'グランプリデー',
    icon: 'trophy',
    colors: ['#c9a227', '#ffe9a8'],
    lead: '大舞台の日。G1に挑める回数が増える。',
    detail: [
      'G1の1日の挑戦回数が増える',
      '3位以内の賞金とトロフィーの取りこぼしを取り返せる日',
      '対戦（トーナメント）の賞金も上がる',
    ],
    status: 'soon',
  },
  {
    id: 'ev_sat_box',
    dow: 6,
    name: 'ラッキーボックス',
    icon: 'gift',
    colors: ['#d0417a', '#ffb3cd'],
    lead: 'レースで1着をとると、ごほうびの箱を開けられる。',
    detail: [
      '1着になるたびにラッキーボックスが1つたまる',
      '中身の候補：コイン／育成アイテム／染料／厳選チケット',
      'まれに図鑑のパーツやフレームが出る（ここがいちばんのあたり）',
      '1日にためられる数には上限をつける予定',
    ],
    status: 'soon',
  },
  {
    id: 'ev_sun_goldbox',
    dow: 0,
    name: 'ゴールドボックス',
    icon: 'crown',
    colors: ['#b06bff', '#ffd76a'],
    lead: '週の締めくくり。土曜より中身が豪華な箱が開く。',
    detail: [
      '土曜と同じく1着でたまるが、箱のランクが上',
      '中身の候補：大量のコイン／厳選チケット／めずらしい染料',
      'いちばん上の当たりに「フレーム」を入れる予定',
      '土曜にためた箱も日曜に開けられるようにする',
    ],
    status: 'soon',
  },
];

export const eventByDow: Record<number, WeeklyEvent> = Object.fromEntries(
  WEEKLY_EVENTS.map((e) => [e.dow, e]),
);

/** その時刻の曜日（0=日 … 6=土）。端末の時計いじり対策で trustedNow() を渡す想定。 */
export function dowOfTime(now: number): number {
  return new Date(now).getDay();
}
