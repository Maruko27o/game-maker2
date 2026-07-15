// Racecourse scenery (RACE_V4 §1). Builds the *static* layers of the track in
// meter-space SVG — everything that doesn't change per frame — so RaceTrack2 can
// memoise it and only redraw the horses each tick. Dynamic overlays (turf-vision
// text, waving flags, the result board) are drawn by RaceTrack2 itself, where the
// live frame/phase data lives. Hand-drawn, earthy look: soft shapes, no harsh
// outlines, two-tone mowing stripes.
import { toWorld, lapLength, goalS, type Track } from '../logic/track';
import type { Course } from '../data/courses';

export type VB = { x: number; y: number; w: number; h: number };

// Surface palettes: two tones for the mowing stripes.
const SURFACE: Record<string, [string, string]> = {
  turf: ['#7cb85a', '#8bc663'],
  trail: ['#79b060', '#88bd66'],
  steeple: ['#7cb85a', '#8bc663'],
  dirt: ['#b0824f', '#bd8f5c'],
  sand: ['#dcbe82', '#e7cd95'],
  circuit: ['#5c6b8f', '#66759a'],
};

/** SVG path tracing the track edge at a constant lateral offset d (sampled). */
function edgePath(track: Track, d: number, steps = 220): string {
  const lap = lapLength(track);
  let p = '';
  for (let i = 0; i <= steps; i++) {
    const w = toWorld(track, (i / steps) * lap, d);
    p += (i ? 'L' : 'M') + w.x.toFixed(2) + ' ' + w.y.toFixed(2) + ' ';
  }
  return p + 'Z';
}

/** Thick-stroked sub-arc of the centerline → one mowing stripe across the track. */
function stripePath(track: Track, s0: number, s1: number, steps = 8): string {
  let p = '';
  for (let i = 0; i <= steps; i++) {
    const w = toWorld(track, s0 + ((s1 - s0) * i) / steps, 0);
    p += (i ? 'L' : 'M') + w.x.toFixed(2) + ' ' + w.y.toFixed(2) + ' ';
  }
  return p;
}

