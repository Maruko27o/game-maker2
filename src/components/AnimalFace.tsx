import type { AnimalId } from '../data/shop';
import { ANIMALS } from '../data/shop';

// ショップのフレーム・称号に描く動物の顔。
//
// 週末ボックスの紋章（BoxCrest）と同じ考え方で、**原点が円の中心・r で拡大縮小**。
// viewBox に依存しないので、フレームの銘板にも称号の左端にも同じ絵をそのまま置ける。
//
// 描き方の決めごと（小さくしても何の動物か分かるように）：
//  ・**耳（頭のシルエット）で見分ける**。丸い顔に丸い目だけだと全部同じ動物になる。
//  ・線は太めの1本で、色は「地の色・濃い色・顔の色」の3つだけに絞る。
//    小さく描くと色数が多いほど濁って見えるため。
//  ・目は左右に離し、白いハイライトを1点だけ入れる。ここで表情が決まる。
//
// 顔は 1 単位系（おおむね -7〜7）で描き、最後に k = r/13 倍する。数値をいじるときは
// scale の中だけで完結する。

type Tone = {
  /** 台座（丸）の地の色。 */
  bg: string;
  /** 台座の外側と影。 */
  deep: string;
  /** 輪郭線。 */
  edge: string;
  /** 顔の色。 */
  face: string;
  /** 目・鼻などの濃い色。 */
  ink: string;
  /** 耳の内側・ほお など、その動物らしさを出す差し色。 */
  accent: string;
};

/** 動物ごとの色。10種それぞれ色も変える（色と動物の両方で見分けられるように）。 */
export const ANIMAL_TONE: Record<AnimalId, Tone> = {
  cat: { bg: '#ffd9e6', deep: '#e8709e', edge: '#a83a63', face: '#fff4f8', ink: '#6b1f3d', accent: '#ff9ec0' },
  // いぬ（パグ）。顔がクリーム色なので、台座は少し濃いめの茶にして輪郭を立てる。
  dog: { bg: '#e8c79a', deep: '#b87a3a', edge: '#7d4a1c', face: '#fff3e2', ink: '#4e2c0e', accent: '#e0a865' },
  rabbit: { bg: '#e6e0f7', deep: '#a794dd', edge: '#6b56a8', face: '#fdfbff', ink: '#3f2f6b', accent: '#ffb8cf' },
  bear: { bg: '#f5dcae', deep: '#c99a4a', edge: '#8a6220', face: '#fdf0d6', ink: '#5a3f12', accent: '#e5b878' },
  fox: { bg: '#ffd9b8', deep: '#ef8b3c', edge: '#a8531a', face: '#fff1e2', ink: '#6b3210', accent: '#ffffff' },
  panda: { bg: '#dff0dc', deep: '#7fb87a', edge: '#3f6b3c', face: '#ffffff', ink: '#2b2b2b', accent: '#5aa054' },
  chick: { bg: '#fff0b8', deep: '#f2c62e', edge: '#a8820e', face: '#fffbe2', ink: '#5a4508', accent: '#ff9f2e' },
  frog: { bg: '#d6f2c8', deep: '#6cb84a', edge: '#3a7a20', face: '#eeffe2', ink: '#1f4a10', accent: '#a8e08a' },
  penguin: { bg: '#d6e4f7', deep: '#5f86bd', edge: '#2f4d7a', face: '#ffffff', ink: '#1f3350', accent: '#f2a52e' },
  squirrel: { bg: '#f7d9c8', deep: '#d4713f', edge: '#8a3f18', face: '#fff0e6', ink: '#5a260c', accent: '#e89a68' },
};

