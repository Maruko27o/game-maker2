import { describe, it, expect } from 'vitest';
import { centerline, toWorld, lapLength, groundPerLap, heading, type Track } from './track';

const T: Track = { straight: 120, radius: 70, width: 22 };

describe('track geometry', () => {
  it('gate (s=0, d=0) sits at the right side (left-turn oval)', () => {
    const p = toWorld(T, 0, 0);
    expect(p.x).toBeCloseTo(T.straight / 2, 6);
    expect(p.y).toBeCloseTo(T.radius, 6);
  });

  it('runs counter-clockwise: shortly after the gate the horse curves upward (screen -y)', () => {
    // Leaving the gate at (L/2, +R) heading +x, a left turn sweeps toward -y.
    const a = toWorld(T, 0, 0);
    const b = toWorld(T, 5, 0);
    expect(b.y).toBeLessThan(a.y);
  });

  it('advancing s by one lap returns to the start', () => {
    const lap = lapLength(T);
    const a = toWorld(T, 0, 0);
    const b = toWorld(T, lap, 0);
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.y).toBeCloseTo(a.y, 6);
  });

  it('the centerline is continuous across segment joins', () => {
    const lap = lapLength(T);
    for (let i = 0; i < 400; i++) {
      const s = (i / 400) * lap;
      const p1 = toWorld(T, s, 0);
      const p2 = toWorld(T, s + 0.01, 0);
      const step = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      expect(step).toBeLessThan(0.02); // no jumps
    }
  });

  it('the tangent is a unit vector everywhere', () => {
    const lap = lapLength(T);
    for (let i = 0; i < 100; i++) {
      const c = centerline(T, (i / 100) * lap);
      expect(Math.hypot(c.tx, c.ty)).toBeCloseTo(1, 6);
      expect(Math.hypot(c.nx, c.ny)).toBeCloseTo(1, 6);
    }
  });

  it('inner lap is shorter than outer lap (Frenet distance correction)', () => {
    expect(groundPerLap(T, -8)).toBeLessThan(groundPerLap(T, 8));
    expect(groundPerLap(T, 0)).toBeCloseTo(lapLength(T), 6);
  });

  it('curvature is 1/R on corners and 0 on straights', () => {
    expect(centerline(T, 1).curvature).toBeCloseTo(1 / T.radius, 6); // early right corner
    const arc = Math.PI * T.radius;
    expect(centerline(T, arc + T.straight / 2).curvature).toBe(0); // mid bottom straight
  });

  it('heading turns smoothly (no discontinuity > 90° per meter)', () => {
    const lap = lapLength(T);
    let prev = heading(T, 0);
    for (let s = 0.5; s < lap; s += 0.5) {
      const h = heading(T, s);
      let diff = Math.abs(h - prev);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      expect(diff).toBeLessThan(Math.PI / 2);
      prev = h;
    }
  });
});
