import type { CSSProperties } from 'react';
import type { HorseLook, DecoSlot } from '../types';
import { colorById, decoById } from '../data/parts';
import { LEGS, MIDBODY, NECK, HEAD, HEAD_PIVOT, STROKE } from '../data/horseGeometry';
import type { RunnerState } from '../logic/raceSim';
import HorseDefs from './HorseDefs';

const FRONT: DecoSlot[] = ['back', 'tail', 'head', 'face'];
const TAU = Math.PI * 2;

type Props = {
  horse: HorseLook;
  pos: number; // distance travelled (m) — drives the gait phase
  state: RunnerState;
  size?: number;
  reduced?: boolean;
};

function decoMarkup(horse: HorseLook): string {
  return FRONT.map((s) => (horse.decos[s] ? decoById[horse.decos[s]!]?.svg : ''))
    .filter(Boolean)
    .join('\n');
}

// The horse faces right; running is left-to-right so no flip is needed.
export default function RaceHorse({ horse, pos, state, size = 90, reduced }: Props) {
  const body = colorById[horse.colors.body]?.value ?? '#f6f2ea';
  const mane = colorById[horse.colors.mane]?.value ?? '#6b4326';
  const hoof = colorById[horse.colors.hoof]?.value ?? '#3a2c1c';

  const style = { '--body': body, '--mane': mane, '--hoof': hoof, width: size, height: size } as CSSProperties;

  const stride = state === 'boost' ? 5.2 : state === 'tired' ? 4.5 * 1.4 : 4.5;
  const phase = reduced ? 0 : (((pos / stride) % 1) + 1) % 1;

  const frozen = reduced || state === 'stumble';
  const jumping = state === 'jump';

  const legRot = (offset: number, amp: number, front: boolean) => {
    if (jumping) return front ? -40 : 30; // tuck
    if (frozen) return 0;
    return Math.sin((phase + offset) * TAU) * amp;
  };

  const bodyY = jumping ? -30 : frozen ? 0 : Math.sin(phase * 2 * TAU) * 6;
  const headRot = (reduced ? 0 : Math.sin(phase * TAU) * 4) + (state === 'tired' ? -4 : 0);
  const tilt = state === 'boost' ? -6 : state === 'stumble' ? -18 : 0;

  const midbody = MIDBODY;
  const headMarkup = HEAD;
  const deco = decoMarkup(horse);

  const legGroup = (front: boolean) =>
    LEGS.filter((l) => (front ? l.layer === 'near' : l.layer === 'far')).map((l) => {
      const isFront = l.id.startsWith('front');
      const rot = legRot(l.offset, l.amp, isFront);
      return (
        <g key={l.id} transform={`rotate(${rot.toFixed(2)} ${l.cx} ${l.cy})`}>
          <path fill="var(--body,#fff)" d={l.leg} />
          <path fill="var(--hoof,#fff)" d={l.hoof} />
        </g>
      );
    });

  return (
    <svg
      style={style}
      viewBox="0 0 520 520"
      role="img"
      aria-label={horse.name || 'ウマ'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <HorseDefs />
      <g transform={`rotate(${tilt} 250 300)`}>
        <g transform={`translate(0 ${bodyY.toFixed(2)})`}>
          {/* speed lines during a boost */}
          {state === 'boost' && !reduced && (
            <g stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.7">
              <line x1="40" y1="250" x2="120" y2="250" />
              <line x1="30" y1="300" x2="130" y2="300" />
              <line x1="48" y1="350" x2="118" y2="350" />
            </g>
          )}
          <g
            stroke={STROKE.color}
            strokeWidth={STROKE.width}
            strokeLinejoin="round"
            strokeLinecap="round"
          >
            {legGroup(false)}
            <g dangerouslySetInnerHTML={{ __html: midbody }} />
            {legGroup(true)}
            <g transform={`rotate(${headRot.toFixed(2)} ${HEAD_PIVOT.x} ${HEAD_PIVOT.y})`}>
              <g dangerouslySetInnerHTML={{ __html: NECK }} />
              <g dangerouslySetInnerHTML={{ __html: headMarkup }} />
            </g>
            {deco && <g dangerouslySetInnerHTML={{ __html: deco }} />}
          </g>
          {/* sweat drops when tired */}
          {state === 'tired' && !reduced && (
            <g fill="#79c8ea" stroke="#2b2118" strokeWidth="3">
              <path d="M 470,96 q 8,12 0,20 q -8,-8 0,-20 Z" />
              <path d="M 452,70 q 7,10 0,17 q -7,-7 0,-17 Z" />
            </g>
          )}
        </g>
      </g>
      {state === 'stumble' && (
        <text x="300" y="60" fontSize="70" fontWeight="900" fill="#d64b45" stroke="#2b2118" strokeWidth="3" textAnchor="middle">
          !
        </text>
      )}
    </svg>
  );
}
