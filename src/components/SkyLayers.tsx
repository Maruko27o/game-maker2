import type { DayNight } from '../logic/daynight';
import { SKY_DAY, SKY_SUNSET, SKY_NIGHT } from '../logic/daynight';
import styles from './SkyLayers.module.css';

// 昼夜サイクルの空。3レイヤの空をクロスフェードし、太陽・月・星・流れ星・鳥を重ねる。
// 親要素は position:relative / overflow:hidden 前提。純装飾（pointer-events:none）。

// 星の座標は固定（レイアウト揺れ防止）。上空 55% までにばらまく。
const STARS = Array.from({ length: 46 }, (_, i) => ({
  x: (i * 61.803) % 100,
  y: (i * 37.94) % 55,
  r: i % 6 === 0 ? 1.5 : 1,
  d: (i % 5) * 0.6, // twinkle delay
}));

// 太陽の色は高度で変化（高い＝黄色、地平線＝オレンジ）。
function sunBg(sunY: number): string {
  const t = Math.min(1, Math.max(0, (sunY - 15) / 60)); // 0=高い 1=低い
  const mid = t < 0.5 ? '#ffe479' : '#ffb15a';
  const edge = t < 0.5 ? '#ffd24d' : '#ff7d4a';
  return `radial-gradient(circle at 42% 38%, #fff6c8, ${mid} 55%, ${edge})`;
}

function birdTint(nightMix: number): string {
  const r = Math.round(70 + (200 - 70) * nightMix);
  const g = Math.round(70 + (210 - 70) * nightMix);
  const b = Math.round(85 + (235 - 85) * nightMix);
  const a = (0.7 - 0.2 * nightMix).toFixed(2);
  return `rgba(${r},${g},${b},${a})`;
}

function Birds({ tint, reduced }: { tint: string; reduced: boolean }) {
  // 数羽の小鳥がループで横切る（羽ばたきつき）。reduced のときは控えめに静止。
  const flock = [
    { top: '17%', dur: 26, delay: 0, scale: 1 },
    { top: '12%', dur: 34, delay: -12, scale: 0.75 },
    { top: '24%', dur: 30, delay: -20, scale: 0.9 },
  ];
  return (
    <div className={styles.birds} aria-hidden>
      {flock.map((f, i) => (
        <div
          key={i}
          className={reduced ? styles.birdStatic : styles.bird}
          style={{ top: f.top, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, transform: `scale(${f.scale})` }}
        >
          <svg width="34" height="14" viewBox="0 0 34 14" className={reduced ? '' : styles.flap}>
            <path d="M2 8 q6 -6 12 0 q6 -6 12 0" fill="none" stroke={tint} strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
      ))}
    </div>
  );
}

export default function SkyLayers({
  d,
  reduced,
  birds = true,
  shootingStars = true,
}: {
  d: DayNight;
  reduced: boolean;
  birds?: boolean;
  shootingStars?: boolean;
}) {
  const sum = d.sky.day + d.sky.sunset + d.sky.night || 1;
  return (
    <div className={styles.wrap} aria-hidden>
      <div className={styles.sky} style={{ background: SKY_DAY, opacity: d.sky.day / sum }} />
      <div className={styles.sky} style={{ background: SKY_SUNSET, opacity: d.sky.sunset / sum }} />
      <div className={styles.sky} style={{ background: SKY_NIGHT, opacity: d.sky.night / sum }} />

      {/* 星 */}
      <svg className={styles.stars} style={{ opacity: d.starOp }} viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r * 0.35} fill="#fff" className={reduced ? '' : styles.twinkle} style={{ animationDelay: `${s.d}s` }} />
        ))}
      </svg>

      {/* 流れ星（流星群・夜のみ・reduced では出さない） */}
      {shootingStars && !reduced && d.starOp > 0.08 && (
        <div className={styles.meteors} style={{ opacity: d.starOp }}>
          <span className={styles.meteor} style={{ top: '8%', left: '78%', animationDelay: '0s' }} />
          <span className={styles.meteor} style={{ top: '20%', left: '55%', animationDelay: '3.5s' }} />
          <span className={styles.meteor} style={{ top: '5%', left: '35%', animationDelay: '6.2s' }} />
        </div>
      )}

      {/* 月 */}
      <div
        className={styles.moon}
        style={{ left: `${d.moonX}%`, top: `${d.moonY}%`, opacity: d.moonOp }}
      />

      {/* 太陽 */}
      <div
        className={styles.sun}
        style={{
          left: `${d.sunX}%`,
          top: `${d.sunY}%`,
          opacity: d.sunOp,
          background: sunBg(d.sunY),
          transform: `translate(-50%,-50%) scale(${d.sunScale})`,
        }}
      />

      {/* 流れる雲（夜はフェード） */}
      <div className={styles.clouds} style={{ opacity: (1 - d.nightMix).toFixed(2) }}>
        <svg className={reduced ? styles.cloudAStatic : styles.cloudA} width="120" height="52" viewBox="0 0 120 52" style={{ top: '14%' }}>
          <g fill="#ffffff">
            <ellipse cx="42" cy="30" rx="34" ry="20" />
            <ellipse cx="70" cy="22" rx="26" ry="20" />
            <ellipse cx="18" cy="26" rx="22" ry="16" />
            <rect x="16" y="30" width="70" height="16" rx="8" />
          </g>
        </svg>
        <svg className={reduced ? styles.cloudBStatic : styles.cloudB} width="90" height="34" viewBox="0 0 90 34" style={{ top: '30%' }}>
          <g fill="#ffffff" opacity="0.92">
            <ellipse cx="40" cy="20" rx="26" ry="15" />
            <ellipse cx="62" cy="13" rx="20" ry="15" />
            <rect x="16" y="18" width="60" height="12" rx="6" />
          </g>
        </svg>
      </div>

      {birds && <Birds tint={birdTint(d.nightMix)} reduced={reduced} />}
    </div>
  );
}
