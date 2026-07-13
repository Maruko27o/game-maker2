// Structured base-horse geometry for the animated race renderer (RACE.md §10).
// Mirrors assets/horse_base.svg but split so legs/head can be transformed
// independently. The static HorseView still injects the raw SVG; only the race
// needs this decomposition.

export type LegDef = {
  id: string;
  leg: string; // path d for the leg (fill var(--body))
  hoof: string; // path d for the hoof (fill var(--hoof))
  cx: number; // rotation center (hip)
  cy: number;
  offset: number; // gait phase offset
  amp: number; // swing amplitude in degrees
  layer: 'far' | 'near';
};

export const LEGS: LegDef[] = [
  { id: 'front-near', leg: 'M 290,285 L 332,285 L 328,360 L 332,432 L 294,432 L 292,360 Z', hoof: 'M 290,428 L 336,428 L 336,460 L 290,460 Z', cx: 310, cy: 288, offset: 0.0, amp: 22, layer: 'near' },
  { id: 'back-near', leg: 'M 150,288 L 192,288 L 188,360 L 192,432 L 152,432 L 152,360 Z', hoof: 'M 148,428 L 194,428 L 194,460 L 148,460 Z', cx: 170, cy: 290, offset: 0.5, amp: 26, layer: 'near' },
  { id: 'front-far', leg: 'M 258,290 L 290,290 L 288,360 L 292,432 L 262,432 L 258,360 Z', hoof: 'M 260,428 L 294,428 L 294,458 L 260,458 Z', cx: 274, cy: 292, offset: 0.12, amp: 22, layer: 'far' },
  { id: 'back-far', leg: 'M 182,285 L 214,285 L 212,360 L 216,432 L 186,432 L 182,360 Z', hoof: 'M 184,428 L 218,428 L 218,458 L 184,458 Z', cx: 198, cy: 288, offset: 0.62, amp: 26, layer: 'far' },
];

// Torso pieces drawn between the far and near legs.
export const MIDBODY = `
  <path id="tail" fill="var(--mane,#fff)" d="M 140,230 C 100,214 74,242 67,292 C 60,344 78,382 96,398 C 88,352 90,300 112,270 C 123,254 133,247 142,262 Z"/>
  <ellipse id="body" fill="var(--body,#fff)" cx="230" cy="265" rx="105" ry="72"/>
  <ellipse id="belly" fill="#ffffff" stroke="none" cx="238" cy="312" rx="66" ry="20"/>
  <ellipse id="body-outline" fill="none" cx="230" cy="265" rx="105" ry="72"/>`;

// Neck rotates with the head group (same pivot).
export const NECK = `<path id="neck" fill="var(--body,#fff)" d="M 263,214 C 284,160 324,124 366,102 L 396,150 C 361,176 331,216 321,264 Z"/>`;

// Head cluster (rotates around HEAD_PIVOT).
export const HEAD = `
  <path id="mane" fill="var(--mane,#fff)" d="M 258,212 C 282,155 322,120 364,99 L 382,120 C 341,142 301,182 279,232 Z"/>
  <path id="ear" fill="var(--body,#fff)" d="M 386,90 L 377,50 L 410,82 Z"/>
  <path id="head" fill="var(--body,#fff)" d="M 355,152 C 344,110 366,84 401,85 L 431,100 C 456,111 478,126 478,146 C 478,166 460,177 440,173 L 400,166 C 375,163 361,161 355,152 Z"/>
  <ellipse id="muzzle" fill="#ffffff" stroke="none" cx="452" cy="152" rx="24" ry="15"/>
  <circle id="eye" fill="#2b2118" stroke="none" cx="404" cy="122" r="8"/>
  <circle id="nostril" fill="#2b2118" stroke="none" cx="462" cy="149" r="4.5"/>`;

export const HEAD_PIVOT = { x: 300, y: 230 };
export const STROKE = { color: '#2b2118', width: 8 };
