import { describe, it, expect } from 'vitest';
import { randomUsername, normalizeUsername } from './username';
import { mulberry32 } from './stats';

describe('username', () => {
  it('generates a non-empty, reasonably short default name', () => {
    for (let s = 0; s < 30; s++) {
      const n = randomUsername(mulberry32(s + 1));
      expect(n.length).toBeGreaterThan(0);
      expect(n.length).toBeLessThanOrEqual(32);
      expect(/\d{3}$/.test(n)).toBe(true); // ends with a 3-digit number
    }
  });

  it('is deterministic for a seeded rng', () => {
    expect(randomUsername(mulberry32(7))).toBe(randomUsername(mulberry32(7)));
  });

  it('normalizes: trims and clamps to 32 chars', () => {
    expect(normalizeUsername('  なまえ  ')).toBe('なまえ');
    expect(normalizeUsername('あ'.repeat(50)).length).toBe(32);
  });
});
