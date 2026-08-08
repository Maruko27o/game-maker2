import { useId } from 'react';
import type { AptGrade, HorseLook } from '../types';
import HorseFace from './HorseFace';
import { Facets, MetalSheen, GemFlash } from './FrameFx';
import { usePrefersReducedMotion } from '../hooks';

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
  // ── 動きの積み上げ（FrameFx）。等級が上がるほど濃くなる。 ──
  // 動きはぜんぶリングの上。周りを飛ぶ粒や、回る細い弧は使わない。
  /** カット面の数。多いほど面が細かい＝上等な石に見える。 */
  facets: number;
  /** 金属の光沢が1周する秒数。短いほど磨き込まれて見える。 */
  sheenDurSec: number;
  /** きらりと光る石の数（0 なら無し）。 */
  gemFlash: number;
};

const TIERS: Record<AptGrade, Tier> = {
  C: {
    base: '#b97742', hi: '#e7b184', lo: '#7c4a20', ink: '#5b3a1c',
    plate: '#d9a273', plateHi: '#f2cba6',
    studs: 8, laurel: false, gems: false, glow: false, sparkles: false, rainbow: false,
    facets: 10, sheenDurSec: 5.2, gemFlash: 0,
  },
  B: {
    base: '#b9c4cf', hi: '#f4f8fb', lo: '#77828e', ink: '#3f4650',
    plate: '#dfe6ed', plateHi: '#ffffff',
    studs: 12, laurel: true, gems: false, glow: false, sparkles: false, rainbow: false,
    facets: 12, sheenDurSec: 4.4, gemFlash: 4,
  },
  A: {
    base: '#e9b93c', hi: '#fff0b8', lo: '#a2760f', ink: '#5a3f00',
    plate: '#ffe9a8', plateHi: '#fff8dc',
    studs: 16, laurel: true, gems: true, glow: true, sparkles: false, rainbow: false,
    facets: 14, sheenDurSec: 3.6, gemFlash: 6,
  },
  S: {
    base: '#c4a2ff', hi: '#ffffff', lo: '#7b5fc0', ink: '#3a2c1c',
    plate: '#ffd59a', plateHi: '#fdff9a',
    studs: 20, laurel: true, gems: true, glow: true, sparkles: true, rainbow: true,
    facets: 16, sheenDurSec: 2.8, gemFlash: 10,
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
  // 動きを減らす設定のときは、形はそのままで動かさない。
  const still = usePrefersReducedMotion();
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

        {/* 外周のオーラ（A 以上）。**動かさない**。枠の外で何かが動くと、枠と関係の
            ない別物が乗っているように見えて安っぽくなるため。 */}
        {t.glow && <circle cx={C} cy={C} r={57} fill={`url(#aglow-${uid})`} opacity="0.7" />}

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
        {/* S の虹は色そのものを回す。止まった虹より「特別」に見える。 */}
        {t.rainbow && (
          <circle cx={C} cy={C} r={R} fill="none" stroke={`url(#abow-${uid})`} strokeWidth={ringW} opacity="0.85">
            <animateTransform
              attributeName="transform"
              type="rotate"
              from={`0 ${C} ${C}`}
              to={`360 ${C} ${C}`}
              dur="11s"
              repeatCount="indefinite"
            />
          </circle>
        )}
        <circle cx={C} cy={C} r={R + ringW / 2} fill="none" stroke={t.lo} strokeOpacity="0.7" strokeWidth="1.2" />
        <circle cx={C} cy={C} r={R - ringW / 2} fill="none" stroke={t.lo} strokeOpacity="0.5" strokeWidth="1.2" />

        {/* カット面のきらめき。光源が一周しながら面を順に立ち上げる（全等級）。 */}
        <Facets c={C} r={R} w={ringW} uid={uid} count={t.facets} color={t.hi} dur={t.sheenDurSec * 1.5} still={still} />

        {/* 金属の光沢。帯そのものを斜めの光が横切る（細い弧は回さない）。 */}
        <MetalSheen c={C} r={R} w={ringW} uid={uid} dur={t.sheenDurSec} strength={0.7} still={still} />

        {/* 鋲。等級が上がるほど密になる。 */}
        {studs.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.15} fill={t.hi} opacity="0.95" />
        ))}

        {/* きらりと光る石。等級が上がるほど数が増える（B から）。 */}
        {t.gemFlash > 0 && (
          <GemFlash c={C} r={R} uid={uid} count={t.gemFlash} color={t.hi} size={3.6} dur={t.sheenDurSec * 0.9} still={still} />
        )}

        {/* 四方の宝石（A 以上）。こちらは形。光るのは上の GemFlash が受け持つ。 */}
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
                >
                  {/* 4つが順にまたたく（同時だと点滅に見える） */}
                  <animate
                    attributeName="opacity"
                    values="0.6;1;0.6"
                    dur="2.4s"
                    begin={`${(deg / 360) * 2.4}s`}
                    repeatCount="indefinite"
                  />
                </path>
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
            >
              <animate attributeName="opacity" values="0.15;1;0.15" dur="2.4s" begin={`${i * 0.5}s`} repeatCount="indefinite" />
            </path>
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
