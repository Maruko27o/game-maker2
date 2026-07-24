import { useId } from 'react';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';

// 殿堂＆メールで配られる「アイコンフレーム」。デザインは固定で、
//  ・順位（1/2/3）＝金/銀/銅で色分け
//  ・種別（オッズ/賞金）＝上部の飾り帯に内包した小マークで見分け
//    （倍率＝✕バースト、賞金＝コイン）。年月を左右対称のマークで挟む（案C）。
//  ・獲得した年月＝帯の中央に「YYYY.M」
// 文字は年月だけ＝スタイリッシュに。毎月ランキング更新時に年月入りが自動生成される。

export type FrameRank = 1 | 2 | 3;
export type FrameMetric = 'odds' | 'payout';

const PALETTE: Record<FrameRank, { ring: string; ringHi: string; ringLo: string; gem: string; ink: string; band: string; bandHi: string }> = {
  1: { ring: '#eabf3e', ringHi: '#fff2b0', ringLo: '#a8791a', gem: '#fff6cf', ink: '#5c3f0c', band: '#f4d873', bandHi: '#fffbe6' },
  2: { ring: '#cdd5dd', ringHi: '#ffffff', ringLo: '#8b96a1', gem: '#eef3f7', ink: '#3c4750', band: '#dee5eb', bandHi: '#ffffff' },
  3: { ring: '#d8975a', ringHi: '#ffd9ac', ringLo: '#8f5a28', gem: '#ffe6cd', ink: '#5a3416', band: '#e3a86e', bandHi: '#ffe9d2' },
};

function periodDot(period: string): string {
  const [y, m] = period.split('-');
  return `${y}.${Number(m)}`;
}

// 種別の小マーク（帯に内包）。倍率＝バースト＋✕、賞金＝コイン。
function MetricMark({ metric, cx, cy, r, ink, coinFill }: { metric: FrameMetric; cx: number; cy: number; r: number; ink: string; coinFill: string }) {
  if (metric === 'odds') {
    const x = r * 0.42;
    return (
      <g>
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const r1 = (i % 2 ? 0.5 : 0.92) * r;
          return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={ink} strokeWidth={r * 0.13} strokeLinecap="round" opacity="0.5" />;
        })}
        <path d={`M${cx - x} ${cy - x} L${cx + x} ${cy + x} M${cx + x} ${cy - x} L${cx - x} ${cy + x}`} stroke={ink} strokeWidth={r * 0.34} strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={r * 0.82} fill={coinFill} stroke={ink} strokeWidth={r * 0.16} />
      <circle cx={cx} cy={cy} r={r * 0.46} fill="none" stroke={ink} strokeWidth={r * 0.14} opacity="0.8" />
    </g>
  );
}

export default function AvatarFrame({
  rank,
  metric,
  period,
  look,
  size = 104,
}: {
  rank: FrameRank;
  metric: FrameMetric;
  period: string;
  look: HorseLook;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const c = PALETTE[rank];
  // 顔は箱いっぱい（＝フレーム無しと同じ大きさ）。リング/飾り帯は箱より一回り大きい
  // SVGで顔の外側にはみ出して描く（フレームを付けても馬は小さくならない）。

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {/* horse portrait — fills the box, same size as the un-framed icon */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
        <HorseFace horse={look} size={size} />
      </div>

      {/* ornate frame overlay — larger than the box, spilling around the face */}
      <svg viewBox="0 0 100 100" style={{ position: 'absolute', left: '-16%', top: '-16%', width: '132%', height: '132%', pointerEvents: 'none', overflow: 'visible' }} aria-hidden>
        <defs>
          <radialGradient id={`g-${uid}`} cx="50%" cy="40%" r="65%">
            <stop offset="0%" stopColor={c.ringHi} />
            <stop offset="55%" stopColor={c.ring} />
            <stop offset="100%" stopColor={c.ringLo} />
          </radialGradient>
          <linearGradient id={`b-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.bandHi} />
            <stop offset="100%" stopColor={c.band} />
          </linearGradient>
        </defs>

        {/* soft base + double ring, hugging the outer rim of the face */}
        <circle cx="50" cy="50" r="41" fill="none" stroke={c.ringLo} strokeOpacity="0.35" strokeWidth="7.5" />
        <circle cx="50" cy="50" r="39.6" fill="none" stroke={`url(#g-${uid})`} strokeWidth="6" />
        <circle cx="50" cy="50" r="36.9" fill="none" stroke={c.ringHi} strokeOpacity="0.8" strokeWidth="1.3" />
        <circle cx="50" cy="50" r="43" fill="none" stroke={c.ringLo} strokeOpacity="0.5" strokeWidth="1" />

        {/* studs around the ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(a) * 39.6;
          const y = 50 + Math.sin(a) * 39.6;
          return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.5} fill={c.gem} stroke={c.ringLo} strokeWidth="0.6" />;
        })}

        {/* top cartouche: 左右対称の種別マークで年月を挟む（案C）。飾り帯はリング上端に
            重なって外側へポップ。 */}
        <g transform="translate(0 -8)">
          <path d="M20 15 Q20 9 26 9 L74 9 Q80 9 80 15 L80 15.5 Q80 21 74 21 L26 21 Q20 21 20 15 Z" fill={`url(#b-${uid})`} stroke={c.ringLo} strokeWidth="1.3" />
          <path d="M16 15 l4.5 -3 0 6 z M84 15 l-4.5 -3 0 6 z" fill={c.ringLo} />
          <MetricMark metric={metric} cx={27} cy={15} r={3.6} ink={c.ink} coinFill={c.bandHi} />
          <MetricMark metric={metric} cx={73} cy={15} r={3.6} ink={c.ink} coinFill={c.bandHi} />
          <text x="50" y="18.4" textAnchor="middle" fontSize="10" fontWeight="900" fill={c.ink} fontFamily="Georgia, 'Hiragino Mincho ProN', serif" style={{ letterSpacing: '0.4px' }}>{periodDot(period)}</text>
        </g>
      </svg>
    </div>
  );
}
