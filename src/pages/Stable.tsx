import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, trophyCount } from '../store';
import { statTotal } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { canApply } from '../logic/training';
import { RENAME_COST } from '../data/coins';
import { farmRatePerHour, farmAccrued, farmMsToFull, retireValueOf } from '../logic/farm';
import { STAT_KEYS, STAT_LABEL, STAT_CAP, STAT_TOTAL_CAP, RUN_STYLE_LABEL } from '../types';
import type { Trophy, Badge, TrainingItem, StatKey } from '../types';
import { BADGES } from '../data/badges';
import HorseView from '../components/HorseView';
import CoinIcon from '../components/CoinIcon';
import Icon from '../components/Icon';
import StatRadar from '../components/StatRadar';
import TrophyIcon from '../components/TrophyIcon';
import BadgeIcon from '../components/BadgeIcon';
import styles from './Stable.module.css';

type View = 'detail' | 'train';

// Which item index to spend for stat K: prefer a matching stat item, else 'any'.
function itemIndexFor(items: TrainingItem[], k: StatKey): number {
  let anyIdx = -1;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'stat' && it.stat === k) return i;
    if (it.kind === 'any' && anyIdx < 0) anyIdx = i;
  }
  return anyIdx;
}

function TrophyRack({ trophies }: { trophies: Trophy[] }) {
  // Group by rank, order gold->silver->bronze then by first-acquired.
  const groups = useMemo(() => {
    const map = new Map<1 | 2 | 3, { rank: 1 | 2 | 3; count: number; at: number }>();
    for (const t of trophies) {
      const g = map.get(t.rank);
      if (g) {
        g.count++;
        g.at = Math.min(g.at, t.at);
      } else {
        map.set(t.rank, { rank: t.rank, count: 1, at: t.at });
      }
    }
    return [...map.values()].sort((a, b) => a.rank - b.rank || a.at - b.at);
  }, [trophies]);

  if (trophies.length === 0) {
    return <div className={styles.rackEmpty}>まだトロフィーがありません（グランプリ本戦で3位以内）</div>;
  }
  return (
    <div className={styles.rack}>
      {groups.map((g, i) => (
        <div key={i} className={styles.rackItem}>
          <TrophyIcon rank={g.rank} size={56} />
          {g.count > 1 && <span className={styles.rackCount}>×{g.count}</span>}
        </div>
      ))}
    </div>
  );
}

// Badges from everyday races: placing badges stack, achievements show once.
// Placing first (by rank), then achievements (ACCOUNT.md §2).
function BadgeRack({ badges }: { badges: Badge[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; count: number; at: number }>();
    for (const b of badges) {
      const g = map.get(b.id);
      if (g) { g.count++; g.at = Math.min(g.at, b.at); }
      else map.set(b.id, { id: b.id, count: 1, at: b.at });
    }
    const order = Object.keys(BADGES);
    return [...map.values()].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [badges]);

  if (badges.length === 0) {
    return <div className={styles.rackEmpty}>まだバッジがありません（普段のレースで入賞）</div>;
  }
  return (
    <div className={styles.badgeRack}>
      {groups.map((g) => (
        <div key={g.id} className={styles.badgeRackItem} title={BADGES[g.id as keyof typeof BADGES]?.name}>
          <BadgeIcon id={g.id} size={40} />
          {g.count > 1 && <span className={styles.rackCount}>×{g.count}</span>}
        </div>
      ))}
    </div>
  );
}

