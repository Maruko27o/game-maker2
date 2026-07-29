import { useState } from 'react';
import { SKILLS_BY_STAR, starChance, type SkillStar } from '../data/skills';
import Icon from './Icon';
import styles from './SkillBook.module.css';

// 固有スキル図鑑。星の段ごとに ▼ で開閉する。草むらの i ボタンから開く。
// 効果の文言は「予定」——レースの挙動にはまだつながっていないことを明記する。

function Stars({ n }: { n: SkillStar }) {
  return (
    <span className={styles.stars} aria-label={`星${n}`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={11} className={i < n ? styles.starOn : styles.starOff} />
      ))}
    </span>
  );
}

export default function SkillBook({ onClose }: { onClose: () => void }) {
  // 最初はレアな段（星5・星4）だけ開いておく。
  const [open, setOpen] = useState<Record<number, boolean>>({ 5: true, 4: true });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="固有スキル図鑑">
        <div className={styles.head}>
          <h2 className={styles.title}>固有スキル図鑑</h2>
          <button className={styles.close} onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <p className={styles.lead}>
          ウマは生まれたときに、固有スキルを1つ持っています。星が多いほどレアです。
        </p>

        {SKILLS_BY_STAR.map(({ star, skills }) => {
          const isOpen = !!open[star];
          return (
            <section key={star} className={styles.group}>
              <button
                className={styles.groupHead}
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [star]: !o[star] }))}
              >
                <span className={styles.caret}>{isOpen ? '▼' : '▶'}</span>
                <Stars n={star} />
                <span className={styles.groupCount}>{skills.length}種</span>
                <span className={styles.groupChance}>出やすさ {(starChance(star) * 100).toFixed(0)}%</span>
              </button>
              {isOpen && (
                <ul className={styles.list}>
                  {skills.map((s) => (
                    <li key={s.id} className={styles.item}>
                      <span className={styles.name}>{s.name}</span>
                      <span className={styles.effect}>{s.effect}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        <p className={styles.note}>
          ※ 効果はこれから順番にレースへ反映していきます。いまは「どんなスキルがあるか」を
          見られる図鑑です。
        </p>
      </div>
    </div>
  );
}
