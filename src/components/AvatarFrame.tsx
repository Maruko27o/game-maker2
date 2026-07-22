import { useId } from 'react';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';

// 殿堂＆メールで配られる「アイコンフレーム」。デザインは固定で、
//  ・順位（1/2/3）＝金/銀/銅で色分け
//  ・種別（オッズ/賞金）＝下の紋章で見分け（倍率＝バースト、賞金＝コイン）
//  ・獲得した年月＝上部の飾り帯に「YYYY.M」
// 文字は最小限（年月だけ）。毎月ランキング更新時に、その年月入りが自動生成される。

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

export default function AvatarFrame({
  rank,
  metric,
  period,
  look,
  size = 108,
}: {
  rank: FrameRank;
  metric: FrameMetric;
  period: string;
  look: HorseLook;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const c = PALETTE[rank];
  const faceSize = size * 0.6;
  const boxH = size * 1.16;

  return (
    <div style={{ position: 'relative', width: size, height: boxH, flex: 'none' }}>
      {/* horse portrait, centred inside the ring */}
      <div style={{ position: 'absolute', left: size * 0.2, top: size * 0.22, width: faceSize, height: faceSize, borderRadius: '50%', overflow: 'hidden' }}>
        <HorseFace horse={look} size={faceSize} />
      </div>

      {/* ornate frame overlay */}
      <svg viewBox="0 0 100 116" width={size} height={boxH} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
        <defs>
          <radialGradient id={`g-${uid}`} cx="50%" cy="38%" r="65%">
            <stop offset="0%" stopColor={c.ringHi} />
            <stop offset="55%" stopColor={c.ring} />
            <stop offset="100%" stopColor={c.ringLo} />
          </radialGradient>
          <linearGradient id={`b-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.bandHi} />
            <stop offset="100%" stopColor={c.band} />
          </linearGradient>
        </defs>

        {/* soft base + double ring */}
        <circle cx="50" cy="52" r="36" fill="none" stroke={c.ringLo} strokeOpacity="0.35" strokeWidth="8" />
        <circle cx="50" cy="52" r="34.5" fill="none" stroke={`url(#g-${uid})`} strokeWidth="6.5" />
        <circle cx="50" cy="52" r="31" fill="none" stroke={c.ringHi} strokeOpacity="0.8" strokeWidth="1.4" />
        <circle cx="50" cy="52" r="38" fill="none" stroke={c.ringLo} strokeOpacity="0.5" strokeWidth="1" />

        {/* studs around the ring */}
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + Math.cos(a) * 34.5;
          const y = 52 + Math.sin(a) * 34.5;
          return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.5} fill={c.gem} stroke={c.ringLo} strokeWidth="0.6" />;
        })}

        {/* top cartouche with the year.month */}
        <g>
          <path d="M22 15 Q22 8 30 8 L70 8 Q78 8 78 15 L78 19 Q78 25 70 25 L30 25 Q22 25 22 19 Z" fill={`url(#b-${uid})`} stroke={c.ringLo} strokeWidth="1.4" />
          <path d="M18 16 l6 -4 0 8 z M82 16 l-6 -4 0 8 z" fill={c.ringLo} />
          <text x="50" y="20.5" textAnchor="middle" fontSize="10.5" fontWeight="900" fill={c.ink} fontFamily="Georgia, 'Hiragino Mincho ProN', serif" style={{ letterSpacing: '0.5px' }}>{periodDot(period)}</text>
        </g>

        {/* bottom emblem: metric badge */}
        <g transform="translate(50 100)">
          <circle r="13" fill={`url(#g-${uid})`} stroke={c.ringLo} strokeWidth="1.6" />
          <circle r="9.5" fill="none" stroke={c.ringHi} strokeOpacity="0.7" strokeWidth="1" />
          {metric === 'odds' ? (
            // 倍率フレーム：バースト＋×（大穴的中）
            <g>
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i / 12) * Math.PI * 2;
                const r1 = i % 2 ? 5.5 : 9;
                return <line key={i} x1="0" y1="0" x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={c.ink} strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />;
              })}
              <path d="M-3.4 -3.4 L3.4 3.4 M3.4 -3.4 L-3.4 3.4" stroke={c.ink} strokeWidth="2.6" strokeLinecap="round" />
            </g>
          ) : (
            // 賞金フレーム：コイン
            <g>
              <circle r="7.5" fill={c.bandHi} stroke={c.ink} strokeWidth="1.4" />
              <circle r="4.6" fill="none" stroke={c.ink} strokeWidth="1.2" opacity="0.8" />
              <circle cx="-2" cy="-2.4" r="1.4" fill="#ffffff" opacity="0.85" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
