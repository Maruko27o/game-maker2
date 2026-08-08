import { useId } from 'react';
import type { HorseLook } from '../types';
import type { AnimalId } from '../data/shop';
import { ANIMALS } from '../data/shop';
import HorseFace from './HorseFace';
import AnimalFace, { ANIMAL_TONE } from './AnimalFace';
import { Facets, MetalSheen, GemFlash } from './FrameFx';
import { usePrefersReducedMotion } from '../hooks';

// ショップで買える動物フレーム。
//
//  ・動物フレーム（10種）… その動物の色のリング＋肉球の鋲。下の銘板に動物の顔。
//  ・コンプリートフレーム … 10種そろえた人だけ。リングの色が10種ぶんを順に
//                           めぐり、上に王冠が乗る。動物はいつでも選び直せる。
//
// 座標系・リング半径・帯の太さは他のフレーム（連勝／適性／ボックス）とそろえる。
// 動きは FrameFx の3つだけを使う ── リングの外を別のものが飛ぶ表現はしない。
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

        {master ? <MasterRing uid={uid} w={ringW} /> : <AnimalRing uid={uid} tone={t} w={ringW} />}

        <Facets
          c={C}
          r={R}
          w={ringW}
          uid={`s${uid}`}
          count={master ? 16 : 10}
          color="#fff"
          dur={master ? 3.0 : 4.2}
          peak={master ? 0.9 : 0.7}
          still={still}
        />
        <MetalSheen
          c={C}
          r={R}
          w={ringW}
          uid={`s${uid}`}
          dur={master ? 3.2 : 4.6}
          strength={master ? 0.9 : 0.6}
          still={still}
        />
        {master && <GemFlash c={C} r={R} uid={`s${uid}`} count={8} color="#fff6d8" size={3.6} dur={3.0} still={still} />}

        {master ? <Crown /> : <PawStuds tone={t} />}

        {/* 下の銘板：どの動物かをここで示す。称号の左端と同じ絵を使う。 */}
        <g transform={`translate(${C} 104)`}>
          <AnimalFace id={animal} uid={`sf${uid}`} r={13} />
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
// リングの色が10種ぶんをめぐる。「10種そろえた」ことがひと目で分かる見た目。
const CYCLE_DUR = '10s';
const cyc = (v: string[]) => v.join(';');
const ringCycle = (key: 'bg' | 'deep' | 'edge') => cyc([...ANIMALS.map((a) => ANIMAL_TONE[a][key]), ANIMAL_TONE[ANIMALS[0]][key]]);

function MasterDefs({ uid }: { uid: string }) {
  return (
    <>
      <radialGradient id={`sring-${uid}`} cx="50%" cy="30%" r="76%">
        <stop offset="0%" stopColor="#fff" />
        <stop offset="38%">
          <animate attributeName="stop-color" values={ringCycle('bg')} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
        <stop offset="100%">
          <animate attributeName="stop-color" values={ringCycle('deep')} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
      </radialGradient>
      <radialGradient id={`sglow-${uid}`} cx="50%" cy="50%" r="50%">
        <stop offset="58%" stopColor="#fff3cf" stopOpacity="0" />
        <stop offset="85%" stopOpacity="0.7">
          <animate attributeName="stop-color" values={ringCycle('bg')} dur={CYCLE_DUR} repeatCount="indefinite" />
        </stop>
        <stop offset="100%" stopColor="#fff3cf" stopOpacity="0" />
      </radialGradient>
      <linearGradient id={`ssheen-${uid}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity="0" />
        <stop offset="50%" stopColor="#fff" stopOpacity="0.95" />
        <stop offset="100%" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
    </>
  );
}

function MasterRing({ uid, w }: { uid: string; w: number }) {
  return (
    <>
      <circle cx={C} cy={C} r={R + w / 2 + 3} fill="none" stroke="#ffe9a8" strokeOpacity="0.8" strokeWidth="1.4" />
      <circle cx={C} cy={C} r={R} fill="none" stroke={`url(#sring-${uid})`} strokeWidth={w} />
      <circle cx={C} cy={C} r={R + w / 2} fill="none" strokeOpacity="0.85" strokeWidth="1.3" fillOpacity="0">
        <animate attributeName="stroke" values={ringCycle('edge')} dur={CYCLE_DUR} repeatCount="indefinite" />
      </circle>
      <circle cx={C} cy={C} r={R - w / 2} fill="none" strokeOpacity="0.6" strokeWidth="1.3" fillOpacity="0">
        <animate attributeName="stroke" values={ringCycle('edge')} dur={CYCLE_DUR} repeatCount="indefinite" />
      </circle>
      {/* 10個の石＝10種そろえた印。数そのものに意味を持たせる。 */}
      {ANIMALS.map((a, i) => {
        const ang = (i / ANIMALS.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={a}
            cx={C + Math.cos(ang) * R}
            cy={C + Math.sin(ang) * R}
            r={2.5}
            fill={ANIMAL_TONE[a].bg}
            stroke={ANIMAL_TONE[a].edge}
            strokeWidth="0.8"
          />
        );
      })}
    </>
  );
}

function Crown() {
  return (
    <g transform={`translate(${C} 9)`}>
      <path
        d="M -12,6 L -12,-4 L -6,1 L 0,-7 L 6,1 L 12,-4 L 12,6 Z"
        fill="#ffd76a"
        stroke="#a8770e"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx={0} cy={-8.5} r={2} fill="#fff3cf" stroke="#a8770e" strokeWidth="1" />
      <path d="M -12,6 L 12,6" stroke="#a8770e" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}
