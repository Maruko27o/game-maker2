import { useId } from 'react';
import type { BoxFrameKind, HorseLook } from '../types';
import HorseFace from './HorseFace';

// 週末のボックスから出る限定フレーム。
//  ・ラッキーボックス（土）＝ 1/1000 … リボンを結んだ贈り物のリング
//  ・ゴールドボックス（日）＝ 1/10000 … このゲームでいちばん出ない。王冠つきの金冠
//
// どちらも「一度きり」。他のフレームより明らかに特別に見えるよう、外側にもう一枚
// 光の輪を足し、ゴールドは王冠と流れる光まで乗せている。
// 座標系・リング半径・太さの帯は連勝／適性フレームとそろえる。

const R = 47;
const SPILL = 0.16;

export default function BoxFrame({
  box,
  look,
  size = 104,
}: {
  box: BoxFrameKind;
  look: HorseLook;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const off = `${-SPILL * 100}%`;
  const span = `${(1 + SPILL * 2) * 100}%`;
  const gold = box === 'gold';
  const C = 60;
  const ringW = gold ? 8.2 : 7.4;

  // ラッキー＝桃×金のリボン、ゴールド＝金×白金の王冠。
  const t = gold
    ? { base: '#e8b62c', hi: '#fff3c4', lo: '#9a6f10', accent: '#fff8dc', plate: '#ffe9a8', ink: '#5a3f00' }
    : { base: '#e0518c', hi: '#ffd3e4', lo: '#a52f60', accent: '#ffe9a8', plate: '#ffd0e2', ink: '#7a1c42' };

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }} aria-hidden>
        <HorseFace horse={look} size={size} />
      </div>

      <svg
        viewBox="0 0 120 120"
        style={{ position: 'absolute', left: off, top: off, width: span, height: span, pointerEvents: 'none', overflow: 'visible' }}
        aria-label={gold ? 'ゴールドボックス限定フレーム' : 'ラッキーボックス限定フレーム'}
      >
        <defs>
          <radialGradient id={`bring-${uid}`} cx="50%" cy="34%" r="72%">
            <stop offset="0%" stopColor={t.hi} />
            <stop offset="50%" stopColor={t.base} />
            <stop offset="100%" stopColor={t.lo} />
          </radialGradient>
          <radialGradient id={`bglow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="58%" stopColor={t.hi} stopOpacity="0" />
            <stop offset="84%" stopColor={t.hi} stopOpacity="0.6" />
            <stop offset="100%" stopColor={t.hi} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`bsheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* いちばん外の光の輪。ここが「限定」の格を出す。 */}
        <circle cx={C} cy={C} r={58} fill={`url(#bglow-${uid})`} />
        <circle cx={C} cy={C} r={R + ringW / 2 + 3} fill="none" stroke={t.accent} strokeOpacity="0.75" strokeWidth="1.4" />

        {/* 主リング */}
        <circle cx={C} cy={C} r={R} fill="none" stroke={`url(#bring-${uid})`} strokeWidth={ringW} />
        <circle cx={C} cy={C} r={R + ringW / 2} fill="none" stroke={t.lo} strokeOpacity="0.75" strokeWidth="1.2" />
        <circle cx={C} cy={C} r={R - ringW / 2} fill="none" stroke={t.lo} strokeOpacity="0.55" strokeWidth="1.2" />

        {/* リングを一周する流れる光（どちらの箱にも付ける） */}
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke={`url(#bsheen-${uid})`}
          strokeWidth={ringW - 2}
          strokeDasharray="26 270"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${C} ${C}`}
            to={`360 ${C} ${C}`}
            dur={gold ? '3.4s' : '4.6s'}
            repeatCount="indefinite"
          />
        </circle>

        {/* 鋲 */}
        {Array.from({ length: gold ? 24 : 18 }, (_, i) => {
          const a = (i / (gold ? 24 : 18)) * Math.PI * 2 - Math.PI / 2;
          return <circle key={i} cx={C + Math.cos(a) * R} cy={C + Math.sin(a) * R} r={1.1} fill={t.hi} opacity="0.95" />;
        })}

        {gold ? (
          // ゴールド：上に王冠
          <g transform={`translate(${C} 8)`}>
            <path
              d="M -13,7 L -13,-2 L -7,3 L 0,-6 L 7,3 L 13,-2 L 13,7 Z"
              fill={`url(#bring-${uid})`}
              stroke={t.lo}
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
            {[-8, 0, 8].map((x) => (
              <circle key={x} cx={x} cy={8.5} r={1.7} fill={t.accent} stroke={t.lo} strokeWidth="0.7" />
            ))}
          </g>
        ) : (
          // ラッキー：上にリボン結び
          <g transform={`translate(${C} 9)`}>
            <path d="M 0,2 L -13,-5 L -10,5 Z" fill={`url(#bring-${uid})`} stroke={t.lo} strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M 0,2 L 13,-5 L 10,5 Z" fill={`url(#bring-${uid})`} stroke={t.lo} strokeWidth="1.4" strokeLinejoin="round" />
            <circle cx={0} cy={2} r={3.2} fill={t.accent} stroke={t.lo} strokeWidth="1.2" />
          </g>
        )}

        {/* きらめき */}
        {[[16, 24], [104, 26], [14, 94], [106, 96]].map(([x, y], i) => (
          <path
            key={i}
            transform={`translate(${x} ${y})`}
            d="M 0,-5 L 1.3,-1.3 L 5,0 L 1.3,1.3 L 0,5 L -1.3,1.3 L -5,0 L -1.3,-1.3 Z"
            fill="#fff"
            opacity="0.9"
          >
            <animate attributeName="opacity" values="0.15;1;0.15" dur="2.4s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
          </path>
        ))}

        {/* 下の銘板 */}
        <g transform={`translate(${C} 104)`}>
          <rect x={-27} y={-9} width={54} height={18} rx={9} fill={t.plate} stroke={t.lo} strokeWidth="1.6" />
          <text
            x={0}
            y={0.5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9.5"
            fontWeight="900"
            fontFamily="system-ui, sans-serif"
            fill={t.ink}
            stroke="#fff"
            strokeWidth="1.8"
            paintOrder="stroke"
          >
            {gold ? 'GOLD' : 'LUCKY'}
          </text>
        </g>
      </svg>
    </div>
  );
}
