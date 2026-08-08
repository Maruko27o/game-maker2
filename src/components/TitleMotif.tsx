import type { AnimalId } from '../data/shop';
import { ANIMALS } from '../data/shop';
import { ANIMAL_TONE } from './AnimalFace';

// 称号の背景に描く「そのシリーズらしい絵」。
//
// これまでは段（tier）ごとの模様しか無く、どの称号も同じ顔つきに見えていた。
// ここでは **何をやって取った称号か** を絵で示す。
//
//  ・ウマを見つける系 … 走るウマが増えていく
//  ・コイン系         … コインが溢れ、上の段では滝のように落ちる
//  ・対戦系           … 交差した剣が増え、飾りが増す
//  ・ショップの動物   … その動物が住んでいそうな場所（ペンギン＝氷、パンダ＝竹 …）
//
// 決めごと：
//  ・帯は小さい（高さ30〜46px）ので、**シルエット1色＋薄い重ね**だけで描く。
//    線の細い絵や色数の多い絵は、この大きさだとただの汚れに見える。
//  ・数で強さを示す（level が上がると数が増える）。段の模様とけんかしないよう、
//    不透明度は低めに置き、名前の文字を邪魔しない下半分に寄せる。
//  ・帯の幅は場所によって変わるので、viewBox は 200×44 に固定して
//    preserveAspectRatio="none" で引き伸ばす（形の崩れより、位置の安定を採る）。

export type MotifKind =
  | 'horses' // ウマを見つけた数
  | 'races' // 走ったレース数
  | 'wins' // 1着の数
  | 'odds' // 的中した倍率
  | 'payout' // 1レースの払戻
  | 'coins' // 総獲得賞金・所持コイン
  | 'arena' // 対戦の優勝
  | 'dex' // 図鑑の集まり具合
  | 'streak' // 連勝
  | 'gp' // グランプリ
  | 'box' // 週末ボックスの限定称号
  | 'animal' // ショップの動物（住んでいる場所）
  | 'master'; // ショップのコンプリート

export type TitleArt = { motif: MotifKind; level: number; animal?: AnimalId };

const W = 200;
const H = 44;

/** 等間隔に n 個ぶんの x を返す（両端に余白を残す）。 */
function spread(n: number, from = 18, to = W - 18): number[] {
  if (n <= 1) return [(from + to) / 2];
  const step = (to - from) / (n - 1);
  return Array.from({ length: n }, (_, i) => from + step * i);
}

// ── 部品 ─────────────────────────────────────────────────────
// 小さくても何の絵か分かる形が要る。自分で影絵を起こすと帯の大きさでは
// ただの染みになったので、**画面のアイコンで実績のある形**（24×24）を流用する。
// 中心をそろえるため translate(-12,-12) してから拡大する。
const ICON = {
  horse: 'M4.5 21c0-5.5 1.8-9 5-11l-2.7-4.4c-.5-.8.5-1.6 1.2-1L11 7l1.3-3.6c.3-.9 1.6-.7 1.7.3l.3 3.4c1.7-1 3.9-1.5 6.4-1.4-.8 1.9-2 3.3-3.6 4.2 1.7 1.2 2.7 3.2 2.7 5.7 0 4-3 6.4-6.6 6.4l.5-4c-2 1-3.6 2.8-3.9 4z',
  swords: 'M3 3l6 2 8 8 1 4-4-1-8-8L3 3zm18 0l-2 6-3-1 4-5h1zM5 19l4-4 1 1-4 4-1-1zm12-4l4 4-1 1-4-4 1-1z',
  flag: 'M5 3v18H3V3h2zm2 1h13v9H7V4zm2 2v2h2V6H9zm4 0v2h2V6h-2zm-4 4v-2H7v2h2zm4 0v-2h-2v2h2zm4 0V8h-2v2h2zm-8 2v-2H7v2h2zm4 0v-2h-2v2h2z',
  trophy: 'M6 3h12v2h3v3c0 2-2 4-4 4-1 1-2 2-3 2v3h3v2H7v-2h3v-3c-1 0-2-1-3-2-2 0-4-2-4-4V5h3V3zm0 4H5v1c0 1 1 2 1 2V7zm12 0v3s1-1 1-2V8h-1z',
  ticket: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v2.2a2.8 2.8 0 000 5.6V17a2 2 0 01-2 2H5a2 2 0 01-2-2v-2.2a2.8 2.8 0 000-5.6V7zm11 0v2h1.6V7H14zm0 4v2h1.6v-2H14zm0 4v2h1.6v-2H14z',
  medal: 'M8.5 2h2.2l1.3 4.2L13.3 2h2.2l-2 6.2a6.4 6.4 0 11-3 0L8.5 2zm3.5 9.2l1.15 2.33 2.57.37-1.86 1.81.44 2.56L12 17.64l-2.3 1.21.44-2.56-1.86-1.81 2.57-.37L12 11.2z',
} as const;

