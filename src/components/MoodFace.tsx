import { useRef } from 'react';
import { MOODS, type MoodLevel } from '../logic/mood';

// Unique, url()-safe gradient ids (React's useId emits colons that break url(#…)).
let _uid = 0;

// A glossy やる気 badge for a horse's mood (RACE §odds), styled after the classic
// ウマ娘 marks: a rounded pill in the grade colour with a white directional arrow —
// ⬆絶好調(桃) ↗好調(橙) ➡普通(黄) ↘不調(青) ⬇絶不調(紫). Colour + arrow both encode
// the level so it reads at a glance. The kanji label is drawn by the caller's chip.
const ARROW = 'M12 3.6 L18.6 12 L14.6 12 L14.6 20.2 L9.4 20.2 L9.4 12 L5.4 12 Z'; // up arrow

export default function MoodFace({ level, size = 24, title = true }: { level: MoodLevel; size?: number; title?: boolean }) {
  const m = MOODS[level];
  const idRef = useRef(0);
  if (idRef.current === 0) idRef.current = ++_uid;
  const gid = `mg-${idRef.current}`;
  const hid = `mh-${idRef.current}`;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title ? `気分：${m.label}` : undefined}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={m.color} />
          <stop offset="1" stopColor={m.deep} />
        </linearGradient>
        <linearGradient id={hid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* glossy pill */}
      <rect x="1.4" y="1.4" width="21.2" height="21.2" rx="7.5" fill={`url(#${gid})`} stroke="rgba(0,0,0,0.32)" strokeWidth="1.4" />
      <rect x="3.2" y="2.8" width="17.6" height="8.4" rx="4.2" fill={`url(#${hid})`} />
      {/* directional arrow (rotated: ⬆ level4 … ⬇ level0) */}
      <path d={ARROW} transform={`rotate(${m.arrow} 12 12)`} fill="#fff" stroke="rgba(0,0,0,0.28)" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}
