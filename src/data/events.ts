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
      'ストックのたまりが早い！1時間 → 30分でたまるよ',
      '「草をおかわり」が半額！300 → 150コイン',
      'たくさんウマを見つけて「牧場主」系の称号を手に入れよう！',
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
      'ステータスを振ったとき、まぐれで2つ上がることがあるよ！',
      '※ 合計48の上限は超えません（超えるぶんは1つぶんだけ上がります）',
      '金曜のグランプリにむけて、いっきに仕上げよう！',
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
      '10倍以上を的中させると払戻に上乗せ！倍率が高いほど多くもらえるよ',
      'レース結果に「万馬券デーボーナス」として青い文字で出るよ',
      '※ 倍率そのものは変わりません（当たったあとの上乗せだけ）',
      '大穴をねらって「万馬券ハンター」を手に入れよう！',
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
      '草むらで SR のパーツが出やすい！出る割合が2倍になるよ',
      'まだ持っていないパーツが優先して出るよ',
      '一気に集めて「図鑑コンプリート」を目指そう！',
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
      'G1の挑戦回数が増える！1日3回 → 6回',
      '対戦（トーナメント）の優勝賞金も1.5倍！',
      'トロフィーをたくさん持ち帰って「頂点の証」を手に入れよう！',
    ],
    status: 'soon',
  },
  {
    id: 'ev_sat_box',
    dow: 6,
    name: 'ラッキーボックス',
    icon: 'gift',
    colors: ['#d0417a', '#ffb3cd'],
    lead: '馬券を買ったレースで1着をとると、育成のごほうび箱がもらえる。',
    detail: [
      '馬券を買った「一人でレース」で1着になるたび、受信箱にたまるよ（×2 のように重なる）',
      '中身は育てるためのもの：育成アイテム／染料／厳選チケット／コイン（ぜんぶ常設）',
      '1/1000 で「ラッキーボックス限定フレーム」！一度きりの特別な1枚だよ',
      '中身の出る割合は、ボックスの i ボタンからいつでも見られるよ',
      '開けるのはいつでもOK。1着をたくさんとって、箱をためこもう！',
    ],
    status: 'live',
  },
  {
    id: 'ev_sun_goldbox',
    dow: 0,
    name: 'ゴールドボックス',
    icon: 'crown',
    colors: ['#b8860b', '#ffd76a'],
    lead: '週の締めくくり。中身がぜんぶコインの、お金の箱がもらえる。',
    detail: [
      'たまり方は土曜と同じ。馬券を買った「一人でレース」で1着になるたびにたまるよ',
      '中身はぜんぶコイン！5,000から、当たれば400,000コインまで（常設）',
      '1/10000 で「ゴールドボックス限定フレーム」！このゲームでいちばん出ない1枚だよ',
      '土曜のラッキーボックス（育成のごほうび）とは中身がちがう別の箱だよ',
      '土曜にためた箱もそのまま残るので、好きなときに開けられるよ',
    ],
    status: 'live',
  },
];

export const eventByDow: Record<number, WeeklyEvent> = Object.fromEntries(
  WEEKLY_EVENTS.map((e) => [e.dow, e]),
);

/** その時刻の曜日（0=日 … 6=土）。端末の時計いじり対策で trustedNow() を渡す想定。 */
export function dowOfTime(now: number): number {
  return new Date(now).getDay();
}