export function buildScenery(track: Track, course: Course, vb: VB, standsH: number) {
  const lap = lapLength(track);
  const halfW = track.width / 2;
  const [c1, c2] = SURFACE[course.surface] ?? SURFACE.turf;
  const isCircuit = course.surface === 'circuit';
  const horizon = vb.y + standsH * 0.72; // where stands meet the track apron

  // --- mowing stripes: alternating thick strokes on short centerline arcs ---
  const stripeLen = 13;
  const nStripes = Math.max(8, Math.round(lap / stripeLen));
  const stripes = [];
  for (let i = 0; i < nStripes; i++) {
    const s0 = (i / nStripes) * lap;
    const s1 = ((i + 1) / nStripes) * lap;
    stripes.push(
      <path key={'st' + i} d={stripePath(track, s0, s1)} fill="none" stroke={i % 2 ? c1 : c2}
        strokeWidth={track.width} strokeLinecap="butt" />,
    );
  }

  // --- inner fence: two rails + posts, hugging the inner edge (d = −halfW) ---
  const innerPosts = [];
  const nPosts = Math.round(lap / 9);
  for (let i = 0; i < nPosts; i++) {
    const p = toWorld(track, (i / nPosts) * lap, -halfW);
    innerPosts.push(<circle key={'ip' + i} cx={p.x} cy={p.y} r={0.42} fill="#eef1f4" />);
  }

  // --- furlong poles: every 200 m, coloured for the final 200/400/600 m to go ---
  const gs = goalS(track);
  const poles = [];
  const nFur = Math.floor(lap / 200);
  for (let k = 1; k <= nFur; k++) {
    const s = ((gs - k * 200) % lap + lap) % lap;
    const col = k === 1 ? '#e05648' : k === 2 ? '#f3efe0' : k === 3 ? '#5aa85a' : '#c9cdd4';
    const base = toWorld(track, s, halfW + 0.8);
    const top = toWorld(track, s, halfW + 2.2);
    poles.push(
      <g key={'fp' + k}>
        <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke="#e9e4d6" strokeWidth={0.45} />
        <circle cx={top.x} cy={top.y} r={0.8} fill={col} />
      </g>,
    );
  }

  // --- infield decorations (pond + flowerbeds), centred in the oval hole ---
  const cx = 0, cy = 0; // oval centre (meter origin)
  const pondRx = track.straight * 0.28 + 6;
  const flowers = [];
  const fpal = ['#e79ab0', '#f2c14e', '#d98be0', '#8bd0e0'];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    const fx = Math.cos(ang) * (track.straight * 0.36 + 10);
    const fy = Math.sin(ang) * (track.radius * 0.42);
    flowers.push(
      <g key={'fl' + i}>
        <ellipse cx={fx} cy={fy} rx={5.5} ry={2.6} fill="#6ea84e" />
        {[0, 1, 2, 3].map((j) => (
          <circle key={j} cx={fx - 3 + j * 2} cy={fy - 0.4 + (j % 2) * 0.8} r={0.9} fill={fpal[(i + j) % fpal.length]} />
        ))}
      </g>,
    );
  }

  // --- distant mountains + tree line along the horizon (no outline) ---
  const mtn = (mx: number, w: number, h: number) =>
    `M ${mx - w} ${horizon} Q ${mx - w * 0.4} ${horizon - h} ${mx} ${horizon - h * 0.82} Q ${mx + w * 0.5} ${horizon - h} ${mx + w} ${horizon} Z`;

  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isCircuit ? '#2b3350' : '#bfe3f2'} />
          <stop offset="100%" stopColor={isCircuit ? '#3a4460' : '#e6f2d6'} />
        </linearGradient>
        <radialGradient id="pond" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#bfe6ee" />
          <stop offset="100%" stopColor="#79bcd0" />
        </radialGradient>
      </defs>

      {/* ground + sky */}
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={isCircuit ? '#39424f' : '#a9cf7a'} />
      <rect x={vb.x} y={vb.y} width={vb.w} height={standsH + 6} fill="url(#sky)" />

      {/* far mountains + trees */}
      <path d={mtn(vb.x + vb.w * 0.28, 34, standsH * 0.5)} fill={isCircuit ? '#404b6a' : '#9fc4a0'} opacity={0.8} />
      <path d={mtn(vb.x + vb.w * 0.62, 44, standsH * 0.64)} fill={isCircuit ? '#4a557a' : '#8fb992'} opacity={0.85} />
      <path d={mtn(vb.x + vb.w * 0.85, 30, standsH * 0.44)} fill={isCircuit ? '#404b6a' : '#9fc4a0'} opacity={0.8} />
      <rect x={vb.x} y={horizon - 2} width={vb.w} height={standsH * 0.34 + 2} fill={isCircuit ? '#3a4358' : '#7bab5e'} opacity={0.55} />

      {/* grandstand: apron + tiers + mono-pitch roof */}
      <rect x={vb.x} y={horizon} width={vb.w} height={standsH * 0.4} fill="#cdb083" />
      <rect x={vb.x} y={horizon - standsH * 0.06} width={vb.w} height={standsH * 0.1} fill="#b98f5c" />
      {/* roof: a slim slanted bar over the stand */}
      <path d={`M ${vb.x} ${horizon - standsH * 0.1} L ${vb.x + vb.w} ${horizon - standsH * 0.16} L ${vb.x + vb.w} ${horizon - standsH * 0.06} L ${vb.x} ${horizon - standsH * 0.02} Z`}
        fill="#d7dde6" opacity={0.9} />

      {/* running surface: two-tone mowing stripes + apron rings */}
      <path d={edgePath(track, 0)} fill="none" stroke="#eef0e6" strokeWidth={track.width + 3} strokeLinejoin="round" />
      <g>{stripes}</g>

      {/* outer + inner fences */}
      <path d={edgePath(track, halfW + 0.3)} fill="none" stroke="#f4f1e6" strokeWidth={0.7} />
      <path d={edgePath(track, -halfW - 0.2)} fill="none" stroke="#e9edf1" strokeWidth={0.9} />
      <path d={edgePath(track, -halfW - 1.1)} fill="none" stroke="#dfe4ea" strokeWidth={0.5} opacity={0.8} />
      <g>{innerPosts}</g>

      {/* infield: grass hole, pond (with a sparkle), flowerbeds */}
      <path d={edgePath(track, -halfW - 1.4)} fill={isCircuit ? '#3f4a3c' : '#8fc25c'} stroke="none" />
      <ellipse cx={cx} cy={cy} rx={pondRx} ry={track.radius * 0.34} fill="url(#pond)" />
      <ellipse cx={cx - pondRx * 0.3} cy={-track.radius * 0.1} rx={pondRx * 0.28} ry={1.6} fill="#ffffff" opacity={0.45} />
      <g>{flowers}</g>

      {/* furlong poles */}
      <g>{poles}</g>
    </>
  );
}
