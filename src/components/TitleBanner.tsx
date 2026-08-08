import type { TitleDef } from '../data/titles';
import BoxCrest from './BoxCrest';
import AnimalFace from './AnimalFace';
import styles from './TitleBanner.module.css';

// 称号の背景。段（tier）が上がるほど層が増える。
//  1 一色＋ふち影              … いちばん素朴
//  2 ＋斜めの帯                … 二色になって模様がつく
//  3 ＋ひし形の織り＋上のツヤ  … 「柄もの」だと分かる
//  4 ＋下からの放射＋金のふち  … 記章っぽくなる
//  5 ＋流れる光＋光の粒        … 動きはじめる
//  6 ＋オーロラ＋虹＋きらめき  … 別格
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
      {t >= 3 && <span className={styles.lattice} />}
      {t >= 3 && <span className={styles.gloss} />}
      {t >= 4 && <span className={styles.rays} />}
      {t >= 5 && <span className={styles.sheen} />}
      {t >= 5 && (
        <span className={styles.motes}>
          {[8, 24, 44, 63, 82, 94].map((x, i) => (
            <span key={x} style={{ left: `${x}%`, top: `${22 + ((i * 37) % 60)}%`, animationDelay: `${i * 0.45}s` }} />
          ))}
        </span>
      )}
      {t >= 6 && <span className={styles.aurora} />}
      {t >= 6 && <span className={styles.prism} />}
      {/* 週末ボックスの称号だけ、左端にフレームと同じ紋章（ウマの顔）を出す。
          並べたとき「同じイベントのもの」だと一目で分かるようにするため。 */}
      {title.crest && (
        <span className={styles.crest}>
          <svg viewBox="-16 -16 32 32" width="100%" height="100%">
            <BoxCrest box={title.crest} uid={`tb-${title.id}`} r={14} />
          </svg>
        </span>
      )}
      {/* ショップの称号は、フレームと同じ動物の顔を左端に出す。 */}
      {title.animal && (
        <span className={styles.crest}>
          <svg viewBox="-16 -16 32 32" width="100%" height="100%">
            <AnimalFace id={title.animal} uid={`tb-${title.id}`} r={14} />
          </svg>
        </span>
      )}
      {t >= 6 && (
        <span className={styles.sparks}>
          {[12, 30, 52, 71, 88].map((x, i) => (
            <span key={x} style={{ left: `${x}%`, top: `${18 + (i % 3) * 22}%`, animationDelay: `${i * 0.5}s` }} />
          ))}
        </span>
      )}
      {/* ふち。4段から金、6段は虹がかった金。下の段は控えめな影だけ。 */}
      <span className={styles.edge} />
    </div>
  );
}
