import { useId } from 'react';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';

// スペシャルタスク（連勝チャレンジ）の報酬フレーム。連勝数(数のみ)を刻んだ特別な
// アイコンフレーム。Lv1..10 で徐々に豪華に：枠の太さ・スタッド・宝石・月桂樹・
// 王冠・オーラ…と段階的に足していく。狙いは殿堂フレーム以上のクオリティ。

type Tier = {
  base: string; // ベースリング色
  hi: string; // ハイライト
  lo: string; // 影
  gem: string; // 宝石／スタッド色
  ink: string; // 数字の色
  plate: string; // 数字プレートの地色
  plateHi: string;
  studs: number; // リング上のスタッド数（0=なし）
  doubleRing: boolean;
  gems: boolean; // 四方の宝石
  laurel: boolean; // 左右の月桂樹
  glow: boolean; // 外周のオーラ
  sparkles: boolean; // きらめき
  crown: boolean; // 上部の王冠
  rays: boolean; // 背後の放射光（最上位）
};

// 各 Lv のパレット＆装飾。最初は質素、上に行くほどゴージャス。
const TIERS: Record<number, Tier> = {
  1: { base: '#c88f5e', hi: '#efc59a', lo: '#8a5a30', gem: '#e6b98a', ink: '#5a3618', plate: '#e9cdae', plateHi: '#fbeada', studs: 0, doubleRing: false, gems: false, laurel: false, glow: false, sparkles: false, crown: false, rays: false },
  2: { base: '#c07b45', hi: '#e9b483', lo: '#7c4a22', gem: '#f0c79a', ink: '#4f2f14', plate: '#e6c39e', plateHi: '#fae7cf', studs: 8, doubleRing: false, gems: false, laurel: false, glow: false, sparkles: false, crown: false, rays: false },
  3: { base: '#c99a33', hi: '#f2d780', lo: '#8a661a', gem: '#ffe9a6', ink: '#5a410c', plate: '#ecd08a', plateHi: '#fdf0c4', studs: 10, doubleRing: true, gems: false, laurel: false, glow: false, sparkles: false, crown: false, rays: false },
  4: { base: '#bcc4cc', hi: '#ffffff', lo: '#7d8894', gem: '#eaf1f7', ink: '#39434d', plate: '#dbe3ea', plateHi: '#ffffff', studs: 12, doubleRing: true, gems: false, laurel: false, glow: false, sparkles: false, crown: false, rays: false },
  5: { base: '#e6b33a', hi: '#fff0ac', lo: '#a37c12', gem: '#7fe0ff', ink: '#5a410c', plate: '#f4dc86', plateHi: '#fffbe6', studs: 12, doubleRing: true, gems: true, laurel: false, glow: false, sparkles: false, crown: false, rays: false },
  6: { base: '#e2b23c', hi: '#fff0ac', lo: '#9c7410', gem: '#43d6a0', ink: '#204a37', plate: '#f2dc86', plateHi: '#fffbe6', studs: 14, doubleRing: true, gems: true, laurel: true, glow: false, sparkles: false, crown: false, rays: false },
  7: { base: '#d8dee6', hi: '#ffffff', lo: '#8792a0', gem: '#5aa6ff', ink: '#20406b', plate: '#cfe0f2', plateHi: '#ffffff', studs: 14, doubleRing: true, gems: true, laurel: true, glow: true, sparkles: false, crown: false, rays: false },
  8: { base: '#f0c23e', hi: '#fff2b6', lo: '#a67c10', gem: '#ff5f7a', ink: '#7a1226', plate: '#ffd9df', plateHi: '#fff2f4', studs: 16, doubleRing: true, gems: true, laurel: true, glow: true, sparkles: true, crown: false, rays: false },
  9: { base: '#e7e9f2', hi: '#ffffff', lo: '#9aa0c0', gem: '#b06bff', ink: '#4a1e7a', plate: '#e9dcff', plateHi: '#fbf6ff', studs: 18, doubleRing: true, gems: true, laurel: true, glow: true, sparkles: true, crown: true, rays: false },
  10: { base: '#ffd24a', hi: '#fff6cf', lo: '#c08a12', gem: '#ff5fae', ink: '#5a1046', plate: '#fff0c2', plateHi: '#fffaf0', studs: 20, doubleRing: true, gems: true, laurel: true, glow: true, sparkles: true, crown: true, rays: true },
};

