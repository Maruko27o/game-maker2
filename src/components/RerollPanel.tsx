import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { COURSES } from '../data/courses';
import { GRADE_STYLE, type Grade } from '../data/aptitude';
import { skillOf } from '../logic/skill';
import { aptitudeOf } from '../logic/aptitude';
import { rerollState, rightsBreakdown, SKILL_SLOT } from '../logic/reroll';
import type { Horse } from '../types';
import Icon from './Icon';
import styles from './RerollPanel.module.css';

// 厳選：固有スキル1枠＋コース6枠のうち、「更新する」と選んだ枠だけをまとめて引き直す。
// 選ばなかった枠は確定のまま動かないので、良い枠を残しながら回数を使える。
// 対象は既存ウマだけ（新世代は草むらで何頭でも召喚できること自体が厳選になるため）。

function Stars({ n }: { n: number }) {
  return (
    <span className={styles.stars}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name="star" size={10} className={i < n ? styles.starOn : styles.starOff} />
      ))}
    </span>
  );
}

export default function RerollPanel({ horse, onClose }: { horse: Horse; onClose: () => void }) {
  const trophies = useStore((s) => s.trophies);
  const badges = useStore((s) => s.badges);
  const rerollHorse = useStore((s) => s.rerollHorse);
  const finishReroll = useStore((s) => s.finishReroll);

  const [picked, setPicked] = useState<Set<string>>(new Set()); // 「更新する」と選んだ枠
  const [changed, setChanged] = useState<Set<string>>(new Set()); // 直前の振り直しで変わった枠
  const [showRights, setShowRights] = useState(false);

  const st = rerollState(horse, trophies, badges);
  const skill = skillOf(horse);
  const apt = aptitudeOf(horse);
  const breakdown = useMemo(
    () => rightsBreakdown(st.trophyCount, st.badgeCount),
    [st.trophyCount, st.badgeCount],
  );

  function toggle(slot: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  function doReroll() {
    if (picked.size === 0 || st.left <= 0) return;
    const before = { skill: skill.id, apt: { ...apt } };
    if (!rerollHorse(horse.id, [...picked])) return;
    // 変わった枠を光らせる（store 更新後の値は次のレンダーで入る）
    const after = useStore.getState().horses.find((h) => h.id === horse.id);
    const nextChanged = new Set<string>();
    if (after) {
      if (picked.has(SKILL_SLOT) && after.skill !== before.skill) nextChanged.add(SKILL_SLOT);
      for (const c of COURSES) {
        if (picked.has(c.id) && after.apt?.[c.id] !== before.apt[c.id]) nextChanged.add(c.id);
      }
    }
    setChanged(nextChanged);
    setPicked(new Set()); // 引き直したら選択はリセット（結果を見てから選び直す）
  }

  const rows: { slot: string; label: string; value: React.ReactNode }[] = [
    {
      slot: SKILL_SLOT,
      label: '固有スキル',
      value: (
        <span className={styles.skillVal}>
          <span className={styles.skillName}>{skill.name}</span>
          <Stars n={skill.star} />
        </span>
      ),
    },
    ...COURSES.map((c) => {
      const g = apt[c.id] as Grade;
      const gs = GRADE_STYLE[g];
      return {
        slot: c.id,
        label: c.name,
        value: (
          <span
            className={styles.gradeChip}
            style={{ background: gs.background, color: gs.ink, borderColor: gs.border }}
          >
            {g}
          </span>
        ),
      };
    }),
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="厳選">
        <div className={styles.head}>
          <h2 className={styles.title}>厳選</h2>
          <button className={styles.close} onClick={onClose} aria-label="閉じる">✕</button>
        </div>

        <div className={styles.countRow}>
          <span className={styles.countLabel}>のこり</span>
          <span className={styles.countBig}>{st.left}</span>
          <span className={styles.countSub}>/ {st.rights}回</span>
          <button className={styles.rightsBtn} onClick={() => setShowRights((v) => !v)} aria-expanded={showRights}>
            回数のふえ方
          </button>
        </div>

        {showRights && (
          <ul className={styles.rightsList}>
            {breakdown.map((b) => (
              <li key={b.label} className={b.got ? styles.rightGot : styles.rightMiss}>
                <span>{b.got ? '✓' : '−'}</span>
                <span className={styles.rightLabel}>{b.label}</span>
                <span className={styles.rightPlus}>＋{b.plus}回</span>
              </li>
            ))}
            <li className={styles.rightsNote}>
              いまのトロフィー {st.trophyCount}個 ・ バッジ {st.badgeCount}枚
            </li>
          </ul>
        )}

        <p className={styles.lead}>
          いまの内容は<strong>すべて確定</strong>しています。引き直したい枠だけ「更新する」を
          選んで、まとめて振り直してください。選ばなかった枠はそのまま残ります。
        </p>

        <ul className={styles.rows}>
          {rows.map((r) => {
            const on = picked.has(r.slot);
            const justChanged = changed.has(r.slot);
            return (
              <li key={r.slot} className={`${styles.row} ${on ? styles.rowOn : ''} ${justChanged ? styles.rowChanged : ''}`}>
                <span className={styles.rowLabel}>{r.label}</span>
                <span className={styles.rowValue}>{r.value}</span>
                <button
                  className={`${styles.pick} ${on ? styles.pickOn : ''}`}
                  onClick={() => toggle(r.slot)}
                  disabled={st.left <= 0}
                  aria-pressed={on}
                >
                  {on ? '更新する' : '確定'}
                </button>
              </li>
            );
          })}
        </ul>

        {changed.size > 0 && <p className={styles.changedNote}>光っている枠が今回変わったところです。</p>}

        <button className={styles.go} disabled={picked.size === 0 || st.left <= 0} onClick={doReroll}>
          {st.left <= 0
            ? '回数を使いきりました'
            : picked.size === 0
              ? '更新する枠を選んでね'
              : `${picked.size}枠を振り直す（のこり${st.left}回）`}
        </button>

        <button
          className={styles.finish}
          onClick={() => { finishReroll(horse.id); onClose(); }}
        >
          この内容で確定する{st.left > 0 ? `（のこり${st.left}回は使わない）` : ''}
        </button>

        <p className={styles.note}>
          ※ 振り直すと前の内容には戻せません。確定すると、回数が残っていても
          もう振り直せなくなります。
        </p>
      </div>
    </div>
  );
}
