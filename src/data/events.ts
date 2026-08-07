import type { IconName } from '../components/Icon';

// 曜日イベント。
//
// レース画面のいちばん上に「月〜日」のカレンダーを出して、その日どんなイベントを
// やっているかが一目で分かるようにする。効果の中身は logic/weekdayEvents.ts に
// まとめてあり、ここの status が 'live' の日だけ効く。止めたいときは 'soon' に
// 戻せば、効果も画面の「今日は◯◯デー！」の帯もいっしょに消える。
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
      'ストックの貯まりが早い！1時間 → 30分で貯まるよ',
      '「草をおかわり」が半額！300 → 150コイン',
      'たくさんウマを見つけて「牧場主」系の称号を手に入れよう！',
    ],
    status: 'live',
  },
  {
    id: 'ev_tue_training',
    dow: 2,
    name: 'トレーニングデー',
    icon: 'bolt',
    colors: ['#c9772a', '#f7d3a0'],
    lead: 'ウマを鍛える日。育成の伸びが大きくなる。',
    detail: [
      '育成の成功する割合がアップ！50% → 75%',
      'ステータスを振ったとき、まぐれで2つ上がることがあるよ！',
      '能力値の調整（−1）も安い！育成アイテム 10個 → 5個',
      '※ 合計48の上限は超えません（超えるぶんは1つぶんだけ上がります）',
      '金曜のグランプリにむけて、一気に仕上げよう！',
    ],
    status: 'live',
  },
  {
    id: 'ev_wed_ticket',
    dow: 3,
    name: '万馬券デー',
    icon: 'ticket',
    colors: ['#2f6fb8', '#a9caf5'],
    lead: '大穴を狙う日。高い倍率の的中に上乗せがつく。',
    detail: [
      '10倍以上を的中させると払戻に上乗せ！倍率が高いほど多くもらえるよ',
      '上乗せの割合は 10倍で5%・20倍で12.5%・50倍で22.5%・100倍以上は30%',
      '1レースの上乗せは最大50,000コインまで',
      'レース結果に「万馬券デーボーナス」として青い文字で出るよ',
      '※ 倍率そのものは変わりません（当たったあとの上乗せだけ）',
      '大穴を狙って「万馬券ハンター」を手に入れよう！',
    ],
    status: 'live',
  },
  {
    id: 'ev_thu_dex',
    dow: 4,
    name: '図鑑デー',
    icon: 'book',
    colors: ['#7a5fd0', '#c4b3f0'],
    lead: '珍しい飾りが出やすくなる日。',
    detail: [
      '草むらで SR のパーツが出やすい！出る割合が2倍になるよ',
      'まだ持っていないパーツが出やすい！出る割合が4倍になるよ',
      '※ 未所持が必ず出るわけではありません（出やすくなるだけ）',
      '一気に集めて「図鑑コンプリート」を目指そう！',
    ],
    status: 'live',
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
      '対戦（トーナメント）の優勝賞金も1.5倍！12,000 → 18,000コイン',
      'トロフィーをたくさん持ち帰って「頂点の証」を手に入れよう！',
    ],
    status: 'live',
  },
  {
    id: 'ev_sat_box',
    dow: 6,
    name: 'ラッキーボックス',
    icon: 'gift',
    colors: ['#d0417a', '#ffb3cd'],
    lead: '馬券を買ったレースで1着をとると、育成のご褒美箱がもらえる。',
    detail: [
      '馬券を買った「一人でレース」で1着になるたび、受信箱に貯まるよ',
      '中身は育てるためのもの：育成アイテム／染料／厳選チケット／コイン',
      '0.1%（1000回に1回）で「ラッキーボックス限定フレーム」！一度きりの特別な1枚',
      '0.3%で称号「幸運のしっぽ」！こちらも一度きり',
      '詳しい割合は右上の i ボタンから見られるよ',
      '開けるのはいつでもOK。1着をたくさんとって、箱を貯めこもう！',
    ],
    status: 'live',
  },
  {
    id: 'ev_sun_goldbox',
    dow: 0,
    name: 'ゴールドボックス',
    icon: 'crown',
    colors: ['#b8860b', '#ffd76a'],
    lead: '週の締めくくり。中身が全部コインの、お金の箱がもらえる。',
    detail: [
      '馬券を買った「一人でレース」で1着になるたび、受信箱に貯まるよ',
      '中身は全部コイン！500から、当たれば100,000コインまで',
      '100,000コインは1%（100回に1回）。狙いはここ！',
      '0.1%（1000回に1回）で「ゴールドボックス限定フレーム」！一度きりの特別な1枚',
      '0.3%で称号「黄金のひづめ」！こちらも一度きり',
      '詳しい割合は右上の i ボタンから見られるよ',
    ],
    status: 'live',
  },
];

export const eventByDow: Record<number, WeeklyEvent> = Object.fromEntries(
  WEEKLY_EVENTS.map((e) => [e.dow, e]),
);

// ── 開発ビルドだけの曜日の上書き ───────────────────────────────
//
// 曜日イベントは全部この関数を通るので、ここを差し替えれば「水曜まで待つ」ことなく
// 万馬券デーの見た目も効果もそのまま確認できる。開発でいちばん時間を食っていたのが
// これだった。
//
// **本番ビルドでは絶対に効かない。** import.meta.env.DEV はビルド時に false へ
// 置き換わり、if の中身ごと消える。端末の時計いじり対策（trustedNow）を、この
// 機能で穴あけしないための決めごと。
// 固定した曜日は sessionStorage に置く。曜日を見ている画面は各所に散らばっていて
// 「今だけ変わった」を全部に伝えるのが難しいので、切り替えたら読み直す前提にする。
// タブを閉じれば消えるので、開発中に固定したまま忘れることもない。
const DEV_DOW_KEY = 'horse-game/devDow';

function readDevDow(): number | null {
  if (!import.meta.env.DEV) return null;
  try {
    const v = sessionStorage.getItem(DEV_DOW_KEY);
    if (v === null) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
  } catch {
    return null;
  }
}

let devDow: number | null = readDevDow();

/** 開発ビルドで曜日を固定する（null で実際の曜日に戻す）。本番では何もしない。 */
export function setDevDow(d: number | null): void {
  if (!import.meta.env.DEV) return;
  devDow = d === null ? null : ((d % 7) + 7) % 7;
  try {
    if (devDow === null) sessionStorage.removeItem(DEV_DOW_KEY);
    else sessionStorage.setItem(DEV_DOW_KEY, String(devDow));
  } catch {
    /* storage が使えなくても、そのタブのあいだは効く */
  }
}

/** いま上書きしている曜日（していなければ null）。 */
export function getDevDow(): number | null {
  return import.meta.env.DEV ? devDow : null;
}

/** その時刻の曜日（0=日 … 6=土）。端末の時計いじり対策で trustedNow() を渡す想定。 */
export function dowOfTime(now: number): number {
  if (import.meta.env.DEV && devDow !== null) return devDow;
  return new Date(now).getDay();
}
