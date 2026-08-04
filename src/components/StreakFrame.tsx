import { useId } from 'react';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';

// スペシャルタスク（連勝チャレンジ）の報酬フレーム。連勝数(数のみ)を刻んだ特別な
// アイコンフレーム。Lv1..10 で徐々に豪華に。数字は丸枠に閉じ込めず、数字の形に沿った
// 縁取り（paint-order stroke）でポップに。下部には「N WINS」のリボン帯（PPPoker参考）。
// variant で数字の配置パターンを切り替えられる（コーナー／リボン／エンブレム）。

export type StreakVariant = 'corner' | 'ribbon' | 'emblem';

type Tier = {
  base: string; // リング主色
  hi: string; // ハイライト
  lo: string; // 影
  gem: string; // スタッド色
  numFill: string; // 数字の塗り
  numLine: string; // 数字の縁取り
  ribbon: string; // リボン地色
  ribbonHi: string;
  ribbonInk: string; // リボン文字色
  studs: number;
  gems: boolean; // 四方の宝石
  laurel: boolean; // 左右の月桂樹
  glow: boolean; // 外周オーラ
  sparkles: boolean;
  crown: boolean;
  jewels: boolean; // 下部の星／クリスタル（最上位、旧・放射光の置き換え）
};

const TIERS: Record<number, Tier> = {
  1: { base: '#c88f5e', hi: '#efc59a', lo: '#8a5a30', gem: '#e6b98a', numFill: '#fff4e6', numLine: '#8a5a30', ribbon: '#c88f5e', ribbonHi: '#e7b98c', ribbonInk: '#5a3618', studs: 6, gems: false, laurel: false, glow: false, sparkles: false, crown: false, jewels: false },
  2: { base: '#c07b45', hi: '#e9b483', lo: '#7c4a22', gem: '#f0c79a', numFill: '#fff1df', numLine: '#7c4a22', ribbon: '#c07b45', ribbonHi: '#e4a877', ribbonInk: '#4f2f14', studs: 8, gems: false, laurel: false, glow: false, sparkles: false, crown: false, jewels: false },
  3: { base: '#cf9f2f', hi: '#f6dd83', lo: '#8a661a', gem: '#ffe9a6', numFill: '#fff6d6', numLine: '#8a661a', ribbon: '#d8a72f', ribbonHi: '#f0d074', ribbonInk: '#5a410c', studs: 10, gems: false, laurel: false, glow: false, sparkles: false, crown: false, jewels: false },
  4: { base: '#b9c4cf', hi: '#ffffff', lo: '#7d8894', gem: '#eaf1f7', numFill: '#ffffff', numLine: '#6b7784', ribbon: '#9fb0bf', ribbonHi: '#d6e2ec', ribbonInk: '#33404b', studs: 12, gems: false, laurel: false, glow: false, sparkles: false, crown: false, jewels: false },
  5: { base: '#e9b62f', hi: '#fff0ac', lo: '#a37c12', gem: '#7fe0ff', numFill: '#fff7cf', numLine: '#9a6f0a', ribbon: '#e6a92a', ribbonHi: '#f7d871', ribbonInk: '#5a410c', studs: 12, gems: true, laurel: false, glow: false, sparkles: false, crown: false, jewels: false },
  6: { base: '#37b98a', hi: '#a9f0d6', lo: '#1c7a58', gem: '#ffe08a', numFill: '#eafff6', numLine: '#1c7a58', ribbon: '#2fae80', ribbonHi: '#82e2bf', ribbonInk: '#0f4a35', studs: 14, gems: true, laurel: true, glow: false, sparkles: false, crown: false, jewels: false },
  7: { base: '#4f8fe6', hi: '#bcd8ff', lo: '#2a5aa0', gem: '#ffd24a', numFill: '#eef6ff', numLine: '#2a5aa0', ribbon: '#3f7fd6', ribbonHi: '#8fb9f0', ribbonInk: '#153a6b', studs: 14, gems: true, laurel: true, glow: true, sparkles: false, crown: false, jewels: false },
  8: { base: '#e0485f', hi: '#ffb3bf', lo: '#9c2438', gem: '#ffd24a', numFill: '#fff0f2', numLine: '#9c2438', ribbon: '#d63f57', ribbonHi: '#f08c9a', ribbonInk: '#6b0f1e', studs: 16, gems: true, laurel: true, glow: true, sparkles: true, crown: false, jewels: false },
  9: { base: '#9a5fe0', hi: '#d8bcff', lo: '#5f2ea0', gem: '#ffd24a', numFill: '#f6efff', numLine: '#5f2ea0', ribbon: '#8a4fd6', ribbonHi: '#c0a0f0', ribbonInk: '#3a1a6b', studs: 18, gems: true, laurel: true, glow: true, sparkles: true, crown: true, jewels: true },
  10: { base: '#ffcf3a', hi: '#fff2b6', lo: '#c08a12', gem: '#ff5fae', numFill: '#fff7d6', numLine: '#b06a10', ribbon: '#f2b52a', ribbonHi: '#ffe08a', ribbonInk: '#7a4a08', studs: 20, gems: true, laurel: true, glow: true, sparkles: true, crown: true, jewels: true },
};

