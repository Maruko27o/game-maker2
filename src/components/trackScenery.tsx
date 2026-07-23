// Racecourse scenery (RACE_V4 §1). Builds the *static* layers of the track in
// meter-space SVG — everything that doesn't change per frame — so RaceTrack2 can
// memoise it and only redraw the horses each tick. Dynamic overlays (turf-vision
// text, waving flags, the result board) are drawn by RaceTrack2 itself, where the
// live frame/phase data lives. Hand-drawn, earthy look: soft shapes, no harsh
// outlines, two-tone mowing stripes.
import { toWorld, lapLength, goalS, type Track } from '../logic/track';
import type { Course } from '../data/courses';
import styles from './RaceTrack2.module.css';

export type VB = { x: number; y: number; w: number; h: number };

// --- little illustrated props (meter-space) ---------------------------------

// A single flower: green stem + 5 rounded petals + yellow center. Sways from base.
function Flower({ x, y, col, delay, cls }: { x: number; y: number; col: string; delay: number; cls: string }) {
  const hy = y - 1.7; // flower head sits above the base
  const R = 0.7;
  return (
    <g className={cls} style={{ animationDelay: `${delay}s` }}>
      <line x1={x} y1={y} x2={x} y2={hy + 0.2} stroke="#4f8f43" strokeWidth={0.34} strokeLinecap="round" />
      <ellipse cx={x - 0.5} cy={y - 0.9} rx={0.55} ry={0.28} fill="#5aa049" transform={`rotate(-32 ${x - 0.5} ${y - 0.9})`} />
      {[0, 1, 2, 3, 4].map((k) => {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(a) * R, py = hy + Math.sin(a) * R;
        return <ellipse key={k} cx={px} cy={py} rx={0.52} ry={0.34} fill={col} transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />;
      })}
      <circle cx={x} cy={hy} r={0.44} fill="#f8e24c" />
      <circle cx={x - 0.12} cy={hy - 0.12} r={0.18} fill="#fff" opacity={0.6} />
    </g>
  );
}

// A tuft of grass: a few tapered blades fanning up. Sways from its base.
function Tuft({ x, y, s, delay }: { x: number; y: number; s: number; delay: number }) {
  const bl = (dx: number, dy: number, c: string) => (
    <path d={`M ${x} ${y} Q ${x + dx * 0.4} ${y - dy * 0.7} ${x + dx} ${y - dy}`} fill="none" stroke={c} strokeWidth={0.28 * s} strokeLinecap="round" />
  );
  return (
    <g className={styles.tuft} style={{ animationDelay: `${delay}s` }}>
      {bl(-0.7 * s, 1.4 * s, '#5aa049')}
      {bl(0, 1.8 * s, '#67b356')}
      {bl(0.7 * s, 1.4 * s, '#5aa049')}
    </g>
  );
}

