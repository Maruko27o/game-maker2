import { useId } from 'react';
import type { BoxFrameKind, HorseLook } from '../types';
import HorseFace from './HorseFace';
import BoxCrest from './BoxCrest';

// 週末のボックスから出る限定フレーム。ゲーム内でいちばん出ないものなので、
// 他のどのフレームとも見間違えないところまで振り切る。
//
//  ・ラッキーボックス（土）＝ 0.1%
//      桃 → 珊瑚 → 橙 → 黄 と、リングの色そのものがゆっくり流れて変わる。
//      上にリボン結び、リングの上を小さなハートの鋲がまわる。
//  ・ゴールドボックス（日）＝ 0.1%
//      「金」ではなく「ダイヤ」。ほぼ透明のクリアなリングにカット面の稜線を入れ、
//      その上を虹色の分光がゆっくり流れる。上にブリリアントカットの石。
//
// どちらも中央のウマの顔の下に、丸いウマの顔の紋章（BoxCrest）を重ねる。
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
  const ringW = gold ? 8.4 : 7.6;

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
        <defs>{gold ? <GoldDefs uid={uid} /> : <LuckyDefs uid={uid} />}</defs>

        {/* いちばん外の光の輪。ここが「限定」の格を出す。 */}
        <circle cx={C} cy={C} r={58} fill={`url(#bglow-${uid})`} />

        {gold ? <GoldRing uid={uid} c={C} r={R} w={ringW} /> : <LuckyRing uid={uid} c={C} r={R} w={ringW} />}

        {/* リングを一周する流れる光 */}
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

        {gold ? <GoldTop uid={uid} c={C} /> : <LuckyTop c={C} />}

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

        {/* 下の紋章：丸いウマの顔。フレームと称号で同じ絵を使う。 */}
        <g transform={`translate(${C} 104)`}>
          <BoxCrest box={box} uid={`f${uid}`} r={13} />
        </g>
      </svg>
    </div>
  );
}

// ── ラッキー：色が流れるリボン ───────────────────────────────
// リングの色そのものを桃→珊瑚→橙→黄と循環させる。stop-color をアニメーション
// させれば、要素を重ねずに「色が変わる」が作れる。
const LUCKY_CYCLE = ['#e0518c', '#f2705f', '#f79a3c', '#f5c02e', '#e0518c'];
const LUCKY_HI = ['#ffd3e4', '#ffd9c8', '#ffe4bd', '#fff2c2', '#ffd3e4'];
const LUCKY_LO = ['#a52f60', '#b8452f', '#b86a12', '#a98a0e', '#a52f60'];
const CYCLE_DUR = '6s';

function cyc(v: string[]): string {
  return v.join(';');
}

