import { useState } from 'react';
import { useStore } from '../store';
import { raceCycle, grassCycle } from '../logic/tasks';
import {
  RACE_TASK_EVERY,
  RACE_TASK_REWARD,
  GRASS_TASK_EVERY,
  GRASS_TASK_REWARD,
} from '../data/coins';
import Icon from './Icon';
import CoinIcon from './CoinIcon';
import styles from './TaskButton.module.css';

// Top-bar task button (改修：タスク). Coin-earning tasks each fill a 0→N progress
// that resets every cycle; each completed cycle deposits coins into a shared bank,
// claimed all at once from the top of the list. Designed to grow — add task cards.
export default function TaskButton() {
  const tasks = useStore((s) => s.tasks);
  const claimTaskBank = useStore((s) => s.claimTaskBank);
  const [open, setOpen] = useState(false);
  const [popCoins, setPopCoins] = useState(0);

  const bank = tasks.bank;
  const pending = Math.floor(bank / 1000); // badge count (rewards are 1000 each)

  function claim() {
    const got = claimTaskBank();
    if (got > 0) {
      setPopCoins(got);
      window.setTimeout(() => setPopCoins(0), 1600);
    }
  }

  const cards = [
    {
      key: 'race',
      title: 'レースを走ろう',
      desc: `${RACE_TASK_EVERY}レースごとに${RACE_TASK_REWARD.toLocaleString()}コイン`,
      cur: raceCycle(tasks),
      every: RACE_TASK_EVERY,
      reward: RACE_TASK_REWARD,
    },
    {
      key: 'grass',
      title: 'ウマを集めよう',
      desc: `草むらを${GRASS_TASK_EVERY}回ひくと${GRASS_TASK_REWARD.toLocaleString()}コイン`,
      cur: grassCycle(tasks),
      every: GRASS_TASK_EVERY,
      reward: GRASS_TASK_REWARD,
    },
  ];

  return (
    <>
      <button className={styles.fab} onClick={() => setOpen(true)} aria-label="タスク">
        <Icon name="clipboard" size={24} />
        {pending > 0 && <span className={styles.badge} aria-hidden>{pending}</span>}
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.head}>
              <h2 className={styles.h2}><Icon name="clipboard" size={20} /> タスク</h2>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label="閉じる">✕</button>
            </div>

            {/* Shared bank — claim all earned rewards at once */}
            <div className={styles.bank}>
              <div className={styles.bankInfo}>
                <span className={styles.bankLabel}>貯まったコイン</span>
                <span className={styles.bankVal}><CoinIcon size={18} /> {bank.toLocaleString()}</span>
              </div>
              <button className={styles.claim} disabled={bank <= 0} onClick={claim}>
                {bank > 0 ? 'まとめて受け取る' : '受け取り待ち'}
              </button>
            </div>

            {/* Task cards — progress resets each cycle; rewards go to the bank */}
            {cards.map((c) => (
              <div key={c.key} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.cardTitle}>{c.title}</span>
                  <span className={styles.reward}><CoinIcon size={14} /> {c.reward.toLocaleString()}</span>
                </div>
                <p className={styles.desc}>{c.desc}</p>
                <div className={styles.progRow}>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${(c.cur / c.every) * 100}%` }} />
                  </div>
                  <span className={styles.progText}>{c.cur}/{c.every}</span>
                </div>
              </div>
            ))}

            <p className={styles.foot}>タスクは今後も増えていきます。</p>
          </div>

          {popCoins > 0 && (
            <div className={styles.pop} aria-hidden>
              <CoinIcon size={22} /> +{popCoins.toLocaleString()}
            </div>
          )}
        </div>
      )}
    </>
  );
}
