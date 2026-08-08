import { useId } from 'react';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import { MetalSheen, GemFlash } from './FrameFx';
import { usePrefersReducedMotion } from '../hooks';

// 殿堂フレーム（月間ランキング上位3名へ毎月配布）。全プレイヤーの頂点にふさわしい
// 重厚な鋳造メタル調のメダル：分厚いベベルのリング＋台座付きの塊の宝石＋立体的な
// 王冠、下部に「殿堂」銘板（種別＝最高倍率／最大獲得賞金のイラスト付き）＋年月。
// 連勝フレーム（円リング＋英字 "N WINS"）とは意匠を明確に分けている。
//  ・順位（1/2/3）＝金/銀/銅で色分け
//  ・種別（odds=最高倍率＝倍率バースト / payout=最大獲得賞金＝コイン）

export type FrameRank = 1 | 2 | 3;
export type FrameMetric = 'odds' | 'payout';

type Pal = {
  ring: string; hi: string; lo: string; deep: string; darkest: string;
  gem: string; accent: string; ink: string; bandHi: string; band: string;
};
const PALETTE: Record<FrameRank, Pal> = {
  1: { ring: '#e6b833', hi: '#fff2b0', lo: '#9c6f13', deep: '#6b4a0c', darkest: '#3f2c06', gem: '#fff6cf', accent: '#d8385f', ink: '#4a3208', bandHi: '#fff0b8', band: '#d9ad3a' },
  2: { ring: '#c2ccd6', hi: '#ffffff', lo: '#7c8894', deep: '#525d67', darkest: '#333b43', gem: '#eef3f7', accent: '#4a90e0', ink: '#333d47', bandHi: '#ffffff', band: '#cbd4dc' },
  3: { ring: '#cf8f4f', hi: '#ffd9ac', lo: '#82521f', deep: '#5a3416', darkest: '#361d0b', gem: '#ffe6cd', accent: '#2fa877', ink: '#4a2c11', bandHi: '#ffe3c4', band: '#c98a52' },
};

const CX = 60, CY = 60, R = 47;
const pol = (a: number, r: number): [number, number] => [CX + Math.cos((a * Math.PI) / 180) * r, CY + Math.sin((a * Math.PI) / 180) * r];

// 台座付きの太い宝石（線ではなく塊で重量感）。
function BezelGem({ x, y, r, c, uid }: { x: number; y: number; r: number; c: Pal; uid: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r + 1.7} fill={`url(#bevel-${uid})`} stroke={c.darkest} strokeWidth="0.8" />
      <circle cx={x} cy={y} r={r} fill={c.accent} stroke={c.darkest} strokeWidth="0.8" />
      <circle cx={x - r * 0.32} cy={y - r * 0.32} r={r * 0.34} fill="#fff" opacity="0.85" />
    </g>
  );
}

// 種別イラスト：最高倍率＝倍率バースト（×）、最大獲得賞金＝コイン。銘板の左に置く。
function MetricIcon({ metric, x, y, c }: { metric: FrameMetric; x: number; y: number; c: Pal }) {
  if (metric === 'payout') {
    return (
      <g transform={`translate(${x} ${y})`}>
        <circle r="4.6" fill={c.bandHi} stroke={c.ink} strokeWidth="1" />
        <circle r="2.9" fill="none" stroke={c.ink} strokeWidth="0.9" opacity="0.8" />
        <text x="0" y="0.4" textAnchor="middle" dominantBaseline="central" fontSize="4.4" fontWeight="900" fill={c.ink} fontFamily="Georgia,serif">¥</text>
      </g>
    );
  }
  return (
    <g transform={`translate(${x} ${y})`}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2, r1 = (i % 2 ? 2.4 : 4.6);
        return <line key={i} x1="0" y1="0" x2={Math.cos(a) * r1} y2={Math.sin(a) * r1} stroke={c.ink} strokeWidth="0.9" strokeLinecap="round" opacity="0.45" />;
      })}
      <path d="M-2.2 -2.2 L2.2 2.2 M2.2 -2.2 L-2.2 2.2" stroke={c.ink} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

