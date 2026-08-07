import { useState } from 'react';
import { useStore } from '../store';
import { COURSES } from '../data/courses';
import { GRADE_STYLE, type Grade } from '../data/aptitude';
import { skillOf } from '../logic/skill';
import { aptitudeOf } from '../logic/aptitude';
import { SKILL_SLOT } from '../logic/reroll';
import { refineState, REFINE_MAX, REFINE_TICKET_COST } from '../logic/refine';
import type { Horse } from '../types';
import Icon from './Icon';
import styles from './RerollPanel.module.css';
import CloseButton from './CloseButton';

// 厳選：固有スキル1枠＋コース6枠のうち、「更新する」と選んだ枠だけをまとめて引き直す。
// 選ばなかった枠は確定のまま動かないので、良い枠を残しながら回数を使える。
//
// 全ウマ共通で最大3回・1回につき厳選チケット1枚。チケットは対戦の入賞でだけ増える
// （優勝3・準優勝2・3位1）ので、対戦を勝つほど良い個体に寄せていける。
// 旧仕様（コイン払い・活躍で最大10回）を使ったウマは使い切り扱いで、この画面に来ない。

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
  const tickets = useStore((s) => s.refineTickets ?? 0);
  const rerollHorse = useStore((s) => s.rerollHorse);

  const [picked, setPicked] = useState<Set<string>>(new Set()); // 「更新する」と選んだ枠
  const [changed, setChanged] = useState<Set<string>>(new Set()); // 直前の振り直しで変わった枠
  const [confirm, setConfirm] = useState<'reroll' | null>(null);

  const st = refineState(horse);
  const skill = skillOf(horse);
  const apt = aptitudeOf(horse);
  const poor = tickets < REFINE_TICKET_COST; // チケットが無いと振り直せない

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
        <CloseButton onClick={onClose} />
        <div className={styles.head}>
          <h2 className={styles.title}>厳選</h2>
        </div>

        <div className={styles.countRow}>
          <span className={styles.countLabel}>残り</span>
          <span className={styles.countBig}>{st.left}</span>
          <span className={styles.countSub}>/ {REFINE_MAX}回</span>
          <span className={styles.ticketHave}>
            <Icon name="ticket" size={15} /> 厳選チケット {tickets}枚
          </span>
        </div>

        <p className={styles.lead}>
          引き直したい枠を<strong>タップして「✓振り直す」</strong>にしてください。
          「このまま」の枠は動きません。選び終えたら下のボタンでまとめて振り直します。
          <br />1回振り直すごとに <strong>厳選チケット1枚</strong> 使います。
          チケットは<strong>対戦の入賞</strong>でもらえます（優勝3枚・準優勝2枚・3位1枚）。
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
              ? '厳選チケットがありません（対戦の入賞でもらえます）'
              : picked.size === 0
                ? '振り直す枠を選んでね'
                : `${picked.size}枠を振り直す（チケット1枚・残り${st.left}回）`}
        </button>

        {/* 確認ダイアログ：何がどうなるかを出してから実行する */}
        {confirm && (
          <div className={styles.confirmWrap} onClick={() => setConfirm(null)}>
            <div className={styles.confirmCard} onClick={(e) => e.stopPropagation()}>
              {(
                <>
                  <p className={styles.confirmTitle}>この{picked.size}枠を振り直します</p>
                  <ul className={styles.confirmList}>
                    {rows.filter((r) => picked.has(r.slot)).map((r) => (
                      <li key={r.slot} className={styles.confirmItem}>
                        <span className={styles.confirmLabel}>{r.label}</span>
                        <span className={styles.confirmNow}>今</span>
                        <span className={styles.rowValue}>{r.value}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={styles.confirmWarn}>
                    今の内容には<strong>戻せません</strong>。悪くなることもあります。
                    <br />残り回数：{st.left} → {st.left - 1}
                    <br />
                    <span className={styles.confirmCost}>
                      <Icon name="ticket" size={14} /> 厳選チケット 1枚使います（{tickets} → {tickets - 1}枚）
                    </span>
                  </p>
                </>
              )}
              <div className={styles.confirmActions}>
                <button className={styles.confirmNo} onClick={() => setConfirm(null)}>やめる</button>
                <button
                  className={styles.confirmYes}
                  onClick={() => { doReroll(); setConfirm(null); }}
                >
                  振り直す
                </button>
              </div>
            </div>
          </div>
        )}

        <p className={styles.note}>
          ※ 振り直すと前の内容には戻せません（悪くなることもあります）。
          回数はどのウマも3回まで。使わずに閉じてもチケットは減りません。
        </p>
      </div>
    </div>
  );
}