function Glyph({ d, x, y, s, fill, o, rot = 0 }: { d: string; x: number; y: number; s: number; fill: string; o: number; rot?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) rotate(${rot}) scale(${s}) translate(-12 -12)`}
      d={d}
      fill={fill}
      fillRule="evenodd"
      opacity={o}
    />
  );
}

/** コイン。 */
function Coin({ x, y, r, fill, o }: { x: number; y: number; r: number; fill: string; o: number }) {
  return (
    <g opacity={o}>
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x} cy={y} r={r * 0.55} fill="none" stroke={fill} strokeWidth={r * 0.24} opacity="0.5" />
    </g>
  );
}





/** 連勝の山（重なるほど高くなる）。 */
function Chevron({ x, y, s, fill, o }: { x: number; y: number; s: number; fill: string; o: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M -7,5 L 0,-5 L 7,5 L 4,5 L 0,-1 L -4,5 Z"
      fill={fill}
      opacity={o}
    />
  );
}


// ── 動物の住んでいる場所 ─────────────────────────────────────
// その動物らしい景色を、シルエット2〜3枚で。細かく描いても帯の大きさでは潰れる。
//
// 色は **帯の地と反対の明るさ（ink）だけ** を使い、濃さで奥行きを出す。
// 動物ごとの色をそのまま使うと、地の色と同系色になって絵が消える（実際に消えた）。
function Habitat({ id, ink }: { id: AnimalId; ink: string }) {
  const A = { fill: ink, opacity: 0.5 }; // 手前
  const B = { fill: ink, opacity: 0.3 }; // 奥
  const L = { stroke: ink, fill: 'none', strokeLinecap: 'round' as const };
  switch (id) {
    case 'penguin': // 氷山と流氷
      return (
        <g>
          <path d="M 0,44 L 0,28 L 28,10 L 56,28 L 56,44 Z" {...B} />
          <path d="M 146,44 L 146,24 L 172,6 L 200,24 L 200,44 Z" {...B} />
          <path d="M 66,44 L 80,32 L 116,32 L 130,44 Z" {...A} />
          <path d="M 0,39 L 200,39" {...L} strokeWidth="2.4" opacity="0.45" />
        </g>
      );
    case 'panda': // 竹やぶ
      return (
        <g {...L} strokeWidth="4" opacity="0.5">
          {[18, 44, 70, 130, 156, 184].map((x, i) => (
            <g key={x}>
              <path d={`M ${x},44 L ${x + (i % 2 ? 3 : -3)},2`} />
              <path d={`M ${x},28 L ${x + 13},21`} strokeWidth="3" />
              <path d={`M ${x},16 L ${x - 13},9`} strokeWidth="3" />
            </g>
          ))}
        </g>
      );
    case 'cat': // 窓辺と毛糸玉
      return (
        <g>
          <rect x={10} y={5} width={48} height={36} rx={4} {...B} />
          <path d="M 34,5 L 34,41 M 10,23 L 58,23" {...L} strokeWidth="3" opacity="0.55" />
          <circle cx={168} cy={28} r={13} {...A} />
          <path d="M 157,25 C 166,17 179,25 178,33 M 159,34 C 168,28 176,20 179,24" {...L} strokeWidth="2.2" opacity="0.85" />
        </g>
      );
    case 'dog': // 犬小屋と骨
      return (
        <g>
          <path d="M 12,44 L 12,22 L 38,6 L 64,22 L 64,44 Z" {...B} />
          <path d="M 30,44 L 30,28 C 30,23 46,23 46,28 L 46,44 Z" fill={ink} opacity="0.5" />
          <g transform="translate(164,28) rotate(-18)" {...A}>
            <rect x={-14} y={-3} width={28} height={6} rx={3} />
            <circle cx={-15} cy={-4.6} r={4.2} /><circle cx={-15} cy={4.6} r={4.2} />
            <circle cx={15} cy={-4.6} r={4.2} /><circle cx={15} cy={4.6} r={4.2} />
          </g>
        </g>
      );
    case 'rabbit': // 草原とにんじん
      return (
        <g>
          <path d="M 0,44 C 32,26 66,26 98,44 Z" {...B} />
          <path d="M 106,44 C 140,24 178,24 200,44 Z" fill={ink} opacity="0.22" />
          <g transform="translate(160,22) rotate(16)" {...A}>
            <path d="M -6,-7 L 6,-7 L 0,14 Z" />
            <path d="M -5,-8 L -2,-17 M 0,-8 L 0,-18 M 5,-8 L 6,-16" stroke={ink} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          </g>
        </g>
      );
    case 'bear': // 森とはちみつ
      return (
        <g>
          {[16, 44, 166, 192].map((x, i) => (
            <path key={x} d={`M ${x},44 L ${x - 15},44 L ${x},${10 + (i % 2) * 7} L ${x + 15},44 Z`} {...B} />
          ))}
          <g transform="translate(104,24)" {...A}>
            <path d="M -10,-6 L 10,-6 L 8,12 L -8,12 Z" />
            <rect x={-12} y={-10} width={24} height={5} rx={2.4} />
          </g>
        </g>
      );
    case 'fox': // 夕暮れの林
      return (
        <g>
          <circle cx={166} cy={14} r={15} {...A} />
          {[12, 34, 56, 78].map((x, i) => (
            <path key={x} d={`M ${x},44 L ${x - 12},44 L ${x},${14 + (i % 2) * 6} L ${x + 12},44 Z`} {...B} />
          ))}
          <path d="M 0,41 L 200,41" {...L} strokeWidth="3" opacity="0.4" />
        </g>
      );
    case 'chick': // たまごとわら
      return (
        <g>
          <path d="M 32,44 C 12,44 8,28 20,16 C 27,9 41,9 48,16 C 60,28 56,44 32,44 Z" {...A} />
          <path d="M 14,34 L 50,34" {...L} strokeWidth="3" opacity="0.75" strokeDasharray="6 5" />
          <g {...L} strokeWidth="2.8" opacity="0.45">
            {[126, 144, 162, 180].map((x, i) => <path key={x} d={`M ${x},44 L ${x + (i % 2 ? 10 : -10)},24`} />)}
          </g>
        </g>
      );
    case 'frog': // 池と蓮の葉
      return (
        <g>
          <ellipse cx={100} cy={46} rx={100} ry={20} {...B} />
          {[36, 100, 164].map((x, i) => (
            <g key={x} {...A}>
              <ellipse cx={x} cy={28 + i * 2} rx={15} ry={6} />
              <path d={`M ${x},${28 + i * 2} L ${x + 14},${24 + i * 2}`} stroke={ink} strokeWidth="2" fill="none" />
            </g>
          ))}
        </g>
      );
    case 'squirrel': // 木とどんぐり
      return (
        <g>
          <path d="M 26,44 L 26,20 M 26,28 L 12,17 M 26,25 L 42,14" {...L} strokeWidth="4.5" opacity="0.5" />
          <ellipse cx={26} cy={11} rx={25} ry={12} {...B} />
          {[138, 164, 188].map((x, i) => (
            <g key={x} transform={`translate(${x},${28 + (i % 2) * 6})`} {...A}>
              <ellipse cx={0} cy={2} rx={6} ry={7.5} />
              <path d="M -6.4,-2.6 A 6.4,4 0 0 1 6.4,-2.6 Z" fill={ink} opacity="0.9" />
            </g>
          ))}
        </g>
      );
  }
}

// ── 本体 ─────────────────────────────────────────────────────
export default function TitleMotif({ art, ink }: { art: TitleArt; ink: string }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      aria-hidden
    >
      <Body art={art} ink={ink} />
    </svg>
  );
}

function Body({ art, ink }: { art: TitleArt; ink: string }) {
  const lv = Math.max(1, Math.min(6, art.level));
  // 帯の上でちゃんと見える濃さにする。薄すぎると「模様が無い」のと同じになる。
  const o = 0.3 + lv * 0.05; // 段が上がるほど少し濃く

  switch (art.motif) {
    // 見つけたウマが増えていく（ご要望そのまま）。上の段ほど大きく速そうに。
    case 'horses':
      return (
        <g>
          {spread(lv, 22, W - 22).map((x, i) => (
            <Glyph key={i} d={ICON.horse} x={x} y={24 + (i % 2 ? -2 : 2)} s={0.95 + lv * 0.06} fill={ink} o={o} />
          ))}
          {lv >= 4 && <path d="M 0,40 L 200,40" stroke={ink} strokeWidth="1.6" opacity={o * 0.7} />}
        </g>
      );
    // 走った数：ゴールの旗が増え、走路の線が引かれる
    case 'races':
      return (
        <g>
          {lv >= 2 && [26, 33, 40].slice(0, lv - 1).map((y) => (
            <path key={y} d={`M 0,${y} L 200,${y}`} stroke={ink} strokeWidth="1.4" opacity={o * 0.55} />
          ))}
          {spread(Math.min(lv, 5), 26, W - 26).map((x, i) => (
            <Glyph key={i} d={ICON.flag} x={x} y={22} s={0.9 + lv * 0.05} fill={ink} o={o} />
          ))}
        </g>
      );
    // 1着の数：リボンが増える
    case 'wins':
      return (
        <g>
          {spread(lv, 24, W - 24).map((x, i) => (
            <Glyph key={i} d={ICON.medal} x={x} y={22 + (i % 2 ? 2 : 0)} s={0.9 + lv * 0.06} fill={ink} o={o} />
          ))}
        </g>
      );
    // 当てた倍率：馬券が舞う
    case 'odds':
      return (
        <g>
          {spread(lv + 1, 20, W - 20).map((x, i) => (
            <Glyph key={i} d={ICON.ticket} x={x} y={16 + (i % 3) * 8} s={0.8 + lv * 0.04} rot={-14 + (i % 3) * 12} fill={ink} o={o} />
          ))}
        </g>
      );
    // 払戻・コイン：溢れる → 上の段では滝のように落ちる（ご要望）
    case 'payout':
    case 'coins': {
      const cols = 4 + lv;
      return (
        <g>
          {/* 下にたまるコインの山 */}
          <path d="M 0,44 C 26,34 54,38 78,44 Z" fill={ink} opacity={o * 0.8} />
          <path d="M 122,44 C 148,34 178,38 200,44 Z" fill={ink} opacity={o * 0.7} />
          {spread(cols, 12, W - 12).map((x, i) => (
            <Coin key={i} x={x} y={10 + ((i * 7) % 22)} r={3.4 + lv * 0.25} fill={ink} o={o} />
          ))}
          {/* 上の段は「滝」：縦に連なって落ちてくる */}
          {lv >= 5 &&
            [40, 100, 160].map((x, c) =>
              [0, 1, 2, 3].map((k) => (
                <Coin key={`${x}-${k}`} x={x + (k % 2 ? 5 : -5)} y={4 + k * 11 + c * 3} r={3} fill={ink} o={o * 0.9} />
              )),
            )}
        </g>
      );
    }
    // 対戦：交差した剣が増える（ご要望）
    case 'arena':
      return (
        <g>
          {spread(Math.min(lv, 5), 26, W - 26).map((x, i) => (
            <Glyph key={i} d={ICON.swords} x={x} y={22} s={0.95 + lv * 0.06} fill={ink} o={o} />
          ))}
          {lv >= 4 && <path d="M 0,38 L 200,38" stroke={ink} strokeWidth="1.6" opacity={o * 0.6} />}
        </g>
      );
    // 図鑑：マス目が埋まっていく
    case 'dex': {
      const cells = 24;
      const filled = Math.round((cells * lv) / 6);
      return (
        <g>
          {Array.from({ length: cells }, (_, i) => {
            const cx = 14 + (i % 12) * 15.6;
            const cy = 15 + Math.floor(i / 12) * 15;
            return (
              <rect
                key={i}
                x={cx - 5.4}
                y={cy - 5.4}
                width={10.8}
                height={10.8}
                rx={2.6}
                fill={i < filled ? ink : 'none'}
                stroke={ink}
                strokeWidth="1.2"
                opacity={i < filled ? o : o * 0.45}
              />
            );
          })}
        </g>
      );
    }
    // 連勝：勝ちの山が積み上がる
    case 'streak':
      return (
        <g>
          {spread(Math.min(lv + 1, 6), 22, W - 22).map((x, i) => (
            <Chevron key={i} x={x} y={30 - Math.min(i, 3) * 3} s={1.1 + lv * 0.08} fill={ink} o={o} />
          ))}
        </g>
      );
    // グランプリ：トロフィーと月桂樹
    case 'gp':
      return (
        <g>
          <Glyph d={ICON.trophy} x={100} y={21} s={1.35 + lv * 0.08} fill={ink} o={o * 1.1} />
          {[60, 140].map((x, i) => (
            <path
              key={x}
              d={`M ${x},34 C ${x + (i ? 10 : -10)},26 ${x + (i ? 12 : -12)},14 ${x + (i ? 6 : -6)},8`}
              fill="none"
              stroke={ink}
              strokeWidth="2.6"
              opacity={o * 0.8}
            />
          ))}
          {lv >= 5 && spread(4, 24, W - 24).map((x, i) => <Coin key={i} x={x} y={38} r={2.6} fill={ink} o={o * 0.7} />)}
        </g>
      );
    // 週末ボックス：きらめきだけ（左端の紋章が主役なので控えめに）
    case 'box':
      return (
        <g>
          {spread(6, 60, W - 16).map((x, i) => (
            <path
              key={i}
              transform={`translate(${x} ${12 + (i % 3) * 10}) scale(${0.9 + (i % 2) * 0.3})`}
              d="M 0,-7 L 1.8,-1.8 L 7,0 L 1.8,1.8 L 0,7 L -1.8,1.8 L -7,0 L -1.8,-1.8 Z"
              fill={ink}
              opacity={o}
            />
          ))}
        </g>
      );
    // ショップの動物：その動物が住んでいそうな場所
    case 'animal':
      return art.animal ? <Habitat id={art.animal} ink={ink} /> : null;
    // コンプリート：10種ぶんの色が並ぶ
    case 'master':
      return (
        <g>
          {ANIMALS.map((a, i) => (
            <rect key={a} x={(i * W) / ANIMALS.length} y={0} width={W / ANIMALS.length} height={H} fill={ANIMAL_TONE[a].bg} opacity="0.34" />
          ))}
          {spread(5, 24, W - 24).map((x, i) => (
            <path
              key={i}
              transform={`translate(${x} ${10 + (i % 2) * 8}) scale(1.1)`}
              d="M 0,-7 L 1.8,-1.8 L 7,0 L 1.8,1.8 L 0,7 L -1.8,1.8 L -7,0 L -1.8,-1.8 Z"
              fill="#ffffff"
              opacity="0.55"
            />
          ))}
        </g>
      );
  }
}