function periodDot(period: string): string {
  const [y, m] = period.split('-');
  return `${y}.${Number(m)}`;
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
  const still = usePrefersReducedMotion();
  // 順位が上がるほど、光沢が速く強くなる（金＞銀＞銅）。
  const sheenDur = rank === 1 ? 3 : rank === 2 ? 3.8 : 4.6;
  const sheenStrength = rank === 1 ? 0.95 : rank === 2 ? 0.85 : 0.7;

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {/* horse portrait — fills the box, same size as the un-framed icon */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }}>
        <HorseFace horse={look} size={size} />
      </div>

      {/* heavy medal overlay — larger than the box, spilling around the face */}
      <svg viewBox="0 0 120 120" style={{ position: 'absolute', left: '-16%', top: '-16%', width: '132%', height: '132%', pointerEvents: 'none', overflow: 'visible' }} aria-hidden>
        <defs>
          <radialGradient id={`ring-${uid}`} cx="50%" cy="30%" r="78%">
            <stop offset="0%" stopColor={c.hi} /><stop offset="45%" stopColor={c.ring} /><stop offset="100%" stopColor={c.lo} />
          </radialGradient>
          <linearGradient id={`bevel-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.hi} /><stop offset="45%" stopColor={c.ring} /><stop offset="100%" stopColor={c.deep} />
          </linearGradient>
          <linearGradient id={`band-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.bandHi} /><stop offset="55%" stopColor={c.band} /><stop offset="100%" stopColor={c.deep} />
          </linearGradient>
        </defs>

        {/* thick beveled cast-metal ring (面と層で重厚に) */}
        <circle cx={CX} cy={CY} r={R + 6} fill="none" stroke={c.darkest} strokeWidth="2.5" />
        <circle cx={CX} cy={CY} r={R + 3.4} fill="none" stroke={c.lo} strokeWidth="4" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={`url(#bevel-${uid})`} strokeWidth="7.5" />
        <circle cx={CX} cy={CY} r={R + 2.4} fill="none" stroke={c.hi} strokeOpacity="0.7" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={R - 3.2} fill="none" stroke={c.hi} strokeOpacity="0.6" strokeWidth="1" />
        <circle cx={CX} cy={CY} r={R - 4.4} fill="none" stroke={c.darkest} strokeWidth="1.8" />

        {/* 鋳込んだ金属の光沢。帯そのものを斜めの光がすうっと横切る。
            殿堂は「重い金属の塊」が売りなので、動きもそこに乗せる（枠の外では動かさない）。 */}
        <MetalSheen c={CX} r={R} w={7.5} uid={`av${uid}`} dur={sheenDur} strength={sheenStrength} still={still} />
        {/* 王冠と銘板の帯にも同じ光を通す（面がつながって見えるように） */}
        <MetalSheen c={CX} r={R + 3.4} w={4} uid={`av2${uid}`} dur={sheenDur} strength={sheenStrength * 0.6} still={still} />

        {/* 四方の石が順にきらりと光る。順位が上がるほど間隔が短い。 */}
        <GemFlash c={CX} r={R} uid={`av${uid}`} count={4} color={c.gem} size={4.2} dur={sheenDur * 0.85} still={still} />

        {/* studs (solid dots) between the cardinal gems */}
        {Array.from({ length: 12 }).map((_, i) => {
          const [x, y] = pol((i / 12) * 360 - 90 + 15, R);
          return <circle key={i} cx={x} cy={y} r="1.3" fill={c.gem} stroke={c.darkest} strokeWidth="0.4" />;
        })}
        {/* four chunky bezel gems (rank accent) */}
        {[0, 1, 2, 3].map((i) => { const [x, y] = pol(i * 90 - 90, R); return <BezelGem key={i} x={x} y={y} r={3.4} c={c} uid={uid} />; })}

        {/* heavy crown on top (shadow base + bright top for depth) */}
        <g transform={`translate(${CX} ${CY - R - 1})`}>
          <path d="M-15 7 L-15 -7 L-8 2 L0 -12 L8 2 L15 -7 L15 7 Z" fill={c.deep} transform="translate(0 1.2)" />
          <path d="M-15 7 L-15 -7 L-8 2 L0 -12 L8 2 L15 -7 L15 7 Z" fill={`url(#bevel-${uid})`} stroke={c.darkest} strokeWidth="1.1" strokeLinejoin="round" />
          <rect x="-16" y="6" width="32" height="5.2" rx="2.4" fill={`url(#band-${uid})`} stroke={c.darkest} strokeWidth="1" />
          {[-10, 0, 10].map((x, i) => <BezelGem key={i} x={x} y={-8 + (i === 1 ? -3 : 0)} r={2.2} c={c} uid={uid} />)}
        </g>

        {/* bottom 殿堂 plate: metric illustration + 殿堂, year.month below */}
        <g transform={`translate(0 ${CY + R - 3})`}>
          <path d="M22 3 L11 12 L18 1 L11 -10 L22 -3 Z" fill={c.deep} />
          <path d="M98 3 L109 12 L102 1 L109 -10 L98 -3 Z" fill={c.deep} />
          <rect x="20" y="-11" width="80" height="22" rx="5" fill={c.darkest} transform="translate(0 1.4)" />
          <rect x="20" y="-11" width="80" height="22" rx="5" fill={`url(#band-${uid})`} stroke={c.darkest} strokeWidth="1.3" />
          <rect x="22.5" y="-8.5" width="75" height="4" rx="2" fill={c.hi} opacity="0.5" />
          {/* 種別イラストを左右両端に対称配置（最高倍率＝×バースト／最大獲得賞金＝¥コイン）*/}
          <MetricIcon metric={metric} x={33} y={-2.5} c={c} />
          <MetricIcon metric={metric} x={87} y={-2.5} c={c} />
          <text x={60} y="-2.5" textAnchor="middle" dominantBaseline="central" fontSize="9" fontWeight="900" fill={c.ink} fontFamily="'Hiragino Mincho ProN',serif" style={{ letterSpacing: '3px' }}>殿堂</text>
          <text x={60} y="6" textAnchor="middle" dominantBaseline="central" fontSize="5" fontWeight="800" fill={c.ink} fontFamily="Georgia,serif" style={{ letterSpacing: '0.6px' }}>{periodDot(period)}</text>
        </g>
      </svg>
    </div>
  );
}
