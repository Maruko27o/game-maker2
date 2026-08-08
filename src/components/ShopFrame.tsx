import { useId } from 'react';
import type { HorseLook } from '../types';
import type { AnimalId } from '../data/shop';
import { ANIMALS } from '../data/shop';
import HorseFace from './HorseFace';
import AnimalFace, { ANIMAL_TONE } from './AnimalFace';
import { Facets, MetalSheen } from './FrameFx';
import { usePrefersReducedMotion } from '../hooks';

// ショップで買える動物フレーム。
//
//  ・動物フレーム（10種）… その動物の色のリング＋肉球の鋲。下の銘板に動物の顔。
//  ・コンプリートフレーム … 10種そろえた人だけ。10色の帯が反時計回りに回り、
//                           その上をウマの足跡が時計回りに駆けていく。
//                           飾る動物は10種からいつでも選び直せる。
//
// 座標系・リング半径・帯の太さは他のフレーム（連勝／適性／ボックス）とそろえる。
// 動きはリングの上か内側だけ ── リングの外を別のものが飛ぶ表現はしない。
//
// 格の順番を崩さないこと：週末ボックスの限定フレーム（0.1%）が最上位で、
// ショップ品はコインで必ず手に入るので、その下に収まるようにしてある。
// （面の数・光沢の速さ・光る石の数を、ボックス限定より控えめにしている）

const R = 47;
const SPILL = 0.16;
const C = 60;

export default function ShopFrame({
  animal,
  master,
  look,
  size = 104,
}: {
  animal: AnimalId;
  /** コンプリートフレームとして描く。 */
  master?: boolean;
  look: HorseLook;
  size?: number;
}) {
  const uid = useId().replace(/:/g, '');
  const off = `${-SPILL * 100}%`;
  const span = `${(1 + SPILL * 2) * 100}%`;
  const still = usePrefersReducedMotion();
  const t = ANIMAL_TONE[animal];
  const ringW = master ? 8.0 : 7.2;

  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' }} aria-hidden>
        <HorseFace horse={look} size={size} />
      </div>

      <svg
        viewBox="0 0 120 120"
        style={{ position: 'absolute', left: off, top: off, width: span, height: span, pointerEvents: 'none', overflow: 'visible' }}
        aria-label={master ? 'コンプリートフレーム' : '動物フレーム'}
      >
        <defs>{master ? <MasterDefs uid={uid} /> : <AnimalDefs uid={uid} tone={t} />}</defs>

        <circle cx={C} cy={C} r={57} fill={`url(#sglow-${uid})`} />

        {master ? <MasterRing w={ringW} /> : <AnimalRing uid={uid} tone={t} w={ringW} />}

        {/* コンプリートは「色の帯＋歩く肉球」で見せるので、カット面は入れない
            （帯の色が10色あるところに面のきらめきを重ねると、ただ騒がしくなる）。 */}
        {!master && (
          <Facets c={C} r={R} w={ringW} uid={`s${uid}`} count={10} color="#fff" dur={4.2} peak={0.7} still={still} />
        )}
        <MetalSheen
          c={C}
          r={R}
          w={ringW}
          uid={`s${uid}`}
          dur={master ? 3.6 : 4.6}
          strength={master ? 0.65 : 0.6}
          still={still}
        />

        {master ? (
          <>
            <PawWalk w={ringW} still={still} />
            <PawBloom />
          </>
        ) : (
          <PawStuds tone={t} />
        )}

        {/* 下の銘板：どの動物かをここで示す。
            コンプリートは10色の帯が主役なので、銘板は soft（生成り＋金のふち・
            彩度おさえめ）にして帯になじませる。動物は選び直せるまま。 */}
        <g transform={`translate(${C} 104)`}>
          <AnimalFace id={animal} uid={`sf${uid}`} r={13} soft={master} />
        </g>
      </svg>
    </div>
  );
}

// ── 動物フレーム（10種） ─────────────────────────────────────
function AnimalDefs({ uid, tone }: { uid: string; tone: (typeof ANIMAL_TONE)[AnimalId] }) {
  return (
    <>
      <radialGradient id={`sring-${uid}`} cx="50%" cy="32%" r="74%">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="38%" stopColor={tone.bg} />
        <stop offset="100%" stopColor={tone.deep} />
      </radialGradient>
      <radialGradient id={`sglow-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="60%" stopColor={tone.bg} stopOpacity="0" />
        <stop offset="86%" stopColor={tone.bg} stopOpacity="0.55" />
        <stop offset="100%" stopColor={tone.bg} stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`ssheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

function AnimalRing({ uid, tone, w }: { uid: string; tone: (typeof ANIMAL_TONE)[AnimalId]; w: number }) {
  return (
    <>
      <circle cx={C} cy={C} r={R} fill="none" stroke={`url(#sring-${uid})`} strokeWidth={w} />
      <circle cx={C} cy={C} r={R + w / 2} fill="none" stroke={tone.edge} strokeOpacity="0.85" strokeWidth="1.2" />
      <circle cx={C} cy={C} r={R - w / 2} fill="none" stroke={tone.edge} strokeOpacity="0.6" strokeWidth="1.2" />
    </>
  );
}

/** リングに埋めた肉球の鋲。動かさない（回すと安っぽくなる）。 */
function PawStuds({ tone }: { tone: (typeof ANIMAL_TONE)[AnimalId] }) {
  return (
    <g opacity="0.9">
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return (
          <g key={i} transform={`translate(${C + Math.cos(a) * R} ${C + Math.sin(a) * R}) scale(0.2)`} fill={tone.face}>
            <ellipse cx={0} cy={4} rx={9} ry={7.5} />
            <circle cx={-8.5} cy={-6} r={3.6} />
            <circle cx={-3} cy={-10} r={3.6} />
            <circle cx={3} cy={-10} r={3.6} />
            <circle cx={8.5} cy={-6} r={3.6} />
          </g>
        );
      })}
    </g>
  );
}

