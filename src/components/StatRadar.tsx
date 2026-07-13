import type { Stats } from '../types';
import { STAT_KEYS, STAT_LABEL, STAT_CAP } from '../types';

// Hexagonal radar chart of the 6 stats (RACE.md §1.2). spd at top, clockwise.
export default function StatRadar({ stats, size = 200 }: { stats: Stats; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.36;
  const n = STAT_KEYS.length;

  const pt = (i: number, r: number) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  };

  const ring = (frac: number) =>
    STAT_KEYS.map((_, i) => pt(i, R * frac).join(',')).join(' ');

  const shape = STAT_KEYS.map((k, i) => pt(i, R * (stats[k] / STAT_CAP)).join(',')).join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="能力レーダー">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ring(f)} fill="none" stroke="#8c6a41" strokeWidth="1.5" opacity="0.5" />
      ))}
      {STAT_KEYS.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#8c6a41" strokeWidth="1.5" opacity="0.5" />;
      })}
      <polygon points={shape} fill="rgba(63,127,214,0.4)" stroke="#3f7fd6" strokeWidth="3" strokeLinejoin="round" />
      {STAT_KEYS.map((k, i) => {
        const [x, y] = pt(i, R + size * 0.075);
        return (
          <text
            key={k}
            x={x}
            y={y}
            fontSize={size * 0.058}
            fontWeight="800"
            fill="#3a2c1c"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {STAT_LABEL[k]}
          </text>
        );
      })}
    </svg>
  );
}
