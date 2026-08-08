import type { HorseLook } from '../types';
import type { GalleryItem } from '../logic/gallery';
import { titleById } from '../data/titles';
import { BADGES, BADGE_VIEWBOX } from '../data/badges';
import EquippedFrame from './EquippedFrame';
import TitleBanner from './TitleBanner';
import TrophyIcon from './TrophyIcon';
import styles from './GalleryShelf.module.css';

// ギャラリー（飾り棚）の中身を並べる部品。
//
// 自分のプロフィールでも、他の人の個人ページでも**同じ見た目**にしたいので、
// 描くところはここ1つにまとめてある（2つに分けると、片方だけ直して食い違う）。
//
// 称号は横長・フレームは正方形と形が違うので、称号だけ2列ぶんの幅を取る。
export default function GalleryShelf({
  items,
  look,
  size = 54,
  onTap,
}: {
  items: GalleryItem[];
  /** フレームの中に描くウマ（その人のアイコン）。 */
  look: HorseLook;
  size?: number;
  /** 押せるようにする（自分の編集画面で使う）。 */
  onTap?: (item: GalleryItem) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className={styles.shelf}>
      {items.map((it, i) => {
        const key = `${it.k}-${i}`;
        const inner = <Cell item={it} look={look} size={size} />;
        return onTap ? (
          <button key={key} className={`${styles.cell} ${styles.tappable}`} onClick={() => onTap(it)} aria-label="はずす">
            {inner}
          </button>
        ) : (
          <div key={key} className={styles.cell}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function Cell({ item, look, size }: { item: GalleryItem; look: HorseLook; size: number }) {
  if (item.k === 'frame') {
    return (
      <span className={styles.frameBox}>
        <EquippedFrame frame={item.frame} look={look} size={size} />
      </span>
    );
  }
  if (item.k === 'title') {
    const t = titleById[item.id];
    if (!t) return null;
    return (
      <span className={styles.titleBox} style={{ height: size * 0.62 }}>
        {/* TitleBanner は position:absolute で親いっぱいに広がるので、
            必ず高さを決めた入れものに入れる。 */}
        <TitleBanner title={t} />
        <span className={styles.titleName}>{t.name}</span>
      </span>
    );
  }
  if (item.k === 'trophy') {
    return (
      <span className={styles.iconBox}>
        <TrophyIcon rank={item.rank} size={size * 0.82} />
      </span>
    );
  }
  const b = (BADGES as Record<string, { name: string; inner: string }>)[item.id];
  if (!b) return null;
  return (
    <span className={styles.iconBox}>
      <svg viewBox={BADGE_VIEWBOX} width={size * 0.82} height={size * 0.82} role="img" aria-label={b.name}>
        <g dangerouslySetInnerHTML={{ __html: b.inner }} />
      </svg>
    </span>
  );
}
