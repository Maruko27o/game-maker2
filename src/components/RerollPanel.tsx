import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { COURSES } from '../data/courses';
import { GRADE_STYLE, type Grade } from '../data/aptitude';
import { skillOf } from '../logic/skill';
import { aptitudeOf } from '../logic/aptitude';
import { rerollState, rightsBreakdown, SKILL_SLOT, REROLL_COST } from '../logic/reroll';
import type { Horse } from '../types';
import Icon from './Icon';
import CoinIcon from './CoinIcon';
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
  const coins = useStore((s) => s.coins);
  const rerollHorse = useStore((s) => s.rerollHorse);
  const finishReroll = useStore((s) => s.finishReroll);

  const [picked, setPicked] = useState<Set<string>>(new Set()); // 「更新する」と選んだ枠
  const [changed, setChanged] = useState<Set<string>>(new Set()); // 直前の振り直しで変わった枠
  const [showRights, setShowRights] = useState(false);
  const [confirm, setConfirm] = useState<'reroll' | 'finish' | null>(null);

  const st = rerollState(horse, trophies, badges);
  const skill = skillOf(horse);
  const apt = aptitudeOf(horse);
  const breakdown = useMemo(
    () => rightsBreakdown(horse.id, st.trophyCount, st.badgeCount),
    [horse.id, st.trophyCount, st.badgeCount],
  );
  const poor = coins < REROLL_COST; // コインが足りないと振り直せない

  function toggle(slot: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  }

  function doReroll() {
    if (picked.size === 0 || st.left <= 0 || poor) return;
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
          引き直したい枠を<strong>タップして「✓振り直す」</strong>にしてください。
          「このまま」の枠は動きません。選び終えたら下のボタンでまとめて振り直します。
          <br />1回振り直すごとに <strong>{REROLL_COST.toLocaleString()}コイン</strong> かかります
          （いまの持ちコイン {coins.toLocaleString()}）。
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
                  <span className={styles.pickBox}>{on ? '✓' : ''}</span>
                  {on ? '振り直す' : 'このまま'}
                </button>
              </li>
            );
          })}
        </ul>

        {changed.size > 0 && <p className={styles.changedNote}>光っている枠が今回変わったところです。</p>}

        <button
          className={styles.go}
          disabled={picked.size === 0 || st.left <= 0 || poor}
          onClick={() => setConfirm('reroll')}
        >
          {st.left <= 0
            ? '回数を使いきりました'
            : poor
              ? `コインが足りません（${REROLL_COST.toLocaleString()}コイン必要）`
              : picked.size === 0
                ? '振り直す枠を選んでね'
                : `${picked.size}枠を振り直す（${REROLL_COST.toLocaleString()}コイン・のこり${st.left}回）`}
        </button>

        <button className={styles.finish} onClick={() => setConfirm('finish')}>
          この内容で確定する{st.left > 0 ? `（のこり${st.left}回は使わない）` : ''}
        </button>

        {/* 確認ダイアログ：何がどうなるかを出してから実行する */}
        {confirm && (
          <div className={styles.confirmWrap} onClick={() => setConfirm(null)}>
            <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
              {confirm === 'reroll' ? (
                <>
                  <p className={styles.confirmTitle}>この{picked.size}枠を振り直します</p>
                  <ul className={styles.confirmList}>
                    {rows.filter((r) => picked.has(r.slot)).map((r) => (
                      <li key={r.slot} className={styles.confirmItem}>
                        <span className={styles.confirmLabel}>{r.label}</span>
                        <span className={styles.confirmNow}>いま</span>
                        <span className={styles.rowValue}>{r.value}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.confirmWarn}>
                    今の内容には<strong>戻せません</strong>。悪くなることもあります。
                    <br />のこり回数：{st.left} → {st.left - 1}
                    <br />
                    <span className={styles.confirmCost}>
                      <CoinIcon size={14} /> {REROLL_COST.toLocaleString()} つかいます（{coins.toLocaleString()} →{' '}
                      {(coins - REROLL_COST).toLocaleString()}）
                    </span>
                  </p>
                </>
              ) : (
                <>
                  <p className={styles.confirmTitle}>この内容で確定します</p>
                  <p className={styles.confirmWarn}>
                    確定すると、のこり<strong>{st.left}回</strong>があっても
                    <strong>もう振り直せません</strong>。
                  </p>
                </>
              )}
              <div className={styles.confirmActions}>
                <button className={styles.confirmNo} onClick={() => setConfirm(null)}>やめる</button>
                <button
                  className={styles.confirmYes}
                  onClick={() => {
                    if (confirm === 'reroll') { doReroll(); setConfirm(null); }
                    else { finishReroll(horse.id); setConfirm(null); onClose(); }
                  }}
                >
                  {confirm === 'reroll' ? '振り直す' : '確定する'}
                </button>
              </div>
            </div>
          </div>
        )}

        <p className={styles.note}>
          ※ 振り直すと前の内容には戻せません。確定すると、回数が残っていても
          もう振り直せなくなります。ベース回数はウマごとに1〜3回で決まっています。
        </p>
      </div>
    </div>
  );
}
