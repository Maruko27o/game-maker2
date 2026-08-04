import type { TitleDef } from '../data/titles';
import styles from './TitleBanner.module.css';

// 称号の背景。段（tier）が上がるほど作り込みが増える：
//  1 一色 → 2 二色＋斜めの帯 → 3 グラデ＋ストライプ → 4 ＋放射
//  5 ＋流れる光（動く） → 6 オーロラ＋きらめき（動く）
// 「簡単なのに一番派手」が起きないよう、難しさと見た目の格を必ず揃える。
export default function TitleBanner({ title, className }: { title: TitleDef; className?: string }) {
  const [c1, c2] = title.colors;
  const t = title.tier;
  return (
    <div
      className={`${styles.banner} ${styles[`t${t}`]} ${className ?? ''}`}
      style={{ ['--c1' as string]: c1, ['--c2' as string]: c2 }}
      aria-hidden
    >
      {t >= 2 && <span className={styles.stripes} />}
      {t >= 4 && <span className={styles.rays} />}
      {t >= 5 && <span className={styles.sheen} />}
      {t >= 6 && <span className={styles.aurora} />}
      {t >= 6 && (
        <span className={styles.sparks}>
          {[12, 30, 52, 71, 88].map((x, i) => (
            <span key={x} style={{ left: `${x}%`, top: `${18 + (i % 3) * 22}%`, animationDelay: `${i * 0.5}s` }} />
          ))}
        </span>
      )}
    </div>
  );
}