const GEM_COLORS = ['#ff5f7a', '#5aa6ff', '#43d6a0', '#ffd24a', '#b06bff', '#ff9f43'];

function tierOf(level: number): Tier {
  return TIERS[Math.max(1, Math.min(10, level))];
}

export default function StreakFrame({ level, look, size = 104 }: { level: number; look: HorseLook; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const t = tierOf(level);
  const faceSize = size * 0.56;
  const cx = 60;
  const cy = 54;
  const R = 33; // ベースリング半径（viewBox 120）

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {/* 馬の顔（円形にクリップ、リングの内側に配置） */}
      <div style={{ position: 'absolute', left: `${(cx / 120) * 100}%`, top: `${(cy / 120) * 100}%`, width: faceSize, height: faceSize, transform: 'translate(-50%,-50%)', borderRadius: '50%', overflow: 'hidden' }} aria-hidden>
        <HorseFace horse={look} size={faceSize} />
      </div>

      <svg viewBox="0 0 120 120" width={size} height={size} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden>
        <defs>
          <radialGradient id={`ring-${uid}`} cx="50%" cy="38%" r="68%">
            <stop offset="0%" stopColor={t.hi} />
            <stop offset="52%" stopColor={t.base} />
            <stop offset="100%" stopColor={t.lo} />
          </radialGradient>
          <linearGradient id={`plate-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.plateHi} />
            <stop offset="100%" stopColor={t.plate} />
          </linearGradient>
          <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="55%" stopColor={t.hi} stopOpacity="0" />
            <stop offset="82%" stopColor={t.hi} stopOpacity="0.55" />
            <stop offset="100%" stopColor={t.hi} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 背後の放射光（最上位） */}
        {t.rays && (
          <g opacity="0.85">
            {Array.from({ length: 24 }).map((_, i) => {
              const a = (i / 24) * Math.PI * 2;
              const r0 = 40;
              const r1 = i % 2 ? 58 : 50;
              return (
                <line key={i} x1={cx + Math.cos(a) * r0} y1={cy + Math.sin(a) * r0} x2={cx + Math.cos(a) * r1} y2={cy + Math.sin(a) * r1} stroke={GEM_COLORS[i % GEM_COLORS.length]} strokeWidth={i % 2 ? 1.4 : 2.6} strokeLinecap="round" opacity={i % 2 ? 0.5 : 0.85} />
              );
            })}
          </g>
        )}

        {/* 外周オーラ */}
        {t.glow && <circle cx={cx} cy={cy} r={R + 5} fill={`url(#glow-${uid})`} />}

        {/* 左右の月桂樹 */}
        {t.laurel && [-1, 1].map((s) => (
          <g key={s} transform={`translate(${cx + s * (R + 1)}, ${cy + 8}) scale(${s}, 1)`}>
            <path d="M0 6 Q-9 2 -12 -12 Q-3 -8 0 4 Z" fill={t.base} stroke={t.lo} strokeWidth="0.6" opacity="0.95" />
            {Array.from({ length: 5 }).map((_, i) => {
              const yy = 4 - i * 4.6;
              const xx = -3 - i * 1.9;
              return <ellipse key={i} cx={xx} cy={yy} rx="3.4" ry="1.9" fill={t.hi} stroke={t.lo} strokeWidth="0.5" transform={`rotate(${-42 - i * 6} ${xx} ${yy})`} opacity="0.95" />;
            })}
          </g>
        ))}

        {/* ベース＋メインリング */}
        {t.doubleRing && <circle cx={cx} cy={cy} r={R + 3.2} fill="none" stroke={t.lo} strokeOpacity="0.4" strokeWidth="1.4" />}
        <circle cx={cx} cy={cy} r={R + 2} fill="none" stroke={t.lo} strokeOpacity="0.4" strokeWidth={2 + level * 0.35} />
        <circle cx={cx} cy={cy} r={R} fill="none" stroke={`url(#ring-${uid})`} strokeWidth={3 + level * 0.55} />
        <circle cx={cx} cy={cy} r={R - 2.4 - level * 0.2} fill="none" stroke={t.hi} strokeOpacity="0.85" strokeWidth="1" />

        {/* リング上のスタッド */}
        {t.studs > 0 && Array.from({ length: t.studs }).map((_, i) => {
          const a = (i / t.studs) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R;
          const y = cy + Math.sin(a) * R;
          return <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.9 : 1.2} fill={t.gem} stroke={t.lo} strokeWidth="0.5" />;
        })}

        {/* 四方のカラー宝石 */}
        {t.gems && [0, 1, 2, 3].map((i) => {
          const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R;
          const y = cy + Math.sin(a) * R;
          const col = GEM_COLORS[i % GEM_COLORS.length];
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={3.4} fill={col} stroke={t.lo} strokeWidth="0.8" />
              <circle cx={x - 0.9} cy={y - 0.9} r={1} fill="#fff" opacity="0.85" />
            </g>
          );
        })}

        {/* きらめき */}
        {t.sparkles && [[cx - R * 0.7, cy - R * 0.7], [cx + R * 0.72, cy - R * 0.55], [cx + R * 0.5, cy + R * 0.75]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`} opacity="0.95">
            <path d="M0 -3.2 L0.7 -0.7 L3.2 0 L0.7 0.7 L0 3.2 L-0.7 0.7 L-3.2 0 L-0.7 -0.7 Z" fill="#fff" />
          </g>
        ))}

        {/* 上部の王冠 */}
        {t.crown && (
          <g transform={`translate(${cx} ${cy - R - 3})`}>
            <path d="M-9 3 L-9 -4 L-4.5 0 L0 -6 L4.5 0 L9 -4 L9 3 Z" fill={`url(#ring-${uid})`} stroke={t.lo} strokeWidth="0.8" strokeLinejoin="round" />
            {[-6, 0, 6].map((x, i) => <circle key={i} cx={x} cy={-4.5 + (i === 1 ? -1.5 : 0)} r="1.5" fill={GEM_COLORS[i % GEM_COLORS.length]} stroke={t.lo} strokeWidth="0.4" />)}
            <rect x="-9" y="2.4" width="18" height="2.2" rx="1.1" fill={t.base} stroke={t.lo} strokeWidth="0.6" />
          </g>
        )}

        {/* 下部：連勝数(数のみ)のメダリオン */}
        <g transform={`translate(${cx} ${cy + R + 6})`}>
          <ellipse cx="0" cy="0" rx={13 + level * 0.55} ry={11 + level * 0.4} fill={`url(#plate-${uid})`} stroke={t.lo} strokeWidth="1.4" />
          <ellipse cx="0" cy="0" rx={10 + level * 0.5} ry={8.4 + level * 0.35} fill="none" stroke={t.hi} strokeWidth="0.9" opacity="0.8" />
          {t.gems && [-1, 1].map((s) => <circle key={s} cx={s * (13 + level * 0.55)} cy="0" r="2.2" fill={GEM_COLORS[level % GEM_COLORS.length]} stroke={t.lo} strokeWidth="0.5" />)}
          <text x="0" y={level >= 10 ? 0 : 0} textAnchor="middle" dominantBaseline="central" fontSize={level >= 10 ? 15 : 17} fontWeight="900" fill={t.ink} fontFamily="Georgia, 'Hiragino Mincho ProN', serif" style={{ letterSpacing: '-0.5px' }}>{level}</text>
        </g>
      </svg>
    </div>
  );
}