const GEM_COLORS = ['#ff5f7a', '#5aa6ff', '#43d6a0', '#ffd24a', '#b06bff', '#ff9f43'];
// 顔は箱いっぱい（＝フレーム無しと同じ大きさ）に描き、リング/装飾はその外側に
// はみ出す（SVGを箱より一回り大きくして overflow で外へ）。SPILL はみ出し量。
const CX = 60;
const CY = 60;
const R = 47; // 顔の縁のすぐ外にくるリング半径（viewBox 120・顔の縁≈45.5）
const SPILL = 0.16; // 箱に対して各辺 16% はみ出す（SVGは 132% サイズ）

function tierOf(level: number): Tier {
  return TIERS[Math.max(1, Math.min(10, level))];
}
// 極座標→点（度、y下向き。90°=真下）。
function pt(angleDeg: number, r: number): [number, number] {
  const a = (angleDeg * Math.PI) / 180;
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}
// 円弧パス（start→end、時計回りに下側を通す）。
function arcPath(a0: number, a1: number, r: number): string {
  const [x0, y0] = pt(a0, r);
  const [x1, y1] = pt(a1, r);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 0 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

// 数字の形に沿った縁取りテキスト（丸枠に入れない）。
function ShapedNumber({ n, x, y, size, fill, line, lineW, italic = true, anchor = 'middle' as 'start' | 'middle' | 'end' }: { n: number; x: number; y: number; size: number; fill: string; line: string; lineW: number; italic?: boolean; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      dominantBaseline="central"
      fontSize={size}
      fontWeight={900}
      fontStyle={italic ? 'italic' : 'normal'}
      fontFamily="'Arial Black', 'Arial', 'Hiragino Sans', sans-serif"
      fill={fill}
      stroke={line}
      strokeWidth={lineW}
      strokeLinejoin="round"
      paintOrder="stroke"
      style={{ letterSpacing: '-1px' }}
    >
      {n}
    </text>
  );
}

export default function StreakFrame({ level, look, size = 104, variant = 'emblem' }: { level: number; look: HorseLook; size?: number; variant?: StreakVariant }) {
  const uid = useId().replace(/:/g, '');
  const t = tierOf(level);
  const off = `${-SPILL * 100}%`;
  const span = `${(1 + SPILL * 2) * 100}%`;
  // 主リングの太さ。Lv が上がるほど少しずつ厚くなる（Lv1 6.2 … Lv10 8.2）。
  const ringW = 6 + level * 0.22;
  const RING_OUT = R + 5; // いちばん外の縁取り
  const RING_IN = R - 3.9; // 顔との境

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      {/* 馬の顔＝箱いっぱい（フレーム無しと同じ大きさ） */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }} aria-hidden>
        <HorseFace horse={look} size={size} />
      </div>

      {/* リング/装飾は箱より一回り大きいSVGで、顔の外側にはみ出して描く */}
      <svg viewBox="0 0 120 120" style={{ position: 'absolute', left: off, top: off, width: span, height: span, pointerEvents: 'none', overflow: 'visible' }} aria-hidden>
        <defs>
          <radialGradient id={`ring-${uid}`} cx="50%" cy="36%" r="70%">
            <stop offset="0%" stopColor={t.hi} />
            <stop offset="52%" stopColor={t.base} />
            <stop offset="100%" stopColor={t.lo} />
          </radialGradient>
          <linearGradient id={`rib-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={t.ribbonHi} />
            <stop offset="100%" stopColor={t.ribbon} />
          </linearGradient>
          <radialGradient id={`glow-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="62%" stopColor={t.hi} stopOpacity="0" />
            <stop offset="88%" stopColor={t.hi} stopOpacity="0.55" />
            <stop offset="100%" stopColor={t.hi} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 外周オーラ（リングが太くなったぶん外へ。リングの下に隠れないように） */}
        {t.glow && <circle cx={CX} cy={CY} r={R + 9} fill={`url(#glow-${uid})`} />}

        {/* リング本体。
            以前は主リングが Lv1 で太さ3.5しかなく、殿堂フレーム（主リング7.5＋
            前後の層で帯の幅12.5）と並ぶと線のように細く見えていた。殿堂と同じ
            「暗い縁取り→面→主リング→ハイライト→内側の締め」の重ね方にして、
            帯の幅を 7 → 10.6 に。殿堂の 12.5 は超えないので、格の上下は保たれる。 */}
        <circle cx={CX} cy={CY} r={RING_OUT} fill="none" stroke={t.lo} strokeWidth="1.8" />
        <circle cx={CX} cy={CY} r={R + 3} fill="none" stroke={t.lo} strokeWidth="3.2" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={`url(#ring-${uid})`} strokeWidth={ringW} />
        <circle cx={CX} cy={CY} r={R + 2} fill="none" stroke={t.hi} strokeOpacity="0.7" strokeWidth="1.1" />
        <circle cx={CX} cy={CY} r={R - 2.6} fill="none" stroke={t.hi} strokeOpacity="0.55" strokeWidth="0.9" />
        {/* 顔との境。ここで締めないと、太いリングが顔ににじんで見える */}
        <circle cx={CX} cy={CY} r={RING_IN} fill="none" stroke={t.lo} strokeWidth="1.6" />

        {/* 左右の月桂樹。リングを太くしたら完全に隠れてしまったので、リングの「上」に
            描いて外周に沿わせる（順番を入れ替えただけで、意匠は元のまま）。 */}
        {t.laurel && [-1, 1].map((s) => (
          <g key={s} transform={`translate(${CX + s * (R + 2.6)}, ${CY}) scale(${s}, 1)`}>
            {Array.from({ length: 5 }).map((_, i) => {
              const yy = 11 - i * 5.4;
              const xx = -1.2 - i * 1.2;
              return <ellipse key={i} cx={xx} cy={yy} rx="3.6" ry="2" fill={t.hi} stroke={t.lo} strokeWidth="0.6" transform={`rotate(${-50 - i * 5} ${xx} ${yy})`} />;
            })}
          </g>
        ))}

        {/* スタッド（リングが太くなったぶん粒も大きく。埋もれて見えなくなるため） */}
        {t.studs > 0 && Array.from({ length: t.studs }).map((_, i) => {
          const [x, y] = pt((i / t.studs) * 360 - 90, R);
          const big = i % 3 === 0;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={big ? 2.4 : 1.5} fill={t.gem} stroke={t.lo} strokeWidth="0.55" />
              {big && <circle cx={x - 0.7} cy={y - 0.7} r={0.7} fill="#fff" opacity="0.7" />}
            </g>
          );
        })}

        {/* 四方の宝石。台座（ベゼル）を足して、厚いリングの上でも浮き上がらせる */}
        {t.gems && [0, 1, 2, 3].map((i) => {
          const [x, y] = pt(i * 90 - 90, R);
          const col = GEM_COLORS[i % GEM_COLORS.length];
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={5.1} fill={`url(#ring-${uid})`} stroke={t.lo} strokeWidth="0.8" />
              <circle cx={x} cy={y} r={3.5} fill={col} stroke={t.lo} strokeWidth="0.8" />
              <circle cx={x - 1} cy={y - 1} r={1} fill="#fff" opacity="0.85" />
            </g>
          );
        })}

        {/* 下部の星／クリスタル（最上位・旧放射光の置き換え）。
            以前は真下（90°）にも置いていたが、リングを太くして数字を少し外へ出したら
            ちょうど「N WINS」と重なったので、左右に振り分けて数字の居場所を空ける。 */}
        {t.jewels && [152, 136, 44, 28].map((ang, i) => {
          const [x, y] = pt(ang, R + 1.2);
          const mid = i === 1 || i === 2;
          const col = mid ? '#ffd24a' : GEM_COLORS[i % GEM_COLORS.length];
          return <Star key={i} x={x} y={y} r={mid ? 3.6 : 2.7} fill={col} line={t.lo} />;
        })}

        {/* きらめき */}
        {t.sparkles && [[CX - R * 0.75, CY - R * 0.6], [CX + R * 0.78, CY - R * 0.45]].map(([x, y], i) => (
          <path key={i} d="M0 -3.2 L0.7 -0.7 L3.2 0 L0.7 0.7 L0 3.2 L-0.7 0.7 L-3.2 0 L-0.7 -0.7 Z" fill="#fff" transform={`translate(${x} ${y})`} opacity="0.95" />
        ))}

        {/* 王冠（上部中央）。厚いリングに乗り上げないよう少し外へ＋一回り大きく */}
        {t.crown && (
          <g transform={`translate(${CX} ${CY - R - 6.5})`}>
            <path d="M-9 3.4 L-9 -4 L-4.5 0 L0 -6.3 L4.5 0 L9 -4 L9 3.4 Z" fill={`url(#ring-${uid})`} stroke={t.lo} strokeWidth="0.8" strokeLinejoin="round" />
            {[-5.6, 0, 5.6].map((x, i) => <circle key={i} cx={x} cy={-4.6 + (i === 1 ? -1.5 : 0)} r="1.45" fill={GEM_COLORS[i % GEM_COLORS.length]} stroke={t.lo} strokeWidth="0.4" />)}
          </g>
        )}

        {/* ===== 数字の配置パターン ===== */}
        {variant === 'corner' && <CornerNumber t={t} level={level} uid={uid} />}
        {variant === 'ribbon' && <RibbonNumber t={t} level={level} uid={uid} />}
        {variant === 'emblem' && <EmblemNumber t={t} level={level} ringW={ringW} />}
      </svg>
    </div>
  );
}

