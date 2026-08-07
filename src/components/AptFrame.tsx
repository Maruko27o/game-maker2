import { useId } from 'react';
import type { AptGrade, HorseLook } from '../types';
import HorseFace from './HorseFace';

// スペシャルタスク（適性チャレンジ）の報酬フレーム。
// 6コースすべての適性が同じ等級のウマを手に入れると、その等級のフレームがもらえる。
//
// 見た目の決めごと：
//  ・座標系・リング半径・太さは連勝フレーム（StreakFrame）とそろえる
//  ・色は詳細画面で使っている適性の色そのまま（銅C / 銀B / 金A / 虹S）
//  ・S に近づくほど飾りが増える（鋲 → 月桂樹 → 宝石＋オーラ → 虹リング＋きらめき）
//  ・下の銘板に等級の文字（C / B / A / S）を刻む
//
// 「一度もらったら取り上げない」ので、このフレームは等級だけを持つ（どのウマで
// 取ったかは持たない）。引退させても厳選で振り直しても消えない。

const R = 47; // 顔の縁のすぐ外にくるリング半径（viewBox 120・顔の縁≈45.5）
const SPILL = 0.16; // 箱に対して各辺 16% はみ出す（SVGは 132% サイズ）

type Tier = {
  base: string;
  hi: string;
  lo: string;
  ink: string; // 銘板の文字色
  plate: string;
  plateHi: string;
  studs: number;
  laurel: boolean;
  gems: boolean;
  glow: boolean;
  sparkles: boolean;
  rainbow: boolean;
};

const TIERS: Record<AptGrade, Tier> = {
  C: {
    base: '#b97742', hi: '#e7b184', lo: '#7c4a20', ink: '#5b3a1c',
    plate: '#d9a273', plateHi: '#f2cba6',
    studs: 8, laurel: false, gems: false, glow: false, sparkles: false, rainbow: false,
  },
  B: {
    base: '#b9c4cf', hi: '#f4f8fb', lo: '#77828e', ink: '#3f4650',
    plate: '#dfe6ed', plateHi: '#ffffff',
    studs: 12, laurel: true, gems: false, glow: false, sparkles: false, rainbow: false,
  },
  A: {
    base: '#e9b93c', hi: '#fff0b8', lo: '#a2760f', ink: '#5a3f00',
    plate: '#ffe9a8', plateHi: '#fff8dc',
    studs: 16, laurel: true, gems: true, glow: true, sparkles: false, rainbow: false,
  },
  S: {
    base: '#c4a2ff', hi: '#ffffff', lo: '#7b5fc0', ink: '#3a2c1c',
    plate: '#ffd59a', plateHi: '#fdff9a',
    studs: 20, laurel: true, gems: true, glow: true, sparkles: true, rainbow: true,
  },
};

// 虹リングの色（適性 S の背景と同じ並び）。
const BOW = ['#ff9aa2', '#ffd59a', '#fdff9a', '#9affb0', '#9ad9ff', '#c4a2ff'];
// 等級ごとのリングの太さ。連勝フレーム（6.2〜8.2）と同じ帯に収める。
const RING_W: Record<AptGrade, number> = { C: 6.4, B: 6.9, A: 7.5, S: 8.2 };

