import type { CSSProperties } from 'react';
import type { Horse, DecoSlot } from '../types';
import { colorById, decoById } from '../data/parts';
import { HORSE_BASE_INNER, VIEWBOX } from '../data/horseBase';

// Draw order (bottom -> top). Per CLAUDE.md §3.2 ("後 = 手前": decos drawn after
// the base sit in front, face is frontmost). Verified by rendering: the back-slot
// items are mostly worn ON the body (saddle/backpack/armor/jetpack), so all decos
// render in front of the base, in this slot order.
const FRONT: DecoSlot[] = ['back', 'tail', 'head', 'face'];

type Props = {
  horse: Horse;
  size?: number;
  className?: string;
  /** Draw a soft ground shadow under the horse. */
  shadow?: boolean;
};

function decoMarkup(horse: Horse, slot: DecoSlot): string | null {
  const id = horse.decos[slot];
  if (!id) return null;
  return decoById[id]?.svg ?? null;
}

export default function HorseView({ horse, size = 240, className, shadow }: Props) {
  const body = colorById[horse.colors.body]?.value ?? '#f6f2ea';
  const mane = colorById[horse.colors.mane]?.value ?? '#6b4326';
  const hoof = colorById[horse.colors.hoof]?.value ?? '#3a2c1c';

  const style = {
    '--body': body,
    '--mane': mane,
    '--hoof': hoof,
    width: size,
    height: size,
  } as CSSProperties;

  const front = FRONT.map((s) => decoMarkup(horse, s)).filter(Boolean).join('\n');

  return (
    <svg
      className={className}
      style={style}
      viewBox={VIEWBOX}
      role="img"
      aria-label={horse.name || 'ウマ'}
      xmlns="http://www.w3.org/2000/svg"
    >
      {shadow && <ellipse cx="250" cy="470" rx="150" ry="22" fill="rgba(58,44,28,0.18)" />}
      <g dangerouslySetInnerHTML={{ __html: HORSE_BASE_INNER }} />
      {front && <g dangerouslySetInnerHTML={{ __html: front }} />}
    </svg>
  );
}