function Star({ x, y, r, fill, line }: { x: number; y: number; r: number; fill: string; line: string }) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr).toFixed(2)}`;
  }).join(' ');
  return <polygon points={pts} fill={fill} stroke={line} strokeWidth="0.5" strokeLinejoin="round" />;
}

// 小さな「WINS」チップ（画像の "YR"/"ANNIVERSARY" 風）。
function WinsChip({ x, y, w, h, fill, ink, line, label = 'WINS' }: { x: number; y: number; w: number; h: number; fill: string; ink: string; line: string; label?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h / 2} fill={fill} stroke={line} strokeWidth="0.7" />
      <text x={x + w / 2} y={y + h / 2 + 0.2} textAnchor="middle" dominantBaseline="central" fontSize={h * 0.66} fontWeight="900" fill={ink} fontFamily="'Arial Black','Arial',sans-serif" style={{ letterSpacing: '0.3px' }}>{label}</text>
    </g>
  );
}

// パターン①：数字を左上コーナーに（PPPoker "4YR" 風）＋下部に「WIN STREAK」リボン。
function CornerNumber({ t, level, uid }: { t: Tier; level: number; uid: string }) {
  const two = level >= 10;
  return (
    <g>
      {/* 下部リボン（弧に沿う帯） */}
      <path d={arcPath(140, 40, R + 2)} fill="none" stroke={t.lo} strokeOpacity="0.4" strokeWidth="10" strokeLinecap="round" />
      <path d={arcPath(140, 40, R + 2)} fill="none" stroke={`url(#rib-${uid})`} strokeWidth="9" strokeLinecap="round" />
      <path id={`rp-${uid}`} d={arcPath(136, 44, R + 0.6)} fill="none" />
      <text fontSize="6.4" fontWeight="900" fill={t.ribbonInk} fontFamily="'Arial Black','Arial',sans-serif" style={{ letterSpacing: '0.4px' }}>
        <textPath href={`#rp-${uid}`} startOffset="50%" textAnchor="middle">WIN STREAK</textPath>
      </text>

      {/* 左上コーナーの数字（数字形の縁取り） */}
      <g transform={`translate(${two ? 24 : 27} 22)`}>
        <ShapedNumber n={level} x={0} y={0} size={26} fill={t.numFill} line={t.numLine} lineW={3.4} />
        <WinsChip x={two ? 15 : 12} y={-10} w={16} h={8} fill={t.ribbon} ink={t.numFill} line={t.numLine} />
      </g>
    </g>
  );
}

