import { useStore } from '../store';
import { colorsBySlot, decosBySlot } from '../data/parts';
import type { ColorPart, DecoPart, Rarity } from '../types';
import PartThumb from '../components/PartThumb';
import HorseView from '../components/HorseView';
import styles from './Collection.module.css';

type Entry = { id: string; name: string; rarity: Rarity };

const SECTIONS: { title: string; entries: Entry[] }[] = [
  { title: 'ボディカラー', entries: colorsBySlot.body },
  { title: 'たてがみカラー', entries: colorsBySlot.mane },
  { title: 'ひづめカラー', entries: colorsBySlot.hoof },
  { title: '頭', entries: decosBySlot.head },
  { title: '顔', entries: decosBySlot.face },
  { title: '背中', entries: decosBySlot.back },
  { title: 'しっぽ', entries: decosBySlot.tail },
].map((s) => ({
  title: s.title,
  entries: (s.entries as (ColorPart | DecoPart)[]).map((p) => ({
    id: p.id,
    name: p.name,
    rarity: p.rarity,
  })),
}));

const TOTAL = SECTIONS.reduce((n, s) => n + s.entries.length, 0);

// A blank horse used purely as a black silhouette behind the "?" for unowned parts.
const BLANK = { id: 'blank', name: '', colors: { body: '', mane: '', hoof: '' }, decos: {}, createdAt: 0 };

export default function Collection() {
  const owned = useStore((s) => s.owned);
  const ownedTotal = SECTIONS.reduce(
    (n, s) => n + s.entries.filter((e) => (owned[e.id] ?? 0) > 0).length,
    0,
  );
  const pct = Math.round((ownedTotal / TOTAL) * 100);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>ずかん</h1>
        <div className={styles.progress}>
          <div className={styles.bar}>
            <div className={styles.fill} style={{ width: `${pct}%` }} />
          </div>
          <span className={styles.count}>
            {ownedTotal} / {TOTAL}
          </span>
        </div>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.title} className={styles.section}>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
          <div className={styles.grid}>
            {section.entries.map((e) => {
              const count = owned[e.id] ?? 0;
              const has = count > 0;
              return (
                <div key={e.id} className={`${styles.cell} ${has ? '' : styles.locked}`}>
                  <div className={styles.thumb}>
                    {has ? (
                      <PartThumb id={e.id} size={78} />
                    ) : (
                      <div className={styles.silhouette}>
                        <HorseView horse={BLANK} size={78} />
                        <span className={styles.q}>?</span>
                      </div>
                    )}
                  </div>
                  {has ? (
                    <>
                      <div className={styles.name}>{e.name}</div>
                      <div className={styles.meta}>
                        <span className={`rarity rarity-${e.rarity}`}>{e.rarity}</span>
                        {count > 1 && <span className={styles.dup}>×{count}</span>}
                      </div>
                    </>
                  ) : (
                    <div className={styles.name}>？？？</div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
