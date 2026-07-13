import raw from './courses.json';
import type { Stats } from '../types';
import { lapLength, type Track } from '../logic/track';

export type Surface = 'turf' | 'dirt' | 'sand' | 'trail' | 'circuit' | 'steeple';

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
  distance30: number; // legacy (v1 sim)
  distance60: number; // legacy (v1 sim)
  track: Track; // v2 oval geometry
  laps30: number; // v2 laps for 30s mode
  laps60: number; // v2 laps for 60s mode
  desc: string;
};

export const COURSES = raw as Course[];

export function courseById(id: string): Course {
  return COURSES.find((c) => c.id === id) ?? COURSES[0];
}

export function courseDistance(course: Course, mode: 30 | 60): number {
  return mode === 30 ? course.distance30 : course.distance60;
}

// Goal line sits just past the gate, clockwise (RACE_V2 §3.4).
export function goalS(course: Course): number {
  return lapLength(course.track) * 0.12;
}

/** Total centerline distance to the finish for a mode (v2). */
export function raceDistanceS(course: Course, mode: 30 | 60): number {
  const laps = mode === 30 ? course.laps30 : course.laps60;
  return laps * lapLength(course.track) + goalS(course);
}