// Reeds/cattails at the water's edge: slim blades + a brown cattail head.
function Reed({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <g className={styles.swayB} style={{ animationDelay: `${delay}s` }}>
      <line x1={x - 0.5} y1={y} x2={x - 0.9} y2={y - 2.6} stroke="#4f8f43" strokeWidth={0.26} strokeLinecap="round" />
      <line x1={x + 0.5} y1={y} x2={x + 0.7} y2={y - 2.2} stroke="#5aa049" strokeWidth={0.26} strokeLinecap="round" />
      <line x1={x} y1={y} x2={x} y2={y - 3.4} stroke="#4f8f43" strokeWidth={0.3} strokeLinecap="round" />
      <rect x={x - 0.28} y={y - 3.9} width={0.56} height={1.1} rx={0.28} fill="#9c6a3c" />
    </g>
  );
}

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

  // --- infield decorations (pond + flowerbeds + grass tufts), centred in the hole ---
  const cx = 0, cy = 0; // oval centre (meter origin)
  const pondRx = track.straight * 0.28 + 6;
  const pondRy = track.radius * 0.34;
  const fpal = ['#e97ba0', '#f2c14e', '#d98be0', '#f28a6a', '#8bd0e0'];
  // flowerbeds: a soil mound with a little cluster of drawn flowers that sway.
  const flowers = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + 0.4;
    const fx = Math.cos(ang) * (track.straight * 0.36 + 10);
    const fy = Math.sin(ang) * (track.radius * 0.42);
    const cluster = [
      { dx: -2.6, dy: 0.4, c: fpal[i % 5] },
      { dx: 0, dy: -0.2, c: fpal[(i + 1) % 5] },
      { dx: 2.6, dy: 0.5, c: fpal[(i + 3) % 5] },
    ];
    flowers.push(
      <g key={'fl' + i}>
        <ellipse cx={fx} cy={fy + 0.5} rx={5.6} ry={2.4} fill="#5f9a44" />
        <ellipse cx={fx} cy={fy + 0.1} rx={5.6} ry={2.0} fill="#6eb356" />
        {cluster.map((f, j) => (
          <Flower key={j} x={fx + f.dx} y={fy + f.dy} col={f.c} delay={(i * 3 + j * 2) * 0.31} cls={j % 2 ? styles.swayB : styles.sway} />
        ))}
      </g>,
    );
  }
  // grass tufts scattered on the infield (ring between pond and inner fence).
  const tufts = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + 0.7;
    const rr = 0.62 + (i % 3) * 0.08;
    const tx = Math.cos(a) * (track.straight * 0.5 + 4) * rr;
    const ty = Math.sin(a) * track.radius * 0.66 * rr;
    // keep tufts off the pond
    if (Math.abs(tx) < pondRx * 0.9 && Math.abs(ty) < pondRy * 0.9) continue;
    tufts.push(<Tuft key={'tf' + i} x={tx} y={ty} s={0.9 + (i % 3) * 0.18} delay={(i % 7) * 0.4} />);
  }
  // reeds + lily pads at / on the pond.
  const reeds = [
    <Reed key="rd0" x={-pondRx * 0.72} y={-pondRy * 0.2} delay={0} />,
    <Reed key="rd1" x={-pondRx * 0.5} y={pondRy * 0.55} delay={0.7} />,
    <Reed key="rd2" x={pondRx * 0.66} y={pondRy * 0.3} delay={1.3} />,
    <Reed key="rd3" x={pondRx * 0.34} y={-pondRy * 0.55} delay={1.9} />,
  ];
  const lilypad = (lx: number, ly: number, r: number, flower: boolean, key: string) => (
    <g key={key}>
      <ellipse cx={lx} cy={ly} rx={r} ry={r * 0.5} fill="#57a04a" />
      <path d={`M ${lx} ${ly} L ${lx + r * 0.9} ${ly - r * 0.25} L ${lx + r * 0.9} ${ly + r * 0.25} Z`} fill="url(#pond)" />
      {flower && <circle cx={lx - r * 0.2} cy={ly - r * 0.12} r={r * 0.22} fill="#f7d0e0" />}
    </g>
  );

  // --- real-racecourse infield: mown rings (lawn texture) + a hedge just inside
  //     the rail + scattered shrubs, so the ring between the fence and the pond
  //     isn't bare. ---
  const mowRings = isCircuit
    ? []
    : [
        { rx: track.straight * 0.62 + 8, ry: track.radius * 0.8, c: '#84b953' },
        { rx: track.straight * 0.46 + 6, ry: track.radius * 0.6, c: '#8dc25c' },
        { rx: track.straight * 0.3 + 4, ry: track.radius * 0.42, c: '#84b953' },
      ].map((m, i) => <ellipse key={'mr' + i} cx={cx} cy={cy} rx={m.rx} ry={m.ry} fill={m.c} />);
  // hedge ring hugging the inner rail (thick green band + scalloped bumps)
  const hedgeD = edgePath(track, -halfW - 2.2);
  const hedgeBumps = [];
  const nBump = Math.max(10, Math.round(lap / 6));
  for (let i = 0; i < nBump; i++) {
    const p = toWorld(track, (i / nBump) * lap, -halfW - 2.2);
    hedgeBumps.push(<circle key={'hb' + i} cx={p.x} cy={p.y} r={1.15} fill={i % 2 ? '#4f9243' : '#58a24a'} />);
  }
  // rounded shrubs dotted around the infield ring (kept off the pond)
  const bush = (bx: number, by: number, s: number, key: string) => (
    <g key={key}>
      <ellipse cx={bx} cy={by + 1.5 * s} rx={3.4 * s} ry={1.0 * s} fill="#000" opacity={0.1} />
      <circle cx={bx - 1.8 * s} cy={by} r={2.0 * s} fill="#4f9243" />
      <circle cx={bx + 1.8 * s} cy={by} r={2.0 * s} fill="#4f9243" />
      <circle cx={bx} cy={by - 1.2 * s} r={2.4 * s} fill="#59a44b" />
      <circle cx={bx - 0.5 * s} cy={by - 1.9 * s} r={1.0 * s} fill="#6cba5a" />
    </g>
  );
  const bushes = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.25;
    const bx = Math.cos(a) * (track.straight * 0.52 + 6);
    const by = Math.sin(a) * (track.radius * 0.62);
    if (Math.abs(bx) < pondRx * 1.05 && Math.abs(by) < pondRy * 1.05) continue;
    bushes.push(bush(bx, by, 0.85 + (i % 3) * 0.16, 'bs' + i));
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

      {/* infield: grass hole + mown rings + hedge ring + shrubs + tufts, detailed
          pond (rim, ripples, lily pads, reeds, shimmering reflection), flowerbeds */}
      <path d={edgePath(track, -halfW - 1.4)} fill={isCircuit ? '#3f4a3c' : '#8fc25c'} stroke="none" />
      {/* concentric mown rings (lawn texture) */}
      <g opacity={isCircuit ? 0 : 0.55}>{mowRings}</g>
      {/* hedge hugging the inner rail so the fence-to-pond ring isn't bare */}
      {!isCircuit && (
        <>
          <path d={hedgeD} fill="none" stroke="#3f7d38" strokeWidth={2.6} strokeLinejoin="round" />
          <g>{hedgeBumps}</g>
          <path d={hedgeD} fill="none" stroke="#5aa049" strokeWidth={0.9} opacity={0.8} />
        </>
      )}
      {/* shrubs dotted around the infield */}
      {!isCircuit && <g>{bushes}</g>}
      <g>{tufts}</g>
      {/* pond body + shadow rim */}
      <ellipse cx={cx} cy={cy} rx={pondRx} ry={pondRy} fill={isCircuit ? '#3b4a63' : '#5aa0b0'} opacity={0.5} />
      <ellipse cx={cx} cy={cy - 0.4} rx={pondRx - 0.5} ry={pondRy - 0.6} fill="url(#pond)" />
      {/* ripples */}
      <ellipse className={styles.ripple} style={{ animationDelay: '0s' }} cx={-pondRx * 0.25} cy={pondRy * 0.1} rx={pondRx * 0.4} ry={pondRy * 0.4} fill="none" stroke="#ffffff" strokeWidth={0.28} />
      <ellipse className={styles.ripple} style={{ animationDelay: '2.3s' }} cx={pondRx * 0.35} cy={-pondRy * 0.2} rx={pondRx * 0.3} ry={pondRy * 0.3} fill="none" stroke="#ffffff" strokeWidth={0.24} />
      {/* shimmering reflection streaks */}
      <ellipse className={styles.shimmer} cx={cx - pondRx * 0.3} cy={-pondRy * 0.35} rx={pondRx * 0.32} ry={1.4} fill="#ffffff" />
      <ellipse className={styles.shimmer} style={{ animationDelay: '1.4s' }} cx={cx + pondRx * 0.25} cy={pondRy * 0.28} rx={pondRx * 0.2} ry={1.0} fill="#ffffff" />
      {lilypad(-pondRx * 0.4, pondRy * 0.35, 1.8, true, 'lp0')}
      {lilypad(pondRx * 0.45, -pondRy * 0.1, 1.4, false, 'lp1')}
      <g>{reeds}</g>
      <g>{flowers}</g>

      {/* furlong poles */}
      <g>{poles}</g>
    </>
  );
}