/** 動物ごとの顔。1単位系（-7〜7）で描く。 */
function FaceArt({ id, t }: { id: AnimalId; t: Tone }) {
  const eye = (
    <>
      <circle cx={-2.6} cy={-1.4} r={1.15} fill={t.ink} />
      <circle cx={2.6} cy={-1.4} r={1.15} fill={t.ink} />
      <circle cx={-2.25} cy={-1.8} r={0.4} fill="#fff" />
      <circle cx={2.95} cy={-1.8} r={0.4} fill="#fff" />
    </>
  );
  const S = { stroke: t.edge, strokeWidth: 1.05, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

  switch (id) {
    case 'cat':
      return (
        <g>
          {/* とがった三角の耳。ねこはここだけで分かる。 */}
          <path d="M -6.2,-2.6 L -6.6,-7.6 L -2.4,-5.2 Z" fill={t.face} {...S} />
          <path d="M 6.2,-2.6 L 6.6,-7.6 L 2.4,-5.2 Z" fill={t.face} {...S} />
          <path d="M -5.6,-3.6 L -5.8,-6.2 L -3.6,-4.9 Z" fill={t.accent} />
          <path d="M 5.6,-3.6 L 5.8,-6.2 L 3.6,-4.9 Z" fill={t.accent} />
          <circle cx={0} cy={0} r={5.6} fill={t.face} {...S} />
          {eye}
          {/* 逆三角の鼻と ω 型の口。 */}
          <path d="M -1,1.5 L 1,1.5 L 0,2.6 Z" fill={t.accent} stroke={t.edge} strokeWidth="0.6" />
          <path d="M 0,2.6 L 0,3.2 M 0,3.2 C -0.5,4.1 -1.9,3.9 -2.2,3.0 M 0,3.2 C 0.5,4.1 1.9,3.9 2.2,3.0" fill="none" stroke={t.edge} strokeWidth="0.75" strokeLinecap="round" />
          {/* ひげ */}
          <path d="M -3.4,1.8 L -5.6,1.2 M -3.4,2.6 L -5.5,2.9 M 3.4,1.8 L 5.6,1.2 M 3.4,2.6 L 5.5,2.9" stroke={t.edge} strokeWidth="0.55" strokeLinecap="round" />
        </g>
      );
    case 'dog':
      // パグ。ぺちゃ顔の犬なので、垂れ耳のふつうの犬とは描き方を変える。
      // 見分けの決め手は **小さな折れ耳・黒いマスク・ひたいのしわ** の3つ。
      // マスクが濃いので、その上に乗せる口は白い線で描かないと沈んで見えない。
      return (
        <g>
          {/* 前に折れた耳。頭の上の角から**横の輪郭に沿って下へ**垂れる濃い色の羽。
              くまのような丸い耳を上に置くと犬に見えないので、必ず下向きに垂らす。 */}
          <path d="M -4.2,-4.8 C -6.6,-5.2 -7.2,-2.0 -5.9,1.4 C -4.6,0.4 -3.6,-1.6 -3.5,-3.8 Z" fill={t.ink} {...S} />
          <path d="M 4.2,-4.8 C 6.6,-5.2 7.2,-2.0 5.9,1.4 C 4.6,0.4 3.6,-1.6 3.5,-3.8 Z" fill={t.ink} {...S} />
          {/* 横に広い頭。 */}
          <ellipse cx={0} cy={0.2} rx={6.0} ry={5.5} fill={t.face} {...S} />
          {/* ひたいのしわ。マスクから離して額に置かないと、マスクの縁と重なって見える。 */}
          <path
            d="M -2.6,-3.5 C -1.3,-4.5 1.3,-4.5 2.6,-3.5 M 0,-3.1 L 0,-1.9"
            fill="none"
            stroke={t.edge}
            strokeWidth="0.7"
            strokeOpacity="0.8"
            strokeLinecap="round"
          />
          {/* 大きくまるい目。 */}
          <circle cx={-3.0} cy={-1.2} r={1.45} fill={t.ink} />
          <circle cx={3.0} cy={-1.2} r={1.45} fill={t.ink} />
          <circle cx={-2.55} cy={-1.7} r={0.52} fill="#fff" />
          <circle cx={3.45} cy={-1.7} r={0.52} fill="#fff" />
          {/* 横に広くて平たい黒マスク。地の色とはっきり濃さを変える。 */}
          <ellipse cx={0} cy={2.9} rx={3.7} ry={2.7} fill="#6f4a22" stroke={t.edge} strokeWidth="0.6" />
          <ellipse cx={0} cy={1.9} rx={1.55} ry={1.15} fill="#221709" />
          <ellipse cx={-0.55} cy={1.55} rx={0.4} ry={0.28} fill="#fff" fillOpacity="0.55" />
          {/* 口はマスクの上に乗るので、明るい線でないと沈んでしまう。 */}
          <path
            d="M 0,3.05 L 0,3.5 M 0,3.5 C -0.5,4.35 -1.8,4.15 -2.1,3.4 M 0,3.5 C 0.5,4.35 1.8,4.15 2.1,3.4"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.62"
            strokeWidth="0.8"
            strokeLinecap="round"
          />
        </g>
      );
    case 'rabbit':
      return (
        <g>
          {/* 長い耳。うさぎはこれ一択。 */}
          <path d="M -2.9,-4.2 C -4.2,-7.6 -3.6,-11.4 -2.2,-11.4 C -0.8,-11.4 -0.9,-7.4 -1.2,-4.2 Z" fill={t.face} {...S} />
          <path d="M 2.9,-4.2 C 4.2,-7.6 3.6,-11.4 2.2,-11.4 C 0.8,-11.4 0.9,-7.4 1.2,-4.2 Z" fill={t.face} {...S} />
          <path d="M -2.5,-5.2 C -3.2,-7.6 -2.9,-10.0 -2.2,-10.0 C -1.6,-10.0 -1.7,-7.4 -1.8,-5.2 Z" fill={t.accent} />
          <path d="M 2.5,-5.2 C 3.2,-7.6 2.9,-10.0 2.2,-10.0 C 1.6,-10.0 1.7,-7.4 1.8,-5.2 Z" fill={t.accent} />
          <circle cx={0} cy={0.2} r={5.4} fill={t.face} {...S} />
          {eye}
          <path d="M -1,1.8 L 1,1.8 L 0,2.9 Z" fill={t.accent} stroke={t.edge} strokeWidth="0.6" />
          <path d="M 0,2.9 L 0,3.5 M 0,3.5 C -0.5,4.4 -1.8,4.2 -2.1,3.4 M 0,3.5 C 0.5,4.4 1.8,4.2 2.1,3.4" fill="none" stroke={t.edge} strokeWidth="0.75" strokeLinecap="round" />
          {/* 前歯 */}
          <path d="M -0.9,4.3 L 0.9,4.3 L 0.9,5.6 L -0.9,5.6 Z" fill="#fff" stroke={t.edge} strokeWidth="0.5" />
          <path d="M 0,4.3 L 0,5.6" stroke={t.edge} strokeWidth="0.4" />
        </g>
      );
    case 'bear':
      return (
        <g>
          {/* 小さくて丸い耳が頭の上のほうに2つ。 */}
          <circle cx={-4.4} cy={-4.6} r={2.5} fill={t.face} {...S} />
          <circle cx={4.4} cy={-4.6} r={2.5} fill={t.face} {...S} />
          <circle cx={-4.4} cy={-4.6} r={1.2} fill={t.accent} />
          <circle cx={4.4} cy={-4.6} r={1.2} fill={t.accent} />
          <circle cx={0} cy={0} r={5.6} fill={t.face} {...S} />
          {eye}
          {/* 大きめのマズル。 */}
          <ellipse cx={0} cy={2.6} rx={3.2} ry={2.4} fill={t.accent} opacity="0.5" stroke={t.edge} strokeWidth="0.6" />
          <ellipse cx={0} cy={1.8} rx={1.3} ry={1.0} fill={t.ink} />
          <path d="M 0,2.8 L 0,3.4 M 0,3.4 C -0.5,4.3 -1.8,4.1 -2.1,3.3 M 0,3.4 C 0.5,4.3 1.8,4.1 2.1,3.3" fill="none" stroke={t.edge} strokeWidth="0.75" strokeLinecap="round" />
        </g>
      );
    case 'fox':
      return (
        <g>
          {/* 大きくとがった耳＋逆三角のとがった顔。 */}
          <path d="M -6.4,-2.0 L -7.0,-8.6 L -2.2,-5.4 Z" fill={t.deep} {...S} />
          <path d="M 6.4,-2.0 L 7.0,-8.6 L 2.2,-5.4 Z" fill={t.deep} {...S} />
          <path d="M -5.7,-3.2 L -6.1,-6.9 L -3.5,-5.1 Z" fill={t.ink} opacity="0.55" />
          <path d="M 5.7,-3.2 L 6.1,-6.9 L 3.5,-5.1 Z" fill={t.ink} opacity="0.55" />
          <path d="M -5.6,-2.4 C -5.6,-5.6 5.6,-5.6 5.6,-2.4 C 5.6,1.4 2.6,5.8 0,5.8 C -2.6,5.8 -5.6,1.4 -5.6,-2.4 Z" fill={t.deep} {...S} />
          {/* 白い口もと。きつねらしさはここ。 */}
          <path d="M -3.4,1.0 C -3.4,-0.4 3.4,-0.4 3.4,1.0 C 3.4,3.4 1.6,5.6 0,5.6 C -1.6,5.6 -3.4,3.4 -3.4,1.0 Z" fill={t.accent} stroke={t.edge} strokeWidth="0.7" />
          {eye}
          <path d="M -1,2.4 L 1,2.4 L 0,3.6 Z" fill={t.ink} />
        </g>
      );
    case 'panda':
      return (
        <g>
          <circle cx={-4.4} cy={-4.4} r={2.5} fill={t.ink} {...S} />
          <circle cx={4.4} cy={-4.4} r={2.5} fill={t.ink} {...S} />
          <circle cx={0} cy={0} r={5.6} fill={t.face} {...S} />
          {/* 目のまわりの黒い斑。パンダはこれが命。
              斑の中は「白目を広く・黒目を小さく」すると、にらんでいる顔になってしまう。
              他の動物と同じで **黒目を大きく** 取り、白は縁とハイライトだけにする。 */}
          <ellipse cx={-2.7} cy={-1.1} rx={1.95} ry={2.35} fill={t.ink} transform="rotate(-14 -2.7 -1.1)" />
          <ellipse cx={2.7} cy={-1.1} rx={1.95} ry={2.35} fill={t.ink} transform="rotate(14 2.7 -1.1)" />
          <circle cx={-2.6} cy={-1.2} r={1.15} fill="#fff" />
          <circle cx={2.6} cy={-1.2} r={1.15} fill="#fff" />
          <circle cx={-2.6} cy={-1.1} r={0.85} fill={t.ink} />
          <circle cx={2.6} cy={-1.1} r={0.85} fill={t.ink} />
          <circle cx={-2.35} cy={-1.45} r={0.32} fill="#fff" />
          <circle cx={2.85} cy={-1.45} r={0.32} fill="#fff" />
          <ellipse cx={0} cy={2.2} rx={1.3} ry={0.95} fill={t.ink} />
          <path d="M 0,3.2 L 0,3.7 M 0,3.7 C -0.5,4.5 -1.7,4.3 -2.0,3.6 M 0,3.7 C 0.5,4.5 1.7,4.3 2.0,3.6" fill="none" stroke={t.ink} strokeWidth="0.75" strokeLinecap="round" />
        </g>
      );
    case 'chick':
      return (
        <g>
          {/* 頭のちょんまげ。ひよこの目印。 */}
          <path d="M -1.6,-5.6 C -2.2,-8.2 -0.4,-9.2 0.2,-7.6 C 1.0,-9.0 2.6,-7.8 1.6,-5.6 Z" fill={t.deep} {...S} />
          <circle cx={0} cy={0} r={5.5} fill={t.face} {...S} />
          {eye}
          {/* とがったくちばし。 */}
          <path d="M -1.8,1.8 L 1.8,1.8 L 0,4.4 Z" fill={t.accent} stroke={t.edge} strokeWidth="0.7" strokeLinejoin="round" />
          <path d="M -1.8,1.8 L 1.8,1.8" stroke={t.edge} strokeWidth="0.5" />
          {/* ほっぺ */}
          <circle cx={-4.0} cy={1.4} r={1.0} fill={t.deep} opacity="0.5" />
          <circle cx={4.0} cy={1.4} r={1.0} fill={t.deep} opacity="0.5" />
        </g>
      );
    case 'frog':
      return (
        <g>
          {/* 頭の上に飛び出した目。かえるはこれで一発。 */}
          <circle cx={-3.3} cy={-4.4} r={2.6} fill={t.face} {...S} />
          <circle cx={3.3} cy={-4.4} r={2.6} fill={t.face} {...S} />
          <circle cx={-3.3} cy={-4.2} r={1.25} fill={t.ink} />
          <circle cx={3.3} cy={-4.2} r={1.25} fill={t.ink} />
          <circle cx={-2.95} cy={-4.6} r={0.42} fill="#fff" />
          <circle cx={3.65} cy={-4.6} r={0.42} fill="#fff" />
          <path d="M -5.7,-2.4 C -5.7,-4.6 5.7,-4.6 5.7,-2.4 C 5.7,2.6 3.4,5.6 0,5.6 C -3.4,5.6 -5.7,2.6 -5.7,-2.4 Z" fill={t.face} {...S} />
          {/* 横に大きく開いた口。 */}
          <path d="M -4.2,1.2 C -2.2,4.0 2.2,4.0 4.2,1.2" fill="none" stroke={t.edge} strokeWidth="0.95" strokeLinecap="round" />
          <circle cx={-1.2} cy={-0.6} r={0.42} fill={t.ink} />
          <circle cx={1.2} cy={-0.6} r={0.42} fill={t.ink} />
          <circle cx={-4.3} cy={0.6} r={0.95} fill={t.accent} />
          <circle cx={4.3} cy={0.6} r={0.95} fill={t.accent} />
        </g>
      );
    case 'penguin':
      return (
        <g>
          {/* 頭は黒、顔の中だけ白。ぺんぎんの見分けはこの塗り分け。 */}
          <circle cx={0} cy={0} r={5.7} fill={t.edge} {...S} />
          <path d="M 0,-4.6 C 3.6,-4.6 4.6,-1.0 4.2,1.6 C 3.8,4.2 2.0,5.6 0,5.6 C -2.0,5.6 -3.8,4.2 -4.2,1.6 C -4.6,-1.0 -3.6,-4.6 0,-4.6 Z" fill={t.face} />
          {eye}
          {/* オレンジのくちばし。 */}
          <path d="M -1.7,1.6 C -1.7,0.8 1.7,0.8 1.7,1.6 C 1.7,2.9 0.9,3.8 0,3.8 C -0.9,3.8 -1.7,2.9 -1.7,1.6 Z" fill={t.accent} stroke={t.edge} strokeWidth="0.7" />
          <path d="M -1.4,1.9 L 1.4,1.9" stroke={t.edge} strokeWidth="0.45" />
        </g>
      );
    case 'squirrel':
      return (
        <g>
          {/* 大きくカールしたしっぽ。りすの見分けはここだけなので、頭の外まではっきり出す。
              顔は左に寄せて、しっぽの居場所をあける。 */}
          <path
            d="M 2.6,4.6 C 7.6,5.4 10.2,0.6 8.8,-3.8 C 7.8,-7.0 4.6,-8.6 2.6,-7.0 C 0.9,-5.6 2.0,-3.4 3.8,-4.0 C 5.6,-4.6 6.8,-2.4 6.2,-0.2 C 5.6,2.0 4.0,2.8 2.2,2.6 Z"
            fill={t.deep}
            {...S}
          />
          <path
            d="M 4.4,3.6 C 7.4,3.2 8.6,0.0 7.8,-3.0 M 3.4,-6.0 C 5.4,-6.4 7.0,-4.8 7.6,-2.6"
            fill="none"
            stroke={t.edge}
            strokeWidth="0.5"
            strokeOpacity="0.5"
            strokeLinecap="round"
          />
          {/* 顔まわりは頭の中心にそろえて描く（左右の耳が非対称になるのを防ぐ）。 */}
          <g transform="translate(-1.2,0.2)">
            {/* 丸みのある小さな耳（ねこのとがった耳と区別する）。 */}
            <path d="M -3.4,-3.8 C -4.6,-6.6 -3.0,-7.8 -1.4,-6.4 Z" fill={t.face} {...S} />
            <path d="M 3.4,-3.8 C 4.6,-6.6 3.0,-7.8 1.4,-6.4 Z" fill={t.face} {...S} />
            <circle cx={0} cy={0} r={5.2} fill={t.face} {...S} />
            {eye}
            <path d="M -0.9,1.6 L 0.9,1.6 L 0,2.6 Z" fill={t.ink} />
            {/* 前歯。鼻から短い線でつないでおかないと、歯だけが浮いて見える。 */}
            <path d="M 0,2.6 L 0,3.1" stroke={t.edge} strokeWidth="0.6" strokeLinecap="round" />
            <path d="M -0.85,3.1 L 0.85,3.1 L 0.85,4.5 L -0.85,4.5 Z" fill="#fff" stroke={t.edge} strokeWidth="0.5" strokeLinejoin="round" />
            <path d="M 0,3.1 L 0,4.5" stroke={t.edge} strokeWidth="0.4" />
            <circle cx={-3.6} cy={1.4} r={0.95} fill={t.deep} opacity="0.45" />
            <circle cx={3.6} cy={1.4} r={0.95} fill={t.deep} opacity="0.45" />
          </g>
        </g>
      );
  }
}

/**
 * 動物の顔（丸い台座つき）。
 *
 * @param id  どの動物か
 * @param uid defs の衝突よけ（同じ画面に何枚も出るため）
 * @param r   半径。これだけで大きさが決まる
 * @param plain 台座を描かない（称号の帯など、背景が別にあるとき）
 * @param soft コンプリートフレーム用の落ち着いた見た目。
 *   ふつうの動物フレームは「その動物の色」の台座で、絵もはっきり出す。
 *   ただしコンプリートフレームは10色の帯が主役なので、同じ描き方だと銘板だけが
 *   くっきり浮いて主張しすぎる。**台座を帯と同じ淡い生成り＋金のふちにして、
 *   絵の彩度も落とす**。動物が変わっても銘板の色は変わらない（＝どの動物を
 *   選んでもフレーム全体の色がまとまる）。
 */
export default function AnimalFace({
  id,
  uid,
  r = 13,
  plain,
  soft,
}: {
  id: AnimalId;
  uid: string;
  r?: number;
  plain?: boolean;
  soft?: boolean;
}) {
  const t = ANIMAL_TONE[id];
  const k = r / 13;
  return (
    <g>
      {!plain && (
        <>
          <defs>
            <radialGradient id={`af-${uid}`} cx="50%" cy="32%" r="74%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="55%" stopColor={soft ? '#fff6e2' : t.bg} />
              <stop offset="100%" stopColor={soft ? '#e8cf9e' : t.deep} />
            </radialGradient>
            {soft && (
              // 彩度を落とす。色を1つずつ塗り替えるより、まとめてここで弱める方が
              // 10種すべてに同じ効き方をする（描き分けの手を入れずに済む）。
              <filter id={`afsoft-${uid}`} colorInterpolationFilters="sRGB">
                <feColorMatrix type="saturate" values="0.45" />
              </filter>
            )}
          </defs>
          <circle
            cx={0}
            cy={0}
            r={r}
            fill={`url(#af-${uid})`}
            stroke={soft ? '#a8783a' : t.edge}
            strokeWidth={1.6 * k}
          />
          <circle cx={0} cy={0} r={r - 2.2 * k} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth={0.8 * k} />
        </>
      )}
      <g transform={`scale(${k * 0.82})`} filter={soft && !plain ? `url(#afsoft-${uid})` : undefined} opacity={soft ? 0.88 : undefined}>
        <FaceArt id={id} t={t} />
      </g>
    </g>
  );
}

/** 一覧に出すときの並び（データ側の並びをそのまま使う）。 */
export const ANIMAL_LIST = ANIMALS;
