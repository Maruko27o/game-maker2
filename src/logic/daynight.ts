// 昼→夕→夜→朝の1サイクルを phase(0..1) で表す純粋ロジック。タイトル画面と
// 草むら画面で共有する。sky は day/sunset/night 3レイヤの重み（重ねてクロスフェード）。
// 位置は % 指定（left/top）。太陽・月・星・馬への光・影・タイトル発光を返す。

export type SkyWeights = { day: number; sunset: number; night: number };

export type DayNight = {
  sky: SkyWeights;
  sunX: number; sunY: number; sunScale: number; sunOp: number; // % / 倍率 / 0..1
  moonX: number; moonY: number; moonOp: number;
  starOp: number; // 星のまたたきレイヤの不透明度
  lightStrength: number; // 馬を照らす暖色光の強さ 0..1
  lightWarm: number; // 0=夕日オレンジ 1=夜のゴールド
  shadowDx: number; shadowAlpha: number; shadowBlur: number; // 接地影
  titleGlow: number; // タイトル文字の発光 0..1
  nightMix: number; // 夜寄せ度（丘や地面のトーン調整に）
};

type KF = DayNight & { p: number };

// 1周のキーフレーム（真昼→夕→夜→夜明け→真昼）。
// 重要：太陽と月は同時に見えない。太陽は日没で完全に沈み(sunOp→0)、その後に月が昇る
// (moonOp>0 は sunOp==0 のときだけ)。夜明け前に月が沈んでから太陽が昇る。
const KEYS: KF[] = [
  { p: 0.00, sky: { day: 1, sunset: 0, night: 0 },       sunX: 76, sunY: 15,  sunScale: 1.0,  sunOp: 1, moonX: 66, moonY: 20, moonOp: 0,   starOp: 0,   lightStrength: 0,    lightWarm: 0,   shadowDx: 0,   shadowAlpha: 0.22, shadowBlur: 6,  titleGlow: 0,    nightMix: 0 },
  { p: 0.15, sky: { day: 0.25, sunset: 0.75, night: 0 }, sunX: 68, sunY: 52,  sunScale: 1.2,  sunOp: 1, moonX: 66, moonY: 20, moonOp: 0,   starOp: 0,   lightStrength: 0.45, lightWarm: 0,   shadowDx: 30,  shadowAlpha: 0.30, shadowBlur: 8,  titleGlow: 0.28, nightMix: 0.05 },
  { p: 0.24, sky: { day: 0, sunset: 0.8, night: 0.2 },   sunX: 60, sunY: 84,  sunScale: 1.15, sunOp: 0, moonX: 66, moonY: 20, moonOp: 0,   starOp: 0.3, lightStrength: 0.5,  lightWarm: 0.3, shadowDx: 16,  shadowAlpha: 0.34, shadowBlur: 9,  titleGlow: 0.5,  nightMix: 0.4 },
  { p: 0.36, sky: { day: 0, sunset: 0.2, night: 0.8 },   sunX: 55, sunY: 112, sunScale: 1.0,  sunOp: 0, moonX: 66, moonY: 22, moonOp: 0.5, starOp: 0.7, lightStrength: 0.6,  lightWarm: 0.7, shadowDx: 6,   shadowAlpha: 0.40, shadowBlur: 9,  titleGlow: 0.75, nightMix: 0.85 },
  { p: 0.50, sky: { day: 0, sunset: 0, night: 1 },       sunX: 50, sunY: 120, sunScale: 1.0,  sunOp: 0, moonX: 72, moonY: 15, moonOp: 1,   starOp: 1,   lightStrength: 0.72, lightWarm: 1,   shadowDx: 0,   shadowAlpha: 0.45, shadowBlur: 10, titleGlow: 1,    nightMix: 1 },
  { p: 0.64, sky: { day: 0, sunset: 0.15, night: 0.85 }, sunX: 45, sunY: 120, sunScale: 1.0,  sunOp: 0, moonX: 80, moonY: 24, moonOp: 0.5, starOp: 0.7, lightStrength: 0.55, lightWarm: 0.8, shadowDx: -8,  shadowAlpha: 0.40, shadowBlur: 9,  titleGlow: 0.75, nightMix: 0.85 },
  { p: 0.74, sky: { day: 0, sunset: 0.7, night: 0.3 },   sunX: 34, sunY: 90,  sunScale: 1.0,  sunOp: 0, moonX: 88, moonY: 40, moonOp: 0,   starOp: 0.3, lightStrength: 0.45, lightWarm: 0.4, shadowDx: -14, shadowAlpha: 0.34, shadowBlur: 8,  titleGlow: 0.45, nightMix: 0.4 },
  { p: 0.86, sky: { day: 0.2, sunset: 0.8, night: 0 },   sunX: 28, sunY: 54,  sunScale: 1.1,  sunOp: 1, moonX: 88, moonY: 40, moonOp: 0,   starOp: 0.05, lightStrength: 0.45, lightWarm: 0,  shadowDx: -28, shadowAlpha: 0.30, shadowBlur: 8,  titleGlow: 0.2,  nightMix: 0.05 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** phase(0..1, 巡回) を昼夜パラメータへ補間する。 */
export function sampleDayNight(phase: number): DayNight {
  let p = phase % 1;
  if (p < 0) p += 1;
  // 巡回のため末尾に先頭(p=1.0)を足した並びで区間を探す。
  const last: KF = { ...KEYS[0], p: 1.0 };
  const seq = [...KEYS, last];
  let i = 0;
  while (i < seq.length - 1 && p > seq[i + 1].p) i++;
  const a = seq[i];
  const b = seq[i + 1];
  const span = b.p - a.p || 1;
  const t = (p - a.p) / span;
  return {
    sky: {
      day: lerp(a.sky.day, b.sky.day, t),
      sunset: lerp(a.sky.sunset, b.sky.sunset, t),
      night: lerp(a.sky.night, b.sky.night, t),
    },
    sunX: lerp(a.sunX, b.sunX, t),
    sunY: lerp(a.sunY, b.sunY, t),
    sunScale: lerp(a.sunScale, b.sunScale, t),
    sunOp: lerp(a.sunOp, b.sunOp, t),
    moonX: lerp(a.moonX, b.moonX, t),
    moonY: lerp(a.moonY, b.moonY, t),
    moonOp: lerp(a.moonOp, b.moonOp, t),
    starOp: lerp(a.starOp, b.starOp, t),
    lightStrength: lerp(a.lightStrength, b.lightStrength, t),
    lightWarm: lerp(a.lightWarm, b.lightWarm, t),
    shadowDx: lerp(a.shadowDx, b.shadowDx, t),
    shadowAlpha: lerp(a.shadowAlpha, b.shadowAlpha, t),
    shadowBlur: lerp(a.shadowBlur, b.shadowBlur, t),
    titleGlow: lerp(a.titleGlow, b.titleGlow, t),
    nightMix: lerp(a.nightMix, b.nightMix, t),
  };
}

/** 経過時刻から巡回 phase を得る（草むら：既定1時間で一周）。 */
export function clockPhase(nowMs: number, periodMs: number): number {
  return (nowMs % periodMs) / periodMs;
}

// 3つの空レイヤ用グラデーション（重ねて重みで表示）。
export const SKY_DAY = 'linear-gradient(180deg,#7ec8ef 0%,#b6e1ef 45%,#d3ecc0 80%,#c5e3a0 100%)';
export const SKY_SUNSET = 'linear-gradient(180deg,#3b4a8c 0%,#7d63ad 20%,#e8896b 50%,#f6b56a 74%,#f4cf8f 100%)';
export const SKY_NIGHT = 'linear-gradient(180deg,#0c1230 0%,#1a2148 45%,#2b2f57 82%,#34365f 100%)';

/** 馬を照らす暖色光の色（夕=オレンジ→夜=ゴールドを lightWarm で補間）。 */
export function lightPool(d: DayNight): string {
  const r = Math.round(lerp(255, 255, d.lightWarm));
  const g = Math.round(lerp(170, 225, d.lightWarm));
  const b = Math.round(lerp(90, 150, d.lightWarm));
  const a = (d.lightStrength * 0.3).toFixed(3);
  return `radial-gradient(58% 50% at 50% 68%, rgba(${r},${g},${b},${a}), transparent 72%)`;
}

/** 馬本体に軽く乗せる発光フィルタ（夜ほど強い）。 */
export function horseGlowFilter(d: DayNight): string | undefined {
  if (d.lightStrength < 0.05) return undefined;
  const glow = (d.lightStrength * 6).toFixed(1);
  const bright = (1 - d.nightMix * 0.12).toFixed(3);
  return `brightness(${bright}) drop-shadow(0 0 ${glow}px rgba(255,225,150,${(d.lightStrength * 0.4).toFixed(3)}))`;
}