export default function Stable() {
  const navigate = useNavigate();
  const horses = useStore((s) => s.horses);
  const trophies = useStore((s) => s.trophies);
  const badges = useStore((s) => s.badges);
  const items = useStore((s) => s.items);
  const renameHorse = useStore((s) => s.renameHorse);
  const freeRename = useStore((s) => s.freeRename);
  const consumeFreeRename = useStore((s) => s.consumeFreeRename);
  const trainHorse = useStore((s) => s.trainHorse);
  const freeRebalance = useStore((s) => s.freeRebalance);
  const maxHorses = useStore((s) => s.maxHorses);
  const coins = useStore((s) => s.coins);
  const spendCoins = useStore((s) => s.spendCoins);
  const farmClaimedAt = useStore((s) => s.farmClaimedAt);
  const claimFarm = useStore((s) => s.claimFarm);
  const retireHorse = useStore((s) => s.retireHorse);

  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>('detail');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draftName, setDraftName] = useState('');
  const selected = horses.find((h) => h.id === openId) ?? null;

  // Reset the rename draft whenever a different horse is opened.
  useEffect(() => {
    setDraftName(selected?.name ?? '');
  }, [openId, selected?.name]);

  function close() {
    setOpenId(null);
    setConfirmDelete(false);
    setView('detail');
  }

  const total = selected ? statTotal(selected.stats) : 0;
  const statItemCount = items.filter((i) => i.kind === 'stat').length;
  const anyItemCount = items.filter((i) => i.kind === 'any').length;

  // 牧場の放置収入：1秒ごとに表示を更新（回収でアンカーがリセットされる）。
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const farmRate = useMemo(() => farmRatePerHour(horses, trophies, badges), [horses, trophies, badges]);
  const [farmInfo, setFarmInfo] = useState(false); // しゅうにゅうの内訳ポップオーバー
  const farmAmt = farmAccrued(farmClaimedAt, nowTs, farmRate);
  const farmToFull = farmMsToFull(farmClaimedAt, nowTs);
  const farmFullMsg =
    farmToFull <= 0
      ? '満タン！回収しよう'
      : `あと${Math.floor(farmToFull / 3600000)}時間${Math.floor((farmToFull % 3600000) / 60000)}分で満タン`;
  const retireVal = selected ? retireValueOf(selected, trophies, badges) : 0;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>マイウマ</h1>
        <span className={styles.count}>
          {horses.length}/{maxHorses}
        </span>
      </header>

      {horses.length > 0 && (
        <div className={styles.farmCard}>
          <div className={styles.farmHead}>
            <span className={styles.farmTitle}>
              <Icon name="leaf" size={17} /> 牧場の収入
              <button
                className={styles.farmInfoBtn}
                aria-label="収入の内訳"
                aria-expanded={farmInfo}
                onClick={() => setFarmInfo((v) => !v)}
              >
                i
              </button>
            </span>
            <span className={styles.farmRate}>{Math.round(farmRate).toLocaleString()} ／時</span>
          </div>
          {farmInfo && (
            <div className={styles.farmInfoPop} role="note">
              <div className={styles.farmInfoTitle}>自動収入（1頭ごと・毎時）</div>
              <ul className={styles.farmInfoList}>
                <li><TrophyIcon rank={1} size={20} /><span>トロフィー金</span><b>+50</b></li>
                <li><TrophyIcon rank={2} size={20} /><span>トロフィー銀</span><b>+20</b></li>
                <li><TrophyIcon rank={3} size={20} /><span>トロフィー銅</span><b>+10</b></li>
                <li><BadgeIcon id="badge_1st" size={20} /><span>バッジ金</span><b>+3</b></li>
                <li><BadgeIcon id="badge_2nd" size={20} /><span>バッジ銀</span><b>+2</b></li>
                <li><BadgeIcon id="badge_3rd" size={20} /><span>バッジ銅</span><b>+1</b></li>
              </ul>
              <div className={styles.farmInfoFoot}>1頭の上限は 1,000コイン／毎時</div>
            </div>
          )}
          <div className={styles.farmBody}>
            <span className={styles.farmAmt}><CoinIcon size={22} /> {farmAmt.toLocaleString()}</span>
            <button className={styles.farmClaim} disabled={farmAmt < 1} onClick={() => claimFarm()}>
              回収する
            </button>
          </div>
          <div className={styles.farmNote}>{farmFullMsg} ・ トロフィー・バッジが多いほど増えるよ</div>
        </div>
      )}

      {horses.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyEmoji}><Icon name="horse" size={56} /></div>
          <p>まだウマがいません。</p>
          <p className={styles.emptySub}>草むらでパーツを集めて、ウマを作ろう！</p>
          <button className="btn" onClick={() => navigate('/create')}>
            ウマを作る
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {horses.map((h) => {
            const tc = trophyCount(trophies, h.id);
            return (
              <button key={h.id} className={styles.card} onClick={() => setOpenId(h.id)}>
                <div className={styles.cardThumb}>
                  <HorseView horse={h} size={130} shadow />
                </div>
                <div className={styles.cardName}>{h.name}</div>
                <div className={styles.cardMeta}>
                  <span>合計 {statTotal(h.stats)}</span>
                  {tc > 0 && <span className={styles.cardTrophy}><Icon name="trophy" size={13} />{tc}</span>}
                </div>
              </button>
            );
          })}
          {horses.length < maxHorses && (
            <button className={styles.add} onClick={() => navigate('/create')}>
              <span className={styles.plus}>＋</span>
              <span>作る</span>
            </button>
          )}
        </div>
      )}

      {selected && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {view === 'detail' ? (
              <>
                <div className={styles.modalThumb}>
                  <HorseView horse={selected} size={140} shadow />
                </div>
                <div className={styles.renameRow}>
                  <input
                    className={styles.nameInput}
                    value={draftName}
                    maxLength={12}
                    onChange={(e) => setDraftName(e.target.value)}
                    aria-label="名前"
                  />
                  {draftName.trim() && draftName !== selected.name && (
                    <button
                      className={styles.renameBtn}
                      disabled={!freeRename && coins < RENAME_COST}
                      onClick={() => {
                        if (freeRename) {
                          renameHorse(selected.id, draftName.trim());
                          consumeFreeRename();
                        } else if (spendCoins(RENAME_COST)) {
                          renameHorse(selected.id, draftName.trim());
                        }
                      }}
                      title={!freeRename && coins < RENAME_COST ? 'コインが足りません' : ''}
                    >
                      {freeRename ? '改名（無料）' : <><CoinIcon size={15} /> 改名（{RENAME_COST}）</>}
                    </button>
                  )}
                </div>

                <div className={styles.styleChip}>脚質：{RUN_STYLE_LABEL[styleFor(selected.id, selected.stats)]}</div>

                <div className={styles.statsBlock}>
                  <StatRadar stats={selected.stats} size={168} />
                  <div className={styles.statGrid}>
                    {STAT_KEYS.map((k) => (
                      <div key={k} className={styles.statCell}>
                        <span className={styles.statCellLabel}>{STAT_LABEL[k]}</span>
                        <span className={styles.statCellVal}>{selected.stats[k]}</span>
                      </div>
                    ))}
                  </div>
                  <div className={styles.statTotal}>
                    合計 {total} / {STAT_TOTAL_CAP}
                  </div>
                </div>

                <div className={styles.rackWrap}>
                  <h3 className={styles.rackTitle}>トロフィー</h3>
                  <TrophyRack trophies={trophies.filter((t) => t.horseId === selected.id)} />
                  <h3 className={`${styles.rackTitle} ${styles.badgeRackTitle}`}>バッジ</h3>
                  <BadgeRack badges={badges.filter((b) => b.horseId === selected.id)} />
                </div>

                {confirmDelete ? (
                  <div className={styles.confirm}>
                    <p className={styles.confirmText}>
                      「{selected.name}」を引退させますか？<br />
                      <span className={styles.retireGain}><CoinIcon size={16} /> {retireVal.toLocaleString()} コイン</span> を受け取ります。<br />
                      <strong>引退すると戻せません。</strong>
                    </p>
                    <div className={styles.row}>
                      <button className="btn neutral" onClick={() => setConfirmDelete(false)}>
                        やめる
                      </button>
                      <button
                        className="btn secondary"
                        onClick={() => {
                          retireHorse(selected.id);
                          close();
                        }}
                      >
                        引退する
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {freeRebalance && (
                      <button
                        className="btn"
                        style={{ width: '100%' }}
                        onClick={() => navigate(`/create?rebalance=${selected.id}`)}
                      >
                        <Icon name="refresh" size={15} /> ステータスを1回だけ振り直す
                      </button>
                    )}
                    <div className={styles.actions}>
                      <button className="btn" onClick={() => setView('train')}>
                        育てる
                      </button>
                      <button className="btn neutral" onClick={() => navigate(`/create?edit=${selected.id}`)}>
                        直す
                      </button>
                    </div>
                    <div className={styles.actions}>
                      <button className="btn secondary" onClick={() => setConfirmDelete(true)}>
                        <Icon name="leaf" size={14} /> 引退（<CoinIcon size={13} /> {retireVal.toLocaleString()}）
                      </button>
                      <button className="btn neutral" onClick={close}>
                        閉じる
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : (
              // --- Training view ---
              <>
                <h2 className={styles.trainTitle}>育てる</h2>
                <div className={styles.trainHorse}>
                  <HorseView horse={selected} size={120} shadow />
                </div>
                <div className={styles.itemBar}>
                  <span><Icon name="gift" size={15} /> 育成アイテム</span>
                  <span className={styles.itemCounts}>
                    ステータス {statItemCount} / どれでも {anyItemCount}
                  </span>
                </div>
                {items.length === 0 && (
                  <p className={styles.trainHint}>アイテムがありません。グランプリで入賞するともらえます。</p>
                )}
                <div className={styles.trainBars}>
                  {STAT_KEYS.map((k) => {
                    const idx = itemIndexFor(items, k);
                    const usable = idx >= 0 && canApply(selected.stats, k);
                    return (
                      <div key={k} className={styles.trainRow}>
                        <span className={styles.statLabel}>{STAT_LABEL[k]}</span>
                        <div className={styles.statTrack}>
                          <div className={styles.statFill} style={{ width: `${(selected.stats[k] / STAT_CAP) * 100}%` }} />
                        </div>
                        <span className={styles.statVal}>{selected.stats[k]}</span>
                        <button
                          className={styles.plusBtn}
                          disabled={!usable}
                          onClick={() => trainHorse(selected.id, idx, k)}
                        >
                          +1
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className={styles.statTotal}>
                  合計 {total} / {STAT_TOTAL_CAP}
                  {total >= STAT_TOTAL_CAP && '（これ以上つよくできません）'}
                </div>
                <button className="btn neutral" onClick={() => setView('detail')}>
                  戻る
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
