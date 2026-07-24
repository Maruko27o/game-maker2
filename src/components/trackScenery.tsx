// Racecourse scenery (RACE_V4 §1). Builds the *static* layers of the track in
// meter-space SVG — everything that doesn't change per frame — so RaceTrack2 can
// memoise it and only redraw the horses each tick. Dynamic overlays (turf-vision
// text, waving flags, the result board) are drawn by RaceTrack2 itself, where the
// live frame/phase data lives. Hand-drawn, earthy look: soft shapes, no harsh
// outlines, two-tone mowing stripes.
import { toWorld, lapLength, goalS, centerline, type Track } from '../logic/track';
import type { Course } from '../data/courses';
import { mulberry32 } from '../logic/stats';
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

/** An illustrated steeple obstacle drawn as a band across the track at arc `s`.
 *  water = 水濠（青い水面＋波紋＋踏切板）, bamboo = 竹柵（竹の縦桟＋緑の頂部）,
 *  hedge = 生垣ジャンプ（緑の茂み＋土台の踏切板）. Shared by RaceTrack2 (live) and
 *  the scene-debug page so both draw the same thing. */
export function obstacleMark(track: Track, s: number, kind: 'hedge' | 'bamboo' | 'water', key: string) {
  const half = track.width / 2;
  const P = (ds: number, dn: number) => toWorld(track, s + ds, dn);
  const near = 1.5, far = 1.5; // depth (m) each side of the take-off line
  // cross-track polyline at a given along-offset (n+1 samples spanning the width)
  const line = (ds: number, n = 8) =>
    Array.from({ length: n + 1 }, (_, k) => P(ds, -half + (k / n) * track.width))
      .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
      .join(' ');
  const A = P(-near, -half), B = P(-near, half), C = P(far, half), D = P(far, -half);
  const band = [A, B, C, D].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const board = line(-near); // near-edge take-off board line

  if (kind === 'water') {
    return (
      <g key={key}>
        <polygon points={band} fill="#1f5480" />
        <polygon points={[P(-near + 0.35, -half), P(-near + 0.35, half), P(far, half), P(far, -half)].map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')} fill="#2f79aa" />
        <polyline points={line(-0.2)} fill="none" stroke="#bfe2f2" strokeWidth={0.35} opacity={0.8} />
        <polyline points={line(0.6)} fill="none" stroke="#ffffff" strokeWidth={0.26} opacity={0.4} />
        <polyline points={board} fill="none" stroke="#f2efe4" strokeWidth={0.85} strokeLinecap="round" />
      </g>
    );
  }
  if (kind === 'bamboo') {
    const nPole = 11;
    const poles = Array.from({ length: nPole }, (_, i) => {
      const dn = -half + (i / (nPole - 1)) * track.width;
      const a = P(-near + 0.2, dn), b = P(far - 0.2, dn);
      return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={i % 2 ? '#b98f4f' : '#a97e46'} strokeWidth={0.55} strokeLinecap="round" />;
    });
    return (
      <g key={key}>
        <polygon points={band} fill="#caa25c" />
        <g>{poles}</g>
        <polyline points={line(-0.55)} fill="none" stroke="#6cb356" strokeWidth={0.7} strokeLinecap="round" />
        <polyline points={board} fill="none" stroke="#f2efe4" strokeWidth={0.7} strokeLinecap="round" />
      </g>
    );
  }
  // hedge / brush fence
  const tufts = Array.from({ length: 12 }, (_, i) => {
    const p = P(-0.1 + (i % 2 ? 0.35 : -0.35), -half + (i / 11) * track.width);
    return <circle key={i} cx={p.x} cy={p.y} r={0.95} fill={i % 2 ? '#3f7d38' : '#4f9243'} />;
  });
  return (
    <g key={key}>
      <polygon points={band} fill="#356e30" />
      <g>{tufts}</g>
      <polyline points={line(0.5)} fill="none" stroke="#5aa049" strokeWidth={0.45} opacity={0.85} />
      <polyline points={board} fill="none" stroke="#efe6c8" strokeWidth={0.7} strokeLinecap="round" />
    </g>
  );
}

export function buildScenery(track: Track, course: Course, vb: VB, standsH: number) {
  const lap = lapLength(track);
  const halfW = track.width / 2;
  // ナイトサーキットは surface こそ turf（物理はturf）だが、見た目は夜。id で判定する。
  const isCircuit = course.id === 'circuit';
  const [c1, c2] = isCircuit ? SURFACE.circuit : SURFACE[course.surface] ?? SURFACE.turf;

  // コース別の空気感（空・遠景・地面の色みと、名物の飾り）。夜は別処理。
  type Theme = { sky: [string, string]; mtnA: string; mtnB: string; tree: string; bg: string; sun?: boolean; cacti?: boolean; pines?: boolean; puddles?: boolean };
  const THEME: Record<string, Theme> = {
    dirt: { sky: ['#c7c1ab', '#e4ddc6'], mtnA: '#9a8f78', mtnB: '#877c66', tree: '#8d855f', bg: '#b4a37f', puddles: true },
    sand: { sky: ['#ffd49a', '#ffe9c6'], mtnA: '#e3c088', mtnB: '#d5ac6e', tree: '#dcbe80', bg: '#e6ce96', sun: true, cacti: true },
    trail: { sky: ['#cfe6f0', '#e1eecb'], mtnA: '#6f9a6a', mtnB: '#5b8857', tree: '#4d8843', bg: '#9abf6a', pines: true },
  };
  const theme: Theme = THEME[course.id] ?? { sky: ['#bfe3f2', '#e6f2d6'], mtnA: '#9fc4a0', mtnB: '#8fb992', tree: '#7bab5e', bg: '#a9cf7a' };
  const horizon = vb.y + standsH * 0.72; // where stands meet the track apron

  // --- mowing stripes: alternating thick strokes on short centerline arcs ---
  const stripeLen = 13;
  const nStripes = Math.max(8, Math.round(lap / stripeLen));
  // Overlap adjacent stripes so the pale apron underneath doesn't bleed through the
  // seams as stray near-white "fence" lines (which read as muddy next to a dark
  // stripe). centerline() wraps s, so a slightly out-of-range s0/s1 is fine.
  const stripeOverlap = 0.8;
  const stripes = [];
  for (let i = 0; i < nStripes; i++) {
    const s0 = (i / nStripes) * lap - stripeOverlap;
    const s1 = ((i + 1) / nStripes) * lap + stripeOverlap;
    stripes.push(
      <path key={'st' + i} d={stripePath(track, s0, s1)} fill="none" stroke={i % 2 ? c1 : c2}
        strokeWidth={track.width} strokeLinecap="butt" />,
    );
  }

  // --- inner fence: two rails + posts, hugging the inner edge (d = −halfW) ---
  const innerPosts = [];
  const nPosts = Math.round(lap / 9);
  for (let i = 0; i < nPosts; i++) {
    const p = toWorld(track, (i / nPosts) * lap, -halfW - 0.4);
    innerPosts.push(<circle key={'ip' + i} cx={p.x} cy={p.y} r={0.42} fill="#fbfaf4" stroke="#c9cebc" strokeWidth={0.12} />);
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
  // 内柵の内側に沿う「花のボーダー花壇」：低木と花クラスタを交互に並べた華やかな
  // 縁取り（内柵の白ラインは最前面なので、ここは白ラチを邪魔しない内側に置く）。
  const hedgeOff = -halfW - 3.0;
  const fpal2 = ['#e97ba0', '#f2c14e', '#ffffff', '#d98be0', '#f28a6a'];
  const nPlant = Math.max(6, Math.round(lap / 4));
  const planting = [];
  for (let i = 0; i < nPlant; i++) {
    const s = (i / nPlant) * lap;
    const p = toWorld(track, s, hedgeOff);
    const c = centerline(track, s);
    planting.push(
      i % 2 === 0 ? (
        <g key={'pl' + i}>
          <ellipse cx={p.x} cy={p.y + 1.3} rx={2.2} ry={0.8} fill="#000" opacity={0.1} />
          <circle cx={p.x - c.nx * 0.6} cy={p.y - c.ny * 0.6} r={1.5} fill="#4f9243" />
          <circle cx={p.x + c.nx * 0.6} cy={p.y + c.ny * 0.6} r={1.5} fill="#4f9243" />
          <circle cx={p.x} cy={p.y} r={1.7} fill="#59a44b" />
          <circle cx={p.x - 0.4} cy={p.y - 0.7} r={0.7} fill="#6cba5a" />
        </g>
      ) : (
        <g key={'pl' + i}>
          <ellipse cx={p.x} cy={p.y + 0.6} rx={2.0} ry={0.9} fill="#5f9a44" />
          <ellipse cx={p.x} cy={p.y + 0.2} rx={2.0} ry={0.75} fill="#6eb356" />
          {[-1, 0, 1].map((k) => (
            <g key={k}>
              <circle cx={p.x + k * 0.9} cy={p.y - 0.2 - (k === 0 ? 0.4 : 0)} r={0.6} fill={fpal2[(i + k + 2) % fpal2.length]} />
              <circle cx={p.x + k * 0.9} cy={p.y - 0.2 - (k === 0 ? 0.4 : 0)} r={0.22} fill="#fff3c4" />
            </g>
          ))}
        </g>
      ),
    );
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
  // infield ring positions (shared by bushes / cacti / puddles, kept off the pond)
  const ringPts: { x: number; y: number; s: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.25;
    const bx = Math.cos(a) * (track.straight * 0.52 + 6);
    const by = Math.sin(a) * (track.radius * 0.62);
    if (Math.abs(bx) < pondRx * 1.05 && Math.abs(by) < pondRy * 1.05) continue;
    ringPts.push({ x: bx, y: by, s: 0.85 + (i % 3) * 0.16 });
  }
  const bushes = ringPts.map((p, i) => bush(p.x, p.y, p.s, 'bs' + i));

  // 名物の飾り：デザート=サボテン、トレイル=松、ダート=水たまり。
  const pine = (x: number, y: number, s: number, key: string) => (
    <g key={key}>
      <ellipse cx={x} cy={y + 0.6 * s} rx={2.2 * s} ry={0.6 * s} fill="#000" opacity={0.1} />
      <rect x={x - 0.45 * s} y={y - 1.2 * s} width={0.9 * s} height={2.2 * s} fill="#7a5a34" />
      <polygon points={`${x},${y - 6.4 * s} ${x - 2.5 * s},${y - 1 * s} ${x + 2.5 * s},${y - 1 * s}`} fill="#3f7d48" />
      <polygon points={`${x},${y - 8.4 * s} ${x - 1.9 * s},${y - 3.6 * s} ${x + 1.9 * s},${y - 3.6 * s}`} fill="#4f9243" />
      <polygon points={`${x},${y - 10 * s} ${x - 1.3 * s},${y - 6 * s} ${x + 1.3 * s},${y - 6 * s}`} fill="#5aa64f" />
    </g>
  );
  const cactus = (x: number, y: number, s: number, key: string) => (
    <g key={key}>
      <ellipse cx={x} cy={y + 2.2 * s} rx={2.6 * s} ry={0.7 * s} fill="#000" opacity={0.1} />
      <rect x={x - 1.1 * s} y={y - 3.4 * s} width={2.2 * s} height={5.8 * s} rx={1.1 * s} fill="#4f9a5a" />
      <rect x={x - 3 * s} y={y - 1.6 * s} width={1.5 * s} height={2.8 * s} rx={0.75 * s} fill="#57a866" />
      <rect x={x - 3 * s} y={y - 2.8 * s} width={1.4 * s} height={1.7 * s} rx={0.7 * s} fill="#57a866" />
      <rect x={x + 1.5 * s} y={y - 2.2 * s} width={1.5 * s} height={2.6 * s} rx={0.75 * s} fill="#4f9a5a" />
      <rect x={x + 1.5 * s} y={y - 3.3 * s} width={1.4 * s} height={1.5 * s} rx={0.7 * s} fill="#4f9a5a" />
      <circle cx={x} cy={y - 3.4 * s} r={0.5 * s} fill="#f2c14e" />
    </g>
  );
  const cacti = ringPts.map((p, i) => cactus(p.x, p.y, p.s, 'ca' + i));
  const infieldPines = ringPts.filter((_, i) => i % 2 === 0).map((p, i) => pine(p.x, p.y, p.s * 1.1, 'ip' + i));
  const puddles = ringPts.filter((_, i) => i % 2 === 1).map((p, i) => (
    <g key={'pd' + i}>
      <ellipse cx={p.x} cy={p.y} rx={3.4 * p.s} ry={1.5 * p.s} fill="#7c7358" opacity={0.55} />
      <ellipse cx={p.x - 0.4} cy={p.y - 0.4} rx={2.4 * p.s} ry={0.9 * p.s} fill="#a9b2b0" opacity={0.5} />
    </g>
  ));
  // trail: a line of pines along the far tree line
  const horizonPines = theme.pines
    ? Array.from({ length: 9 }, (_, i) => pine(vb.x + vb.w * (0.06 + i * 0.11), horizon - 1, standsH * 0.05, 'hp' + i))
    : [];

  // --- distant mountains + tree line along the horizon (no outline) ---
  const mtn = (mx: number, w: number, h: number) =>
    `M ${mx - w} ${horizon} Q ${mx - w * 0.4} ${horizon - h} ${mx} ${horizon - h * 0.82} Q ${mx + w * 0.5} ${horizon - h} ${mx + w} ${horizon} Z`;

  // --- night course (ナイトサーキット): stars, a moon, and floodlight pylons that
  //     cast warm light pools onto the track. ---
  const nrng = mulberry32(98713);
  const stars = isCircuit
    ? Array.from({ length: 55 }, (_, i) => {
        const sx = vb.x + nrng() * vb.w;
        const sy = vb.y + nrng() * (horizon - vb.y) * 0.92;
        const r = 0.25 + nrng() * 0.55;
        return <circle key={'nst' + i} cx={sx} cy={sy} r={r} fill="#fdfce8" opacity={0.35 + nrng() * 0.6} />;
      })
    : [];
  const floodX = [0.16, 0.4, 0.62, 0.85];
  const floodPylons = floodX.map((fx, i) => {
    const x = vb.x + vb.w * fx;
    const topY = horizon - standsH * 0.66;
    return (
      <g key={'fpy' + i}>
        <line x1={x} y1={horizon} x2={x} y2={topY} stroke="#20242e" strokeWidth={1.1} />
        <rect x={x - 3.2} y={topY - 2.6} width={6.4} height={3.0} rx={0.5} fill="#2b2f3a" />
        {[-2.1, 0, 2.1].map((k) => (
          <circle key={k} cx={x + k} cy={topY - 1.1} r={0.75} fill="#fff3c0" />
        ))}
        <circle cx={x} cy={topY - 1.1} r={3.4} fill="url(#flood)" />
      </g>
    );
  });
  const floodGlow = floodX.map((fx, i) => {
    const x = vb.x + vb.w * fx;
    return <ellipse key={'fgl' + i} cx={x} cy={horizon + standsH * 0.34} rx={standsH * 0.5} ry={standsH * 0.62} fill="url(#flood)" />;
  });

  return (
    <>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isCircuit ? '#161b30' : theme.sky[0]} />
          <stop offset="100%" stopColor={isCircuit ? '#2b3352' : theme.sky[1]} />
        </linearGradient>
        <radialGradient id="pond" cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#bfe6ee" />
          <stop offset="100%" stopColor="#79bcd0" />
        </radialGradient>
        <radialGradient id="flood" cx="50%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#fff6d8" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#fff6d8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="moon" cx="42%" cy="38%" r="62%">
          <stop offset="0%" stopColor="#fdfae6" />
          <stop offset="100%" stopColor="#e6e0bf" />
        </radialGradient>
      </defs>

      {/* ground + sky */}
      <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill={isCircuit ? '#2a3140' : theme.bg} />
      <rect x={vb.x} y={vb.y} width={vb.w} height={standsH + 6} fill="url(#sky)" />

      {/* night: stars + moon (behind the mountains/stands) */}
      {isCircuit && (
        <>
          <g>{stars}</g>
          <circle cx={vb.x + vb.w * 0.82} cy={vb.y + standsH * 0.34} r={standsH * 0.15} fill="url(#moon)" />
          <circle cx={vb.x + vb.w * 0.86} cy={vb.y + standsH * 0.29} r={standsH * 0.12} fill="#1c2338" opacity={0.5} />
        </>
      )}
      {/* desert: a big warm sun */}
      {theme.sun && (
        <>
          <circle cx={vb.x + vb.w * 0.78} cy={vb.y + standsH * 0.36} r={standsH * 0.28} fill="#ffcf6a" opacity={0.35} />
          <circle cx={vb.x + vb.w * 0.78} cy={vb.y + standsH * 0.36} r={standsH * 0.19} fill="#ffdc7a" />
        </>
      )}

      {/* far mountains + trees */}
      <path d={mtn(vb.x + vb.w * 0.28, 34, standsH * 0.5)} fill={isCircuit ? '#232a3e' : theme.mtnA} opacity={0.85} />
      <path d={mtn(vb.x + vb.w * 0.62, 44, standsH * 0.64)} fill={isCircuit ? '#2a3248' : theme.mtnB} opacity={0.9} />
      <path d={mtn(vb.x + vb.w * 0.85, 30, standsH * 0.44)} fill={isCircuit ? '#232a3e' : theme.mtnA} opacity={0.85} />
      <rect x={vb.x} y={horizon - 2} width={vb.w} height={standsH * 0.34 + 2} fill={isCircuit ? '#2b3350' : theme.tree} opacity={0.55} />
      {/* trail: a line of pine trees along the horizon */}
      {theme.pines && <g>{horizonPines}</g>}

      {/* grandstand: apron + tiers + mono-pitch roof */}
      <rect x={vb.x} y={horizon} width={vb.w} height={standsH * 0.4} fill={isCircuit ? '#3a4056' : '#cdb083'} />
      <rect x={vb.x} y={horizon - standsH * 0.06} width={vb.w} height={standsH * 0.1} fill={isCircuit ? '#2f3548' : '#b98f5c'} />
      {/* roof: a slim slanted bar over the stand */}
      <path d={`M ${vb.x} ${horizon - standsH * 0.1} L ${vb.x + vb.w} ${horizon - standsH * 0.16} L ${vb.x + vb.w} ${horizon - standsH * 0.06} L ${vb.x} ${horizon - standsH * 0.02} Z`}
        fill={isCircuit ? '#525a72' : '#d7dde6'} opacity={0.9} />
      {/* night: floodlight pylons over the stands */}
      {isCircuit && <g>{floodPylons}</g>}

      {/* running surface: two-tone mowing stripes + apron rings */}
      <path d={edgePath(track, 0)} fill="none" stroke={isCircuit ? '#c8cbe0' : '#eef0e6'} strokeWidth={track.width + 3} strokeLinejoin="round" />
      <g>{stripes}</g>
      {/* night: warm floodlight pools spilling onto the track */}
      {isCircuit && <g>{floodGlow}</g>}

      {/* outer fence (the inner rail is drawn last, over the infield, so it stays
          a clean white line and isn't crowded by the green hedge). */}
      <path d={edgePath(track, halfW + 0.3)} fill="none" stroke="#f4f1e6" strokeWidth={0.7} />

      {/* infield: grass hole + mown rings + hedge ring + shrubs + tufts, detailed
          pond (rim, ripples, lily pads, reeds, shimmering reflection), flowerbeds */}
      <path d={edgePath(track, -halfW - 1.3)} fill={isCircuit ? '#3f4a3c' : '#8fc25c'} stroke="none" />
      {/* concentric mown rings (lawn texture) */}
      <g opacity={isCircuit ? 0 : 0.55}>{mowRings}</g>
      {/* flower-border planting inside the inner rail so the fence-to-pond ring isn't bare */}
      {!isCircuit && <g>{planting}</g>}
      {/* infield decor — desert=cacti, trail=pines, dirt=puddles(+bushes), else bushes */}
      {!isCircuit && <g>{theme.cacti ? cacti : theme.pines ? [...bushes, ...infieldPines] : bushes}</g>}
      {!isCircuit && theme.puddles && <g>{puddles}</g>}
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

      {/* inner rail — drawn last, on top of the infield/hedge, so it always reads as
          a clean white line (a soft shadow just inside gives it a little lift). */}
      <path d={edgePath(track, -halfW - 0.9)} fill="none" stroke="#000" strokeWidth={0.5} opacity={0.12} />
      <path d={edgePath(track, -halfW - 0.4)} fill="none" stroke="#fbfaf4" strokeWidth={1.2} strokeLinejoin="round" />
      <g>{innerPosts}</g>

      {/* furlong poles */}
      <g>{poles}</g>
    </>
  );
}