function LuckyDefs({ uid }: { uid: string }) {
  return (
    <>
      <radialGradient id={`bring-${uid}`} cx="50%" cy="34%" r="72%">
        <stop offset="0%">
          <animate attributeName="stop-color" values={cyc(LUCKY_HI)} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
        <stop offset="50%">
          <animate attributeName="stop-color" values={cyc(LUCKY_CYCLE)} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
        <stop offset="100%">
          <animate attributeName="stop-color" values={cyc(LUCKY_LO)} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
      </radialGradient>
      <radialGradient id={`bglow-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="58%" stopColor="#ffd3e4" stopOpacity="0" />
        <stop offset="84%" stopOpacity="0.6">
          <animate attributeName="stop-color" values={cyc(LUCKY_HI)} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#ffd3e4" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`bsheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

function LuckyRing({ uid, c, r, w }: { uid: string; c: number; r: number; w: number }) {
  return (
    <>
      <circle cx={c} cy={c} r={r + w / 2 + 3} fill="none" stroke="#ffe9a8" strokeOpacity="0.75" strokeWidth="1.4" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#bring-${uid})`} strokeWidth={w} />
      <circle cx={c} cy={c} r={r + w / 2} fill="none" strokeOpacity="0.75" strokeWidth="1.2" fillOpacity="0">
        <animate attributeName="stroke" values={cyc(LUCKY_LO)} dur={CYCLE_DUR} repeatCount="indefinite" />
      </circle>
      <circle cx={c} cy={c} r={r - w / 2} fill="none" strokeOpacity="0.55" strokeWidth="1.2" fillOpacity="0">
        <animate attributeName="stroke" values={cyc(LUCKY_LO)} dur={CYCLE_DUR} repeatCount="indefinite" />
      </circle>
      {/* ハートの鋲。リングの上をゆっくり一周する。 */}
      <g>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${c} ${c}`} to={`360 ${c} ${c}`} dur="18s" repeatCount="indefinite" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          return (
            <path
              key={i}
              transform={`translate(${c + Math.cos(a) * r} ${c + Math.sin(a) * r}) scale(0.115)`}
              d="M 0,14 C -18,2 -12,-14 0,-6 C 12,-14 18,2 0,14 Z"
              fill="#fff"
              opacity="0.92"
            />
          );
        })}
      </g>
    </>
  );
}

function LuckyTop({ c }: { c: number }) {
  // リボンだけは桃で固定する。リングの色が黄に回ったとき、フレーム全体が
  // 金色に見えて「金のフレーム」と区別がつかなくなるのを防ぐ錨。
  return (
    <g transform={`translate(${c} 9)`}>
      <path d="M 0,2 L -13,-5 L -10,5 Z" fill="#f07aa8" stroke="#a52f60" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M 0,2 L 13,-5 L 10,5 Z" fill="#f07aa8" stroke="#a52f60" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx={0} cy={2} r={3.4} fill="#ffe9a8" stroke="#a52f60" strokeWidth="1.2" />
    </g>
  );
}

// ── ゴールド：ダイヤ ─────────────────────────────────────────
// 金色は使わない。ほぼ無色のクリアなリングに、カット面の稜線と虹の分光。
// 「金より上がある」と一目で分かるようにするのがねらい。
const PRISM = ['#ff5f8d', '#ffd24a', '#7dffa8', '#5fd4ff', '#b98cff', '#ff5f8d'];

function GoldDefs({ uid }: { uid: string }) {
  return (
    <>
      {/* クリアな石そのもの。白〜淡い水色だけで作る。 */}
      <radialGradient id={`bring-${uid}`} cx="50%" cy="30%" r="76%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="42%" stopColor="#eaf8ff" />
        <stop offset="72%" stopColor="#b9e2f2" />
        <stop offset="100%" stopColor="#7fb4cc" />
      </radialGradient>
      {/* 分光。リングの上をゆっくり回して、虹が「動いて見える」ようにする。 */}
      <linearGradient id={`bprism-${uid}`} x1="0" y1="0" x2="1" y2="1">
        {PRISM.map((color, i) => (
          <stop key={i} offset={`${(i / (PRISM.length - 1)) * 100}%`} stopColor={color} />
        ))}
      </linearGradient>
      <radialGradient id={`bglow-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="58%" stopColor="#eaf8ff" stopOpacity="0" />
        <stop offset="84%" stopColor="#eaf8ff" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#eaf8ff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`bsheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

function GoldRing({ uid, c, r, w }: { uid: string; c: number; r: number; w: number }) {
  return (
    <>
      <circle cx={c} cy={c} r={r + w / 2 + 3} fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.4" />
      <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#bring-${uid})`} strokeWidth={w} />
      {/* 分光の帯。クリアなリングの上に薄く重ねてゆっくり回す。 */}
      <circle cx={c} cy={c} r={r} fill="none" stroke={`url(#bprism-${uid})`} strokeWidth={w - 1.6} opacity="0.55">
        <animateTransform attributeName="transform" type="rotate" from={`0 ${c} ${c}`} to={`360 ${c} ${c}`} dur="9s" repeatCount="indefinite" />
      </circle>
      <circle cx={c} cy={c} r={r + w / 2} fill="none" stroke="#5f96ad" strokeOpacity="0.7" strokeWidth="1.2" />
      <circle cx={c} cy={c} r={r - w / 2} fill="none" stroke="#5f96ad" strokeOpacity="0.5" strokeWidth="1.2" />
      {/* カット面の稜線。放射状に入れると「削り出した石」に見える。 */}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const inner = r - w / 2;
        const outer = r + w / 2;
        return (
          <line
            key={i}
            x1={c + Math.cos(a) * inner}
            y1={c + Math.sin(a) * inner}
            x2={c + Math.cos(a) * outer}
            y2={c + Math.sin(a) * outer}
            stroke="#ffffff"
            strokeOpacity="0.75"
            strokeWidth="0.9"
          />
        );
      })}
    </>
  );
}

function GoldTop({ uid, c }: { uid: string; c: number }) {
  // ブリリアントカットの石を真上から見た形（上が台、下がとがる）。
  return (
    <g transform={`translate(${c} 9)`}>
      <path
        d="M -11,-3 L -5.5,-8 L 5.5,-8 L 11,-3 L 0,9 Z"
        fill={`url(#bring-${uid})`}
        stroke="#5f96ad"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M -11,-3 L 11,-3" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1" />
      <path d="M -5.5,-8 L -3.5,-3 L 0,9 M 5.5,-8 L 3.5,-3 L 0,9" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="0.9" />
      {/* 石の中で虹がちらつく */}
      <path d="M -11,-3 L -5.5,-8 L 5.5,-8 L 11,-3 L 0,9 Z" fill={`url(#bprism-${uid})`} opacity="0.4">
        <animate attributeName="opacity" values="0.15;0.55;0.15" dur="2.6s" repeatCount="indefinite" />
      </path>
    </g>
  );
}
