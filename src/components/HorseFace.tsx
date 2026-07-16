import { memo, useId, type CSSProperties } from 'react';
import type { HorseLook } from '../types';
import { colorById, decoById } from '../data/parts';
import { HORSE_BASE_INNER } from '../data/horseBase';
import HorseDefs from './HorseDefs';

// A round, cropped portrait of a horse's head + mane crest (RACE_V3 §1.4).
// Reused by the race rank panel and anywhere a compact "which horse" chip helps.
// The head AND face decoration slots are drawn (hats/horns/眼帯/メガネ all sit on the
// portrait), so the icon reflects the horse's look — including face gear. Back/tail
// decos live on the body, outside this crop. Centred on the crest→muzzle in 520-space.
const VB = { x: 260, y: 55, s: 220 }; // square viewBox window over the head
const C = { cx: 370, cy: 165, r: 104 }; // clip/ring circle inside that window

// Lighten a #rrggbb toward white for the portrait background; gradients fall back.
function tint(value: string | undefined): string {
  if (!value || value[0] !== '#' || value.length < 7) return '#efe3c8';
  const mix = (a: number) => Math.round(a + (255 - a) * 0.55);
  const r = mix(parseInt(value.slice(1, 3), 16));
  const g = mix(parseInt(value.slice(3, 5), 16));
  const b = mix(parseInt(value.slice(5, 7), 16));
  return `rgb(${r},${g},${b})`;
}

function HorseFace({
  horse,
  size = 48,
  className,
}: {
  horse: HorseLook;
  size?: 32 | 48 | 64 | number;
  className?: string;
}) {
  const body = colorById[horse.colors.body]?.value ?? '#f6f2ea';
  const mane = colorById[horse.colors.mane]?.value ?? '#6b4326';
  const hoof = colorById[horse.colors.hoof]?.value ?? '#3a2c1c';
  const headDeco = horse.decos.head ? decoById[horse.decos.head]?.svg : null;
  const faceDeco = horse.decos.face ? decoById[horse.decos.face]?.svg : null;
  const clip = 'face-' + useId().replace(/:/g, '');

  const style = {
    '--body': body,
    '--mane': mane,
    '--hoof': hoof,
    width: size,
    height: size,
  } as CSSProperties;

  return (
    <svg
      className={className}
      style={style}
      viewBox={`${VB.x} ${VB.y} ${VB.s} ${VB.s}`}
      role="img"
      aria-label={horse.name || 'ウマ'}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clip}>
          <circle cx={C.cx} cy={C.cy} r={C.r} />
        </clipPath>
      </defs>
      <HorseDefs />
      <g clipPath={`url(#${clip})`}>
        <rect x={VB.x} y={VB.y} width={VB.s} height={VB.s} fill={tint(body)} />
        <g dangerouslySetInnerHTML={{ __html: HORSE_BASE_INNER }} />
        {/* head gear, then face gear on top — matches the full-body draw order */}
        {headDeco && <g dangerouslySetInnerHTML={{ __html: headDeco }} />}
        {faceDeco && <g dangerouslySetInnerHTML={{ __html: faceDeco }} />}
      </g>
      <circle cx={C.cx} cy={C.cy} r={C.r} fill="none" stroke="#5c4326" strokeWidth={9} />
    </svg>
  );
}

// Portraits are static during a race; memoise so the 10Hz rank panel doesn't
// re-render every SVG each frame.
export default memo(HorseFace);
