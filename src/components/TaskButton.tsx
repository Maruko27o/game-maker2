import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { setRankingFrame } from '../cloud';
import { raceCycle, grassCycle } from '../logic/tasks';
import {
  achievedLevel,
  claimable as streakClaimable,
  currentLevel,
  progress as streakProgress,
  pendingCount as streakPending,
  ownedLevels,
} from '../logic/streak';
import {
  RACE_TASK_EVERY,
  RACE_TASK_REWARD,
  GRASS_TASK_EVERY,
  GRASS_TASK_REWARD,
} from '../data/coins';
import { STREAK_MAX, isStreakFrame, type HorseLook, type StreakFrame as StreakFrameType } from '../types';
import Icon from './Icon';
import CoinIcon from './CoinIcon';
import StreakFrame from './StreakFrame';
import styles from './TaskButton.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// Top-bar task button (改修：タスク). Two tabs: coin-earning tasks (progress that
// resets each cycle → shared bank) and スペシャルタスク (連勝チャレンジ — win a betting
// solo race N times in a row to earn an ever-more-gorgeous 連勝フレーム).
export default function TaskButton() {
  const tasks = useStore((s) => s.tasks);
  const claimTaskBank = useStore((s) => s.claimTaskBank);
  const soloStreak = useStore((s) => s.soloStreak ?? 0);
  const streakBest = useStore((s) => s.streakBest ?? 0);
  const streakClaimed = useStore((s) => s.streakClaimed ?? 0);
  const claimStreakFrame = useStore((s) => s.claimStreakFrame);
  const equippedFrame = useStore((s) => s.equippedFrame ?? null);
  const equipFrame = useStore((s) => s.equipFrame);
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'normal' | 'special'>('normal');
  const [popCoins, setPopCoins] = useState(0);
  const [reveal, setReveal] = useState(0); // level just claimed (0 = no reveal)

  const streak = { soloStreak, streakBest, streakClaimed };
  const look = useMemo<HorseLook>(() => {
    const h = avatarHorseId ? horses.find((x) => x.id === avatarHorseId) : horses[0];
    return h ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  const bank = tasks.bank;
  const bankPending = Math.floor(bank / 1000); // rewards are 1000 each
  const specialPending = streakPending(streak);
  const pending = bankPending + specialPending;

  function claim() {
    const got = claimTaskBank();
    if (got > 0) {
      setPopCoins(got);
      window.setTimeout(() => setPopCoins(0), 1600);
    }
  }

  function claimStreak() {
    const lvl = claimStreakFrame();
    if (lvl > 0) setReveal(lvl);
  }

  // Equip/unequip locally *and* mirror to the ranking row (best-effort; no-op offline).
  function equip(frame: StreakFrameType | null) {
    equipFrame(frame);
    void setRankingFrame(frame);
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

  // スペシャルタスクの現在 Lv（受け取り待ち or 進行中）。null = 全10連勝コンプ。
  const level = currentLevel(streak);
  const canClaim = streakClaimable(streak);
  const owned = ownedLevels(streak);
  const equippedStreakLv = isStreakFrame(equippedFrame) ? equippedFrame.level : 0;

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

            {/* Tabs */}
            <div className={styles.tabs}>
              <button className={`${styles.tab} ${tab === 'normal' ? styles.tabOn : ''}`} onClick={() => setTab('normal')}>
                タスク{bankPending > 0 && <span className={styles.tabDot} aria-hidden>{bankPending}</span>}
              </button>
              <button className={`${styles.tab} ${tab === 'special' ? styles.tabOn : ''}`} onClick={() => setTab('special')}>
                スペシャル{specialPending > 0 && <span className={styles.tabDot} aria-hidden>{specialPending}</span>}
              </button>
            </div>

            {tab === 'normal' ? (
              <>
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
              </>
            ) : (
              <>
                <div className={styles.spLead}>
                  <span className={styles.spLeadTitle}>連勝チャレンジ</span>
                  <span className={styles.spLeadSub}>「一人でレース」で馬券を買って、払戻＞賭け金なら1勝。連勝を重ねて特別なフレームを集めよう！</span>
                </div>

                {/* Current level task (claimable or in-progress) */}
                {level === null ? (
                  <div className={styles.spDone}>
                    <StreakFrame level={STREAK_MAX} look={look} size={116} />
                    <div className={styles.spDoneTitle}>10連勝フレーム制覇！</div>
                    <div className={styles.spDoneSub}>すべての連勝フレームを獲得しました。おめでとう！</div>
                  </div>
                ) : (
                  <div className={`${styles.spTask} ${canClaim ? styles.spTaskReady : ''}`}>
                    <div className={styles.spFrameWrap}>
                      <StreakFrame level={level} look={look} size={104} />
                    </div>
                    <div className={styles.spTaskBody}>
                      <div className={styles.spTaskTitle}>{level}連勝</div>
                      <div className={styles.spTaskDesc}>
                        {canClaim
                          ? '達成！フレームを受け取ろう'
                          : `馬券レースで${level}連勝すると獲得`}
                      </div>
                      {canClaim ? (
                        <button className={styles.claim} onClick={claimStreak}>フレームを受け取る</button>
                      ) : (
                        <div className={styles.progRow}>
                          <div className={styles.bar}>
                            <div className={styles.barFill} style={{ width: `${streakProgress(streak, level) * 100}%` }} />
                          </div>
                          <span className={styles.progText}>{Math.min(soloStreak, level)}/{level}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Current streak status */}
                <div className={styles.spStatus}>
                  {soloStreak > 0
                    ? <><span className={styles.spStatusBig}>{soloStreak}</span>連勝中！この調子でLv{achievedLevel(streak) < STREAK_MAX ? Math.min(soloStreak + 1, STREAK_MAX) : STREAK_MAX}へ</>
                    : <>連勝は0。次のレースから積み上げよう</>}
                </div>

                {/* Owned frames gallery — tap to equip / unequip */}
                {owned.length > 0 && (
                  <div className={styles.spCollect}>
                    <div className={styles.spCollectHead}>獲得した連勝フレーム（タップで装備）</div>
                    <div className={styles.spGallery}>
                      {owned.map((lv) => (
                        <button
                          key={lv}
                          className={`${styles.spGalleryItem} ${equippedStreakLv === lv ? styles.spGalleryOn : ''}`}
                          onClick={() => equip(equippedStreakLv === lv ? null : { kind: 'streak', level: lv })}
                          aria-label={`${lv}連勝フレーム`}
                        >
                          <StreakFrame level={lv} look={look} size={72} />
                          {equippedStreakLv === lv && <span className={styles.spEquipTag}>装備中</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className={styles.foot}>レース開始後は他のタブに移っても結果は変わりません。</p>
              </>
            )}
          </div>

          {popCoins > 0 && (
            <div className={styles.pop} aria-hidden>
              <CoinIcon size={22} /> +{popCoins.toLocaleString()}
            </div>
          )}

          {/* Streak frame reveal after a claim */}
          {reveal > 0 && (
            <div className={styles.revealOverlay} onClick={() => setReveal(0)}>
              <div className={styles.revealCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.revealBurst} aria-hidden />
                <div className={styles.revealTitle}>{reveal}連勝フレーム獲得！</div>
                <div className={styles.revealFrame}><StreakFrame level={reveal} look={look} size={172} /></div>
                <div className={styles.revealActions}>
                  {equippedStreakLv === reveal ? (
                    <button className="btn neutral" onClick={() => equip(null)}>はずす</button>
                  ) : (
                    <button className="btn" onClick={() => equip({ kind: 'streak', level: reveal })}>アイコンにつける</button>
                  )}
                  <button className="btn neutral" onClick={() => setReveal(0)}>とじる</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
