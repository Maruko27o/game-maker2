// Oval track geometry (RACE_V2 §3). A rounded-rectangle centerline described by
// Frenet coordinates: distance `s` along the centerline and lateral offset `d`.
// Counter-clockwise (左回り); gate at s=0 (right side). World coords are derived
// here and used only by the renderer — the simulation works purely in (s, d).

export type Track = {
  straight: number; // length of one straight (m)
  radius: number; // corner radius (m)
  width: number; // usable track width (m)
};

export type CenterPoint = {
  x: number;
  y: number;
  tx: number; // unit tangent (direction of travel)
  ty: number;
  nx: number; // unit normal pointing OUTWARD (toward the outer rail); +d = outer
  ny: number;
  curvature: number; // 1/radius on corners, 0 on straights
};

export function lapLength(t: Track): number {
  return 2 * t.straight + 2 * Math.PI * t.radius;
}

/** Arc-length (mod lap) of the finish line: the centre of the bottom (home)
 *  straight (RACE_V4 §2). The gate sits at s=0 = the bottom-right corner, where
 *  the home straight ends, so its centre is half a straight before the wrap. A
 *  race of N laps starts and finishes here — down the home straight, in view. */
export function goalS(t: Track): number {
  return lapLength(t) - t.straight / 2;
}

/** Ground distance to complete one lap while holding a constant offset `d`. */
export function groundPerLap(t: Track, d: number): number {
  return 2 * t.straight + 2 * Math.PI * (t.radius + d);
}

/** Point/frame on the centerline at arc-length `s` (wraps around the lap).
 *  Left-turn (左回り): the base geometry below is a right-turn oval, so we
 *  reflect it across the x-axis. Increasing s then curves left; the outward
 *  normal (+d = outer rail) and curvature magnitude are preserved. */
export function centerline(t: Track, s0: number): CenterPoint {
  const c = baseCenterline(t, s0);
  return { x: c.x, y: -c.y, tx: c.tx, ty: -c.ty, nx: c.nx, ny: -c.ny, curvature: c.curvature };
}

/** Base right-turn rounded-rectangle centerline (internal; see `centerline`). */
function baseCenterline(t: Track, s0: number): CenterPoint {
  const L = t.straight;
  const R = t.radius;
  const lap = lapLength(t);
  const arc = Math.PI * R;
  let s = ((s0 % lap) + lap) % lap;

  // Segment 1: right corner  [0, arc)  — center (L/2, 0)
  if (s < arc) {
    const phi = -Math.PI / 2 + s / R; // -90°..+90°
    return {
      x: L / 2 + R * Math.cos(phi),
      y: R * Math.sin(phi),
      tx: -Math.sin(phi),
      ty: Math.cos(phi),
      nx: Math.cos(phi),
      ny: Math.sin(phi),
      curvature: 1 / R,
    };
  }
  s -= arc;

  // Segment 2: bottom straight [0, L) — moving -x at y = +R
  if (s < L) {
    return { x: L / 2 - s, y: R, tx: -1, ty: 0, nx: 0, ny: 1, curvature: 0 };
  }
  s -= L;

  // Segment 3: left corner [0, arc) — center (-L/2, 0)
  if (s < arc) {
    const phi = Math.PI / 2 + s / R; // 90°..270°
    return {
      x: -L / 2 + R * Math.cos(phi),
      y: R * Math.sin(phi),
      tx: -Math.sin(phi),
      ty: Math.cos(phi),
      nx: Math.cos(phi),
      ny: Math.sin(phi),
      curvature: 1 / R,
    };
  }
  s -= arc;

  // Segment 4: top straight [0, L) — moving +x at y = -R
  return { x: -L / 2 + s, y: -R, tx: 1, ty: 0, nx: 0, ny: -1, curvature: 0 };
}

/** Frenet (s, d) -> world (x, y). d>0 is toward the outer rail. */
export function toWorld(t: Track, s: number, d: number): { x: number; y: number } {
  const c = centerline(t, s);
  return { x: c.x + d * c.nx, y: c.y + d * c.ny };
}

/** Heading (radians) of the centerline tangent at s — for orienting the horse. */
export function heading(t: Track, s: number): number {
  const c = centerline(t, s);
  return Math.atan2(c.ty, c.tx);
}

/** SVG path of the centerline (a rounded rectangle) in meter coordinates. */
export function centerlinePath(t: Track): string {
  const L = t.straight;
  const R = t.radius;
  return (
    `M ${-L / 2},${-R} L ${L / 2},${-R} ` +
    `A ${R},${R} 0 0 1 ${L / 2},${R} L ${-L / 2},${R} ` +
    `A ${R},${R} 0 0 1 ${-L / 2},${-R} Z`
  );
}

/** Bounds of the centerline in meter-space (for fitting the camera/viewport). */
export function trackBounds(t: Track): { minX: number; maxX: number; minY: number; maxY: number } {
  const halfW = t.width / 2;
  return {
    minX: -(t.straight / 2 + t.radius + halfW),
    maxX: t.straight / 2 + t.radius + halfW,
    minY: -(t.radius + halfW),
    maxY: t.radius + halfW,
  };
}
