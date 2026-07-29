import { useState } from 'react';
import { SKILLS_BY_STAR, starChance, type SkillStar } from '../data/skills';
import { GRADES, GRADE_STYLE, gradeChance } from '../data/aptitude';
import { COURSES } from '../data/courses';
import Icon from './Icon';
import styles from './SkillBook.module.css';

// ウマのとくちょう図鑑（固有スキル＋コース適性）。段ごとに ▼ で開閉する。
// 草むらの i ボタンから開く。効果の文言は「予定」——レースの挙動にはまだ
// つながっていないことを明記する。

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
  const [open, setOpen] = useState<Record<string, boolean>>({ 5: true, 4: true, apt: true });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="ウマのとくちょう図鑑">
        <div className={styles.head}>
          <h2 className={styles.title}>ウマのとくちょう図鑑</h2>
          <button className={styles.close} onClick={onClose} aria-label="閉じる">✕</button>
        </div>
        <p className={styles.lead}>
          ウマは生まれたときに、固有スキルを1つと、6コースぶんの適性を持っています。
        </p>

        <h3 className={styles.sectionTitle}>固有スキル（{SKILLS_BY_STAR.reduce((n, g) => n + g.skills.length, 0)}種）</h3>
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

        {/* コース適性：どのコースが得意かは C/B/A/S の4段階。 */}
        <section className={styles.group}>
          <button
            className={styles.groupHead}
            aria-expanded={!!open.apt}
            onClick={() => setOpen((o) => ({ ...o, apt: !o.apt }))}
          >
            <span className={styles.caret}>{open.apt ? '▼' : '▶'}</span>
            <span className={styles.aptHeadTitle}>コース適性</span>
            <span className={styles.groupChance}>{COURSES.length}コース</span>
          </button>
          {open.apt && (
            <>
              <ul className={styles.list}>
                {GRADES.slice().reverse().map((g) => (
                  <li key={g} className={styles.gradeItem}>
                    <span
                      className={styles.gradeChip}
                      style={{ background: GRADE_STYLE[g].background, color: GRADE_STYLE[g].ink, borderColor: GRADE_STYLE[g].border }}
                    >
                      {g}
                    </span>
                    <span className={styles.name}>{GRADE_STYLE[g].label}</span>
                    <span className={styles.groupChance}>出やすさ {(gradeChance(g) * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
              <p className={styles.aptNote}>
                ウマは6つのコースそれぞれに適性を持ちます。S（虹）がいちばんレアです。
              </p>
            </>
          )}
        </section>

        <p className={styles.note}>
          ※ スキルと適性の効果は、これから順番にレースへ反映していきます。いまは「どんな
          とくちょうがあるか」を見られる図鑑です。
        </p>
      </div>
    </div>
  );
}
