import raw from './courses.json';
import type { Stats } from '../types';

export type Surface = 'turf' | 'dirt' | 'sand' | 'trail' | 'circuit';

export type Course = {
  id: string;
  name: string;
  emoji: string;
  surface: Surface;
  ground: string; // track fill color for the UI
  weights: Stats; // 0.6..1.4 per stat; effective stat = stat * weight
  obstacleDensity: number; // per 1000m
  boostDensity: number; // per 1000m
  difficulty: number; // 0..0.3, subtracted from jump success
  drag: number; // 0..0.25 surface resistance (reduced by pwr)
  distance30: number;
  distance60: number;
  desc: string;
};

export const COURSES = raw as Course[];

export function courseById(id: string): Course {
  return COURSES.find((c) => c.id === id) ?? COURSES[0];
}

export function courseDistance(course: Course, mode: 30 | 60): number {
  return mode === 30 ? course.distance30 : course.distance60;
}
