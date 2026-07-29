import type { Entrant } from '../logic/raceSim2';
import type { StatKey } from '../types';
import { STAT_KEYS, STAT_LABEL, RUN_STYLE_LABEL } from '../types';
import { statTotal } from '../logic/stats';
import { SKILL_BY_ID } from '../data/skills';
import { GRADE_STYLE } from '../data/aptitude';
import { MOODS, type MoodLevel } from '../logic/mood';
import StatRadar from './StatRadar';
import MoodFace from './MoodFace';
import Icon from './Icon';
import styles from './HorseStatsPopup.module.css';

type Props = {
  entrant: Entrant;
  gate: number; // 馬番（ゼッケン）
  mood?: MoodLevel; // パドックだけ。レース中・払戻では出さない
  onClose: () => void;
};

// 出走ウマの能力ポップアップ。パドック・レース中の順位カード・払戻画面の着順の
// どこから開いても同じ中身を出す（賭ける前も、走っている最中も、終わってからも
// 同じ判断材料が見られるように）。
export default function HorseStatsPopup({ entrant: e, gate, mood, onClose }: Props) {
  const skill = e.skill ? SKILL_BY_ID[e.skill] : undefined;
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.card} onClick={(ev) => ev.stopPropagation()} role="dialog" aria-label="能力">
        <div className={styles.head}>
          <span className={styles.gate}>{gate}</span>
          <span className={styles.title}>{e.isPlayer ? 'あなた' : e.name}</span>
          <button className={styles.close} onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <div className={styles.body}>
          <StatRadar stats={e.stats} size={150} />
          <div className={styles.meta}>
            <div className={styles.chipRow}>
              <span className={styles.styleChip}>{RUN_STYLE_LABEL[e.style]}</span>
              <span className={styles.totalChip}>合計 {statTotal(e.stats)}</span>
              {e.apt && (
                <span
                  className={styles.aptChip}
                  style={{ background: GRADE_STYLE[e.apt].background, color: GRADE_STYLE[e.apt].ink, borderColor: GRADE_STYLE[e.apt].border }}
                  title={`このコースの適性 ${e.apt}`}
                >
                  適性 {e.apt}
                </span>
              )}
              {mood != null && (
                <span className={styles.moodChip} style={{ background: MOODS[mood].color, color: MOODS[mood].ink }}>
                  <MoodFace level={mood} size={16} title={false} /> {MOODS[mood].label}
                </span>
              )}
            </div>

            {skill && (
              <div className={styles.skillLine}>
                <span className={styles.skillName}>{skill.name}</span>
                <span className={styles.skillStars}>
                  {Array.from({ length: 5 }).map((_, si) => (
                    <Icon key={si} name="star" size={10} className={si < skill.star ? styles.starOn : styles.starOff} />
                  ))}
                </span>
                <span className={styles.skillEffect}>{skill.effect}</span>
              </div>
            )}

            <dl className={styles.nums}>
              {STAT_KEYS.map((k: StatKey) => (
                <div key={k}>
                  <dt>{STAT_LABEL[k]}</dt>
                  <dd>{e.stats[k]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