// ── コンプリートフレーム ─────────────────────────────────────
//
// 「10種そろえた」ことが、色そのもので分かる見た目にする。
//
//  ・リング … 10種の色を**10等分**して並べ、境目をなめらかにつないだ帯。
//             帯ごと **反時計回り** にゆっくり回る。色は白を混ぜて澄ませる
//             （そのままの濃さで10色ならべると、にごって汚く見える）。
//  ・足跡   … 帯の上を **時計回り** に、4本ぶんを1組にして駆けていく。
//             「いろんな色の道を走っている」ように見せるのがねらい。
//             ウマなので肉球ではなく蹄のあと（イヌに見えてしまうため）。
//  ・頂点   … 王冠ではなく、蹄のあとを芯にした小さなお花。かわいさを優先する。
//
// 動きはすべてリングの上か内側に置く（外を別のものが飛ぶ表現はしない）。

/** リングが一周する時間（反時計回り）。ゆっくり。 */
const RING_SPIN = '26s';
/** 足跡が一周する時間（時計回り）。**歩きではなく走り**なので速め。 */
const HOOF_RUN = '5.5s';
/** 色の帯を作る細片の数。10種 × 12 で、境目が見えないなめらかさになる。 */
const SLICES_PER_ANIMAL = 12;
const SLICES = ANIMALS.length * SLICES_PER_ANIMAL;

