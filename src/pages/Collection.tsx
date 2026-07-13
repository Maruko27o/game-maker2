import { useState } from 'react';
import { useStore } from '../store';
import { colorsBySlot, decosBySlot } from '../data/parts';
import type { ColorPart, DecoPart, Rarity } from '../types';
import PartThumb from '../components/PartThumb';
import HorseView from '../components/HorseView';
import styles from './Collection.module.css';

type Entry = { id: string; name: string; rarity: Rarity };

const SECTIONS: { title: string; tab: string; entries: Entry[] }[] = [
  { title: 'ボディカラー', tab: 'ボディ', entries: colorsBySlot.body },
  { title: 'たてがみカラー', tab: 'たてがみ', entries: colorsBySlot.mane },
  { title: 'ひづめカラー', tab: 'ひづめ', entries: colorsBySlot.hoof },
  { title: '頭', tab: '頭', entries: decosBySlot.head },
  { title: '顔', tab: '顔', entries: decosBySlot.face },
  { title: '背中', tab: '背中', entries: decosBySlot.back },
  { title: 'しっぽ', tab: 'しっぽ', entries: decosBySlot.tail },
].map((s) => ({
  ...s,
  entries: (s.entries as (ColorPart | DecoPart)[]).map((p) => ({
    id: p.id,
    name: p.name,
    rarity: p.rarity,
  })),
}));

const TOTAL = SECTIONS.reduce((n, s) => n + s.entries.length, 0);

// A blank horse used purely as a black silhouette behind the "?" for unowned parts.
const BLANK = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

export default function Collection() {
  const owned = useStore((s) => s.owned);
  const [tab, setTab] = useState(0);

  const ownedIn = (entries: Entry[]) => entries.filter((e) => (owned[e.id] ?? 0) > 0).length;
  const ownedTotal = SECTIONS.reduce((n, s) => n + ownedIn(s.entries), 0);
  const pct = Math.round((ownedTotal / TOTAL) * 100);

  const section = SECTIONS[tab];

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

      <div className={styles.tabs} role="tablist" aria-label="図鑑のカテゴリ">
        {SECTIONS.map((s, i) => {
          const have = ownedIn(s.entries);
          const done = have === s.entries.length;
          return (
            <button
              key={s.tab}
              role="tab"
              aria-selected={i === tab}
              className={`${styles.tab} ${i === tab ? styles.tabActive : ''}`}
              onClick={() => setTab(i)}
            >
              <span className={styles.tabName}>{s.tab}</span>
              <span className={styles.tabCount}>
                {done ? '★' : ''}
                {have}/{s.entries.length}
              </span>
            </button>
          );
        })}
      </div>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{section.title}</h2>
        <div className={styles.grid}>
          {section.entries.map((e) => {
            const cnt = owned[e.id] ?? 0;
            const has = cnt > 0;
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
                      {cnt > 1 && <span className={styles.dup}>×{cnt}</span>}
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
    </div>
  );
}