// パターン②：下部リボンに「N WINS」（数字を帯に大きく載せる）。上部バッジなし。
function RibbonNumber({ t, level, uid }: { t: Tier; level: number; uid: string }) {
  return (
    <g>
      <path d={arcPath(146, 34, R + 2)} fill="none" stroke={`url(#rib-${uid})`} strokeWidth="13" strokeLinecap="round" />
      <path d={arcPath(146, 34, R + 2)} fill="none" stroke={t.ribbonHi} strokeWidth="1" strokeLinecap="round" opacity="0.6" transform="translate(0 -3.8)" />
      {/* 数字（大）＋WINS を帯の中央下に */}
      <g transform={`translate(${CX} ${CY + R + 4})`}>
        <ShapedNumber n={level} x={-4} y={0} size={17} fill={t.numFill} line={t.numLine} lineW={2.2} anchor="middle" />
        <text x={level >= 10 ? 10 : 8} y={0.5} textAnchor="start" dominantBaseline="central" fontSize="7.2" fontWeight="900" fill={t.ribbonInk} fontFamily="'Arial Black','Arial',sans-serif" style={{ letterSpacing: '0.4px' }}>WINS</text>
      </g>
    </g>
  );
}

// パターン③：下中央に大きな数字（縁取りのみ）＋右下に小さな「WINS」タグ、星を添える。
// 「N WINS」を一つの塊として見せ、リングの下端にポップさせる。
function EmblemNumber({ t, level, ringW }: { t: Tier; level: number; ringW: number }) {
  const two = level >= 10;
  const numSize = 19;
  const numX = two ? -5 : -3; // 数字中心（WINS 側に少し寄せて全体を中央寄せ）
  const winsX = two ? 10 : 7;
  return (
    <g>
      {/* 数字の下だけリングをわずかに沈ませる。太いリングの明るい地色（例：Lv5 は金）に
          クリーム色の数字が乗ると読みづらいため。切れ目に見えないよう薄めに。 */}
      <path
        d={arcPath(two ? 122 : 115, two ? 58 : 65, R + 0.6)}
        fill="none"
        stroke={t.lo}
        strokeOpacity="0.3"
        strokeWidth={ringW * 0.8}
        strokeLinecap="round"
      />
      {/* リングの下端に載せる（箱の下へはみ出しすぎると各画面で下の文字と被るため、
          枠の内側〜縁に収める）。 */}
      <g transform={`translate(${CX} ${CY + R - 3})`}>
        {/* 高Lv：数字の左右に星を添える */}
        {level >= 6 && [-1, 1].map((s) => (
          <Star key={s} x={s * (two ? 23 : 19)} y={1} r={level >= 9 ? 2.8 : 2.3} fill={t.gem} line={t.numLine} />
        ))}
        {/* ドロップシャドウで浮き上がらせる */}
        <ShapedNumber n={level} x={numX} y={2} size={numSize} fill="rgba(40,24,6,0.35)" line="rgba(40,24,6,0.35)" lineW={3.4} anchor="middle" />
        {/* 本体（数字の形に沿った縁取り） */}
        <ShapedNumber n={level} x={numX} y={0} size={numSize} fill={t.numFill} line={t.numLine} lineW={3.4} anchor="middle" />
        {/* WINS タグ（anniversary 風・イタリック・縁取りで視認性確保） */}
        <text x={winsX} y={4.5} textAnchor="start" dominantBaseline="central" fontSize="6.6" fontWeight="900" fontStyle="italic" fill={t.numFill} stroke={t.numLine} strokeWidth="1" paintOrder="stroke" strokeLinejoin="round" fontFamily="'Arial Black','Arial',sans-serif" style={{ letterSpacing: '0.2px' }}>WINS</text>
      </g>
    </g>
  );
}