function hex2rgb(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function rgb2hex(c: [number, number, number]): string {
  return `#${c.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')}`;
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex2rgb(a);
  const [br, bg, bb] = hex2rgb(b);
  return rgb2hex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
}
/**
 * 澄んだ色にする。
 *
 * 動物の bg はもともと薄い色なので、そこへ白を足すとほとんど白になり、
 * 10色ならべても「ただの白い輪」にしか見えなかった。**濃い色（deep）を半分
 * 混ぜて色をはっきりさせてから、白を少しだけ足して澄ませる**。
 */
const clear = (a: AnimalId) => mix(mix(ANIMAL_TONE[a].bg, ANIMAL_TONE[a].deep, 0.55), '#ffffff', 0.12);

/** 10種の色を10等分して、境目をなめらかにつないだ色の並び。 */
const RING_SLICES: string[] = Array.from({ length: SLICES }, (_, i) => {
  const seg = Math.floor(i / SLICES_PER_ANIMAL);
  const t = (i % SLICES_PER_ANIMAL) / SLICES_PER_ANIMAL;
  return mix(clear(ANIMALS[seg]), clear(ANIMALS[(seg + 1) % ANIMALS.length]), t);
});

function MasterDefs({ uid }: { uid: string }) {
  return (
    <>
      {/* 外側のほんのりした光。色は帯が持つので、ここは淡い白でそろえる。 */}
      <radialGradient id={`sglow-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="58%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="85%" stopColor="#fff6e2" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`ssheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

function MasterRing({ w }: { w: number }) {
  const circ = 2 * Math.PI * R;
  // 細片1枚の長さ。となりと少し重ねて、継ぎ目の線が出ないようにする。
  const seg = circ / SLICES;
  return (
    <>
      <circle cx={C} cy={C} r={R + w / 2 + 3} fill="none" stroke="#ffe9a8" strokeOpacity="0.7" strokeWidth="1.4" />
      {/* 色の帯。ぜんぶまとめて反時計回りに回す。 */}
      <g>
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${C} ${C}`}
          to={`-360 ${C} ${C}`}
          dur={RING_SPIN}
          repeatCount="indefinite"
        />
        {RING_SLICES.map((color, i) => (
          <circle
            key={i}
            cx={C}
            cy={C}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={w}
            strokeDasharray={`${seg * 1.35} ${circ}`}
            strokeDashoffset={-seg * i}
            // 0時から始めて時計回りに並ぶよう、-90度から描く。
            transform={`rotate(-90 ${C} ${C})`}
          />
        ))}
      </g>
      {/* 内外のふち。色は帯にまかせて、ここは白でまとめる。 */}
      <circle cx={C} cy={C} r={R + w / 2} fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.3" />
      <circle cx={C} cy={C} r={R - w / 2} fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1.3" />
    </>
  );
}

/**
 * ウマの足跡（蹄のあと）。**つま先が上（-y）** を向く。
 *
 * 肉球だとイヌの足あとに見えてしまうので、うしろが開いた U 字にする。
 * 太い線の丸い端がそのまま蹄の跡になるので、塗りではなく線で描くのがいちばん
 * 素直で、小さくしても形がくずれない。
 */
// 塗りつぶしの U 字。**先（上）に切れ込み**が入り、うしろ（下）はまるく広い。
// 中を抜いた輪っかではなく、地面に押された跡そのものを塗りで描く。
const HOOF_PATH = `
  M 0,-2
  C 1.2,-6 2.5,-9 4.5,-11.5
  C 7,-13.6 10.1,-11 10.9,-6
  C 11.7,-1 11,5 8,9.5
  C 5.5,13 2.5,13.6 0,13.6
  C -2.5,13.6 -5.5,13 -8,9.5
  C -11,5 -11.7,-1 -10.9,-6
  C -10.1,-11 -7,-13.6 -4.5,-11.5
  C -2.5,-9 -1.2,-6 0,-2 Z
`;

function HoofMark({ color, outline }: { color: string; outline?: string }) {
  // 帯は淡い色なので、白い足跡だけだと沈む。濃いふちを付けて形を立てる。
  return (
    <path
      d={HOOF_PATH}
      fill={color}
      stroke={outline}
      strokeWidth={outline ? 3.2 : 0}
      strokeLinejoin="round"
      paintOrder="stroke"
    />
  );
}

/**
 * 帯の上を走るウマの足跡。時計回りに、**4本ぶんを1組**にして駆けていく。
 *
 * ウマは四足なので、1歩＝4つの跡が残る。後肢2つ→前肢2つの順に、左右へ振り
 * ながら着く（駈歩の足どり）。組と組のあいだを大きく空けると「ひと跳びぶん」に
 * 見えて、歩いているのではなく走っているように読める。
 *
 * ・組の中の並び … 進行方向へ 0°→6°→14°→20°、左右は外→内→外→内
 * ・光り方       … 後肢から前肢へ順に濃くなる（着地の順）
 * ・速さ         … 一周 5.5秒。歩きではなく走りの速さ。
 */
const STRIDE = [0, 6, 14, 20]; // 1組の中の進行方向のずれ（度）
const STRIDE_GROUPS = [0, 180]; // 組を置く位置（度）。離して「ひと跳び」を作る

function PawWalk({ w, still }: { w: number; still?: boolean }) {
  return (
    <g>
      {!still && (
        <animateTransform
          attributeName="transform"
          type="rotate"
          from={`0 ${C} ${C}`}
          to={`360 ${C} ${C}`}
          dur={HOOF_RUN}
          repeatCount="indefinite"
        />
      )}
      {STRIDE_GROUPS.map((base) =>
        STRIDE.map((d, i) => {
          const deg = -90 + base + d;
          const a = (deg * Math.PI) / 180;
          // 左右交互。帯の幅の中に収める。
          const off = (i % 2 === 0 ? 1 : -1) * (w * 0.2);
          const rr = R + off;
          const x = C + Math.cos(a) * rr;
          const y = C + Math.sin(a) * rr;
          // 足跡の絵は「つま先が上（-y＝-90度）」を向いている。時計回りに進むときの
          // 進行方向は接線＝deg+90 なので、-90 + θ = deg + 90 → θ = deg + 180。
          // ここを deg+90 にすると、進行方向に対して真横を向いてしまう。
          return (
            <g key={`${base}-${i}`} transform={`translate(${x} ${y}) rotate(${deg + 180}) scale(0.19)`} opacity="0.95">
              {/* 後肢から前肢へ、順に着地したように光らせる。 */}
              {!still && (
                <animate
                  attributeName="opacity"
                  values="0.5;1;0.5"
                  dur="1.1s"
                  begin={`${i * 0.13}s`}
                  repeatCount="indefinite"
                />
              )}
              <HoofMark color="#fffdf6" outline="rgba(74,48,24,0.5)" />
            </g>
          );
        }),
      )}
    </g>
  );
}

/**
 * 頂点のかざり。王冠だと「えらい」感じで硬いので、肉球を芯にしたお花にする。
 * 花びらは10種の色から5つ取って、リングと同じ family だと分かるようにする。
 */
function PawBloom() {
  const petals = [0, 1, 2, 3, 4];
  // 10種から等間隔に5つ。花びらもリングと同じ「澄んだ色」でそろえる。
  return (
    <g transform={`translate(${C} 10)`}>
      {petals.map((i) => (
        <ellipse
          key={i}
          cx={0}
          cy={-7.2}
          rx={4.6}
          ry={6.0}
          fill={clear(ANIMALS[i * 2])}
          stroke="#a8783a"
          strokeWidth="1.2"
          transform={`rotate(${i * 72})`}
        />
      ))}
      <circle cx={0} cy={0} r={4.8} fill="#fff6e2" stroke="#a8783a" strokeWidth="1.3" />
      {/* 花の芯はウマの足跡。リングを歩いている足あとと同じ形にそろえる。 */}
      <g transform="translate(0,-0.2) scale(0.2)">
        <HoofMark color="#a8783a" />
      </g>
    </g>
  );
}
