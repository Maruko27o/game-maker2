import { useState } from 'react';
import { useStore } from '../store';
import { claimableRaceRewards, raceCycleProgress, claimableRaceCoins } from '../logic/tasks';
import { RACE_TASK_EVERY, RACE_TASK_REWARD } from '../data/coins';
import Icon from './Icon';
import CoinIcon from './CoinIcon';
import styles from './TaskButton.module.css';

// Top bar task button (改修：タスク), sitting just right of the profile icon and
// the same size. Opens a list of coin-earning tasks. Designed to grow — add more
// task cards here over time. A badge shows how many rewards are ready to claim.
export default function TaskButton() {
  const tasks = useStore((s) => s.tasks);
  const claimRaceReward = useStore((s) => s.claimRaceReward);
  const [open, setOpen] = useState(false);
  const [popCoins, setPopCoins] = useState(0); // brief "+N" flourish after claiming

  const ready = claimableRaceRewards(tasks);
  const cycle = raceCycleProgress(tasks);
  const readyCoins = claimableRaceCoins(tasks);

  function claim() {
    const got = claimRaceReward();
    if (got > 0) {
      setPopCoins(got);
      window.setTimeout(() => setPopCoins(0), 1600);
    }
  }

  return (
    <>
      <button className={styles.fab} onClick={() => setOpen(true)} aria-label="タスク">
        <Icon name="clipboard" size={24} />
        {ready > 0 && <span className={styles.badge} aria-hidden>{ready}</span>}
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.head}>
              <h2 className={styles.h2}><Icon name="clipboard" size={20} /> タスク</h2>
              <button className={styles.close} onClick={() => setOpen(false)} aria-label="閉じる">✕</button>
            </div>

            {/* Race task card */}
            <div className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.cardTitle}>レースを走ろう</span>
                <span className={styles.reward}><CoinIcon size={14} /> {RACE_TASK_REWARD.toLocaleString()}</span>
              </div>
              <p className={styles.desc}>{RACE_TASK_EVERY}レースごとに{RACE_TASK_REWARD.toLocaleString()}コインプレゼント</p>
              <div className={styles.progRow}>
                <div className={styles.bar}>
                  <div className={styles.barFill} style={{ width: `${(cycle / RACE_TASK_EVERY) * 100}%` }} />
                </div>
                <span className={styles.progText}>{cycle}/{RACE_TASK_EVERY}</span>
              </div>
              <button className={styles.claim} disabled={ready <= 0} onClick={claim}>
                {ready > 0
                  ? <>受け取る <CoinIcon size={14} /> +{readyCoins.toLocaleString()}{ready > 1 ? `（×${ready}）` : ''}</>
                  : 'あと' + (RACE_TASK_EVERY - cycle) + 'レース'}
              </button>
            </div>

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
