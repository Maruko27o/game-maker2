// Top-down race sprite (RACE_V3 §2). Renders horse_top.svg with the horse's
// colours injected, plus the "grounded + alive" motion the spec calls for:
// a cast shadow, sliding legs, a trailing mane, a swishing tail, a corner lean
// and an airborne hop. Drawn in METER coordinates, oriented along the track.
import type React from 'react';
import type { HorseLook } from '../types';
import { colorById } from '../data/parts';

// Sprite body (torso) spans ~114 units of the 300-wide viewBox. We scale so it
// matches the collision diameter (2 * HIT_R = 2.2m) — visual size tracks the
// hitbox without ever feeding back into the simulation (§2.4).
const SCALE = 2.2 / 114; // ≈0.0193 m per sprite unit
const LEG_OFFSET: Record<string, number> = { fl: 0, fr: 0.12, hl: 0.5, hr: 0.62 };

// Static leg geometry from horse_top.svg (body shank + hoof tip), keyed by leg.
const LEG_PATHS: Record<'fl' | 'fr' | 'hl' | 'hr', React.ReactNode> = {
  hl: (
    <>
      <path fill="var(--body)" d="M 92,80 L 112,80 L 112,44 L 92,44 Z" />
      <path fill="var(--hoof)" d="M 92,52 L 112,52 L 112,38 L 92,38 Z" />
    </>
  ),
  hr: (
    <>
      <path fill="var(--body)" d="M 92,120 L 112,120 L 112,156 L 92,156 Z" />
      <path fill="var(--hoof)" d="M 92,148 L 112,148 L 112,162 L 92,162 Z" />
    </>
  ),
  fl: (
    <>
      <path fill="var(--body)" d="M 164,80 L 184,80 L 184,44 L 164,44 Z" />
      <path fill="var(--hoof)" d="M 164,52 L 184,52 L 184,38 L 164,38 Z" />
    </>
  ),
  fr: (
    <>
      <path fill="var(--body)" d="M 164,120 L 184,120 L 184,156 L 164,156 Z" />
      <path fill="var(--hoof)" d="M 164,148 L 184,148 L 184,162 L 164,162 Z" />
    </>
  ),
};

export default function HorseRaceView({
  look,
  x,
  y,
  heading,
  legPhase,
  speed01,
  onCorner,
  jumping,
  zekken,
  isPlayer,
}: {
  look: HorseLook;
  x: number;
  y: number;
  heading: number; // radians, travel direction
  legPhase: number; // 0..1, distance-based
  speed01: number; // 0..1, drives mane trail
  onCorner: boolean;
  jumping: boolean;
  zekken: number;
  isPlayer: boolean;
}) {
  const body = colorById[look.colors.body]?.value ?? '#f6f2ea';
  const mane = colorById[look.colors.mane]?.value ?? '#6b4326';
  const hoof = colorById[look.colors.hoof]?.value ?? '#3a2c1c';

  const deg = (heading * 180) / Math.PI;
  const lean = onCorner ? -5 : 0; // bank toward the inside of the (left-hand) turn
  const lift = jumping ? 1.5 : 0; // screen-space hop
  const grow = jumping ? 1.18 : 1;
  const sway = (jumping ? 3 : speed01 * 6); // mane trails back with speed
  const tailWag = Math.sin(legPhase * Math.PI * 2) * 5;
  const legDx = (id: 'fl' | 'fr' | 'hl' | 'hr') =>
    jumping ? (id[0] === 'f' ? 5 : -5) : Math.sin((legPhase + LEG_OFFSET[id]) * Math.PI * 2) * 6;

  const S = SCALE * grow;
  const zc = zekkenColor(isPlayer);

  return (
    <g>
      {/* ground shadow — shrinks and detaches while airborne */}
      <ellipse cx={x} cy={y} rx={jumping ? 0.9 : 1.25} ry={jumping ? 0.42 : 0.6} fill="rgba(43,33,24,0.22)" />

      <g
        transform={`translate(${x} ${y - lift}) rotate(${deg + lean}) scale(${S}) translate(-150 -100)`}
        style={{ ['--body' as string]: body, ['--mane' as string]: mane, ['--hoof' as string]: hoof }}
      >
        <g stroke="#2b2118" strokeWidth={isPlayer ? 8 : 7} strokeLinejoin="round" strokeLinecap="round">
          {/* tail (behind the body), swishing about its root */}
          <path
            fill="var(--mane)"
            transform={`rotate(${tailWag} 78 100)`}
            d="M 78,86 C 44,72 18,80 6,100 C 18,120 44,128 78,114 C 66,104 66,96 78,86 Z"
          />
          {/* legs slide fore/aft */}
          <g transform={`translate(${legDx('hl')} 0)`}>{LEG_PATHS.hl}</g>
          <g transform={`translate(${legDx('hr')} 0)`}>{LEG_PATHS.hr}</g>
          <g transform={`translate(${legDx('fl')} 0)`}>{LEG_PATHS.fl}</g>
          <g transform={`translate(${legDx('fr')} 0)`}>{LEG_PATHS.fr}</g>
          {/* body + neck */}
          <path fill="var(--body)" d="M 76,100 C 76,64 104,58 136,58 C 172,58 190,70 190,100 C 190,130 172,142 136,142 C 104,142 76,136 76,100 Z" />
          <path fill="var(--body)" d="M 176,80 L 236,88 L 236,112 L 176,120 Z" />
          {/* mane — the primary identity band — trails backward with speed */}
          <g transform={`translate(${-sway} 0)`}>
            <path fill="var(--mane)" d="M 172,88 C 190,84 214,86 238,90 L 238,110 C 214,114 190,116 172,112 Z" />
            <path fill="var(--mane)" d="M 120,86 C 144,80 164,82 178,88 L 178,112 C 164,118 144,120 120,114 C 130,106 130,94 120,86 Z" />
          </g>
          {/* ears + head + muzzle + eyes */}
          <path fill="var(--body)" d="M 240,84 L 248,64 L 256,84 Z" />
          <path fill="var(--body)" d="M 240,116 L 248,136 L 256,116 Z" />
          <path fill="var(--body)" d="M 232,100 C 232,80 246,74 262,76 C 282,78 292,88 292,100 C 292,112 282,122 262,124 C 246,126 232,120 232,100 Z" />
          <ellipse fill="#ffffff" stroke="none" cx="280" cy="100" rx="13" ry="12" />
          <circle fill="#2b2118" stroke="none" cx="252" cy="86" r="5" />
          <circle fill="#2b2118" stroke="none" cx="252" cy="114" r="5" />
        </g>
        {/* keep hoof colour referenced even if unused elsewhere */}
        <rect x="0" y="0" width="0" height="0" fill={hoof} />
      </g>

      {/* zekken (post number) on a small plate above the horse — never on the body */}
      <g transform={`translate(${x} ${y - 2.9})`}>
        <rect x={-1.05} y={-1.05} width={2.1} height={2.1} rx={0.4} fill={zc.bg} stroke={zc.bd} strokeWidth={0.28} />
        <text fontSize={1.6} fill={zc.fg} fontWeight={900} textAnchor="middle" dominantBaseline="central">
          {zekken}
        </text>
      </g>
    </g>
  );
}

function zekkenColor(isPlayer: boolean): { bg: string; bd: string; fg: string } {
  return isPlayer
    ? { bg: '#3f7fd6', bd: '#2b5ea3', fg: '#fff' }
    : { bg: '#f3efe0', bd: '#2b2118', fg: '#2b2118' };
}
