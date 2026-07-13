// Post-race rewards (RACE.md §8, §9). Pure so it can be reasoned about/tested.
import type { Trophy, TrainingItem, StatKey } from '../types';
import { STAT_KEYS } from '../types';
import type { RNG } from './stats';

export function makeTrophy(
  horseId: string,
  rank: number,
  courseId: string,
  mode: 30 | 60,
  grade: 'normal' | 'gp',
): Trophy | null {
  if (rank > 3) return null;
  return {
    id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    horseId,
    rank: rank as 1 | 2 | 3,
    courseId,
    mode,
    grade,
    at: Date.now(),
  };
}

// GP item drops (RACE.md §9.1): 1st→2, 2nd/3rd→1, else 0; 60s mode ×1.5 floored.
export function itemDropCount(rank: number, mode: 30 | 60): number {
  let base = rank === 1 ? 2 : rank <= 3 ? 1 : 0;
  if (mode === 60) base = Math.floor(base * 1.5);
  return base;
}

export function rollItems(rng: RNG, count: number): TrainingItem[] {
  const out: TrainingItem[] = [];
  for (let i = 0; i < count; i++) {
    if (rng() < 0.1) {
      out.push({ kind: 'any' });
    } else {
      const stat = STAT_KEYS[Math.floor(rng() * STAT_KEYS.length)] as StatKey;
      out.push({ kind: 'stat', stat });
    }
  }
  return out;
}