export default function AptFrame({
  grade,
  look,
  size = 104,
}: {
  grade: AptGrade;
  look: HorseLook;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const t = TIERS[grade];
  const off = `${-SPILL * 100}%`;
  const span = `${(1 + SPILL * 2) * 100}%`;
  const ringW = RING_W[grade];
  const C = 60;

  const studs = Array.from({ length: t.studs }, (_, i) => {
    const a = (i / t.studs) * Math.PI * 2 - Math.PI / 2;
    return { x: C + Math.cos(a) * R, y: C + Math.sin(a) * R };
  });

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {/* 馬の顔＝箱いっぱい（フレーム無しと同じ大きさ） */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }} aria-hidden>
        <HorseFace horse={look} size={size} />
      </div>

      {/* リング／装飾は箱より一回り大きいSVGで、顔の外側にはみ出して描く */}
      <svg
        viewBox="0 0 120 120"
        style={{ position: 'absolute', left: off, top: off, width: span, height: span, pointerEvents: 'none', overflow: 'visible' }}
        aria-label={`適性${grade}のフレーム`}
      >
        <defs>
          <radialGradient id={`aring-${uid}`} cx="50%" cy="36%" r="70%">
            <stop offset="0%" stopColor={t.hi} />
            <stop offset="52%" stopColor={t.base} />
            <stop offset="100%" stopColor={t.lo} />
          </radialGradient>
          <linearGradient id={`abow-${uid}`} x1="0" y1="0" x2="1" y2="1">
            {BOW.map((c, i) => (
              <stop key={c} offset={`${(i / (BOW.length - 1)) * 100}%`} stopColor={c} />
            ))}
          </linearGradient>
          <linearGradient id={`aplate-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.plateHi} />
            <stop offset="100%" stopColor={t.plate} />
          </linearGradient>
          <radialGradient id={`aglow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor={t.hi} stopOpacity="0" />
            <stop offset="86%" stopColor={t.hi} stopOpacity="0.5" />
            <stop offset="100%" stopColor={t.hi} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 外周のオーラ（A 以上） */}
        {t.glow && <circle cx={C} cy={C} r={57} fill={`url(#aglow-${uid})`} />}

        {/* 左右の月桂樹（B 以上） */}
        {t.laurel && (
          <g fill={t.base} opacity="0.92">
            {[-1, 1].map((s) => (
              <g key={s} transform={`translate(${C + s * (R + 5)} ${C}) scale(${s} 1)`}>
                {[-21, -10.5, 0, 10.5, 21].map((dy, i) => (
                  <ellipse
                    key={dy}
                    cx={0}
                    cy={dy}
                    rx={2.9 - Math.abs(i - 2) * 0.32}
                    ry={5.6 - Math.abs(i - 2) * 0.7}
                    transform={`rotate(${dy * 0.6})`}
                  />
                ))}
              </g>
            ))}
          </g>
        )}

        {/* リング本体。S だけ虹。 */}
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke={t.rainbow ? `url(#abow-${uid})` : `url(#aring-${uid})`}
          strokeWidth={ringW}
        />
        <circle cx={C} cy={C} r={R + ringW / 2} fill="none" stroke={t.lo} strokeOpacity="0.7" strokeWidth="1.2" />
        <circle cx={C} cy={C} r={R - ringW / 2} fill="none" stroke={t.lo} strokeOpacity="0.5" strokeWidth="1.2" />

        {/* 鋲。等級が上がるほど密になる。 */}
        {studs.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.15} fill={t.hi} opacity="0.95" />
        ))}

        {/* 四方の宝石（A 以上） */}
        {t.gems &&
          [0, 90, 180, 270].map((deg) => {
            const a = ((deg - 90) * Math.PI) / 180;
            return (
              <g key={deg} transform={`translate(${C + Math.cos(a) * R} ${C + Math.sin(a) * R}) rotate(${deg})`}>
                <path
                  d="M 0,-4.4 L 3.4,0 L 0,4.4 L -3.4,0 Z"
                  fill={t.rainbow ? `url(#abow-${uid})` : t.plateHi}
                  stroke={t.lo}
                  strokeWidth="0.9"
                />
              </g>
            );
          })}

        {/* きらめき（S だけ） */}
        {t.sparkles &&
          [[18, 20], [102, 24], [16, 96], [104, 100]].map(([x, y], i) => (
            <path
              key={i}
              transform={`translate(${x} ${y})`}
              d="M 0,-5 L 1.3,-1.3 L 5,0 L 1.3,1.3 L 0,5 L -1.3,1.3 L -5,0 L -1.3,-1.3 Z"
              fill="#fff"
              opacity="0.95"
            />
          ))}

        {/* 下の銘板に等級の文字 */}
        <g transform={`translate(${C} 104)`}>
          <rect x={-19} y={-9} width={38} height={18} rx={9} fill={`url(#aplate-${uid})`} stroke={t.lo} strokeWidth="1.6" />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="13"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            fill={t.ink}
            stroke="#fff"
            strokeWidth="2.2"
            paintOrder="stroke"
          >
            {grade}
          </text>
        </g>
      </svg>
    </div>
  );
}
