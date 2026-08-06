import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, trophyCount } from '../store';
import { statTotal } from '../logic/stats';
import { styleFor } from '../logic/runStyle';
import { canApply } from '../logic/training';
import { RENAME_COST, TEAM_SIZE } from '../data/coins';
import { farmRatePerHour, farmAccrued, farmMsToFull, retireValueOf, horseFarmRateOf, teamHorses } from '../logic/farm';
import { canJoinTeam, type JoinCheck } from '../logic/team';
import { skillOf } from '../logic/skill';
import { aptitudeOf } from '../logic/aptitude';
import { refineState, canRefine, REFINE_MAX } from '../logic/refine';
import RerollPanel from '../components/RerollPanel';
import { GRADE_STYLE } from '../data/aptitude';
import { COURSES } from '../data/courses';
import { trustedNow } from '../logic/trustedClock';
import { STAT_KEYS, STAT_LABEL, STAT_CAP, STAT_TOTAL_CAP, RUN_STYLE_LABEL } from '../types';
import type { Horse, Trophy, Badge, TrainingItem, StatKey } from '../types';
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
    return <div className={styles.rackEmpty}>まだありません<small>グランプリ本戦で3位以内</small></div>;
  }
  return (
    <div className={styles.rack}>
      {groups.map((g, i) => (
        <div key={i} className={styles.rackItem}>
          <TrophyIcon rank={g.rank} size={38} />
          {g.count > 1 && <span className={styles.countBadge}>{g.count}</span>}
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
    return <div className={styles.rackEmpty}>まだありません<small>普段のレースで入賞</small></div>;
  }
  return (
    <div className={styles.badgeRack}>
      {groups.map((g) => (
        <div key={g.id} className={styles.badgeRackItem} title={BADGES[g.id as keyof typeof BADGES]?.name}>
          <BadgeIcon id={g.id} size={30} />
          {g.count > 1 && <span className={styles.countBadge}>{g.count}</span>}
        </div>
      ))}
    </div>
  );
}

export default function Stable() {
  const navigate = useNavigate();
  const horses = useStore((s) => s.horses);
  const team = useStore((s) => s.team);
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
  const retireMany = useStore((s) => s.retireMany);
  const toggleLock = useStore((s) => s.toggleLock);
  const joinTeam = useStore((s) => s.joinTeam);
  const leaveTeam = useStore((s) => s.leaveTeam);
  const reorderTeam = useStore((s) => s.reorderTeam);

  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>('detail');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rerollOpen, setRerollOpen] = useState(false);
  // まとめて引退：選択モードと選択中のウマ
  const [pickMode, setPickMode] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkNote, setBulkNote] = useState<string | null>(null);
  // ボックスの絞り込み（固有スキルの星）と並び替え
  const [starFilter, setStarFilter] = useState<Set<number>>(new Set());
  const [sortBy, setSortBy] = useState<'new' | 'star' | 'total' | 'name'>('new');
  const [draftName, setDraftName] = useState('');
  const selected = horses.find((h) => h.id === openId) ?? null;

  // Reset the rename draft whenever a different horse is opened.
  useEffect(() => {
    setDraftName(selected?.name ?? '');
  }, [openId, selected?.name]);

  function close() {
    setOpenId(null);
    setConfirmDelete(false);
    setRerollOpen(false);
    setView('detail');
  }

  const total = selected ? statTotal(selected.stats) : 0;
  const statItemCount = items.filter((i) => i.kind === 'stat').length;
  const anyItemCount = items.filter((i) => i.kind === 'any').length;

  // 牧場の放置収入：1秒ごとに表示を更新（回収でアンカーがリセットされる）。
  const [nowTs, setNowTs] = useState(trustedNow());
  useEffect(() => {
    const t = setInterval(() => setNowTs(trustedNow()), 1000);
    return () => clearInterval(t);
  }, []);
  // チーム（牧場収入・出走の対象／最大 TEAM_SIZE 頭）。既存ユーザーは team=所持ウマ全員。
  const teamSet = useMemo(() => new Set(team ?? []), [team]);
  const teamMembers = useMemo(
    () => (team ?? []).map((id) => horses.find((h) => h.id === id)).filter((h): h is Horse => !!h),
    [team, horses],
  );
  const othersAll = useMemo(() => horses.filter((h) => !teamSet.has(h.id)), [horses, teamSet]);
  const others = useMemo(() => {
    let list = othersAll;
    if (starFilter.size > 0) list = list.filter((h) => starFilter.has(skillOf(h).star));
    const sorted = [...list];
    if (sortBy === 'star') sorted.sort((a, b) => skillOf(b).star - skillOf(a).star || statTotal(b.stats) - statTotal(a.stats));
    else if (sortBy === 'total') sorted.sort((a, b) => statTotal(b.stats) - statTotal(a.stats));
    else if (sortBy === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    else sorted.sort((a, b) => b.createdAt - a.createdAt); // 新しい順
    return sorted;
  }, [othersAll, starFilter, sortBy]);
  const teamCount = teamMembers.length;
  // 牧場収入はチームのウマだけが対象（インフレ防止）。
  const farmRate = useMemo(
    () => farmRatePerHour(teamHorses(horses, team, TEAM_SIZE), trophies, badges),
    [horses, team, trophies, badges],
  );
  const [farmInfo, setFarmInfo] = useState(false); // しゅうにゅうの内訳ポップオーバー
  const farmAmt = farmAccrued(farmClaimedAt, nowTs, farmRate);
  const farmToFull = farmMsToFull(farmClaimedAt, nowTs);
  const farmFullMsg =
    farmToFull <= 0
      ? '満タン！回収しよう'
      : `あと${Math.floor(farmToFull / 3600000)}時間${Math.floor((farmToFull % 3600000) / 60000)}分で満タン`;
  const retireVal = selected ? retireValueOf(selected, trophies, badges) : 0;
  const selectedSkill = skillOf(selected ?? { id: '' });
  const selectedApt = aptitudeOf(selected ?? { id: '' });
  const refineTickets = useStore((s) => s.refineTickets ?? 0);
  const rr = selected ? refineState(selected) : null;
  const teamIndex = selected ? (team ?? []).indexOf(selected.id) : -1;
  const joinCheck: JoinCheck = selected
    ? canJoinTeam(selected, team ?? [], horses, TEAM_SIZE)
    : { ok: false, reason: 'full' };

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
          <p className={styles.emptySub}>草むらでウマを見つけよう！</p>
          <button className="btn" onClick={() => navigate('/')}>
            草むらへ
          </button>
        </div>
      ) : (
        <>
          {/* チーム：はっきり囲ったパネルにして「この6頭がチーム」を一目で分かるように。 */}
          <section className={styles.teamPanel}>
            <div className={styles.teamHead}>
              <span className={styles.teamHeadTitle}>
                <Icon name="trophy" size={15} /> チーム
              </span>
              <span className={styles.teamHeadCount}>{teamCount}/{TEAM_SIZE}</span>
            </div>
            <p className={styles.teamHeadNote}>レースに出られる・牧場の収入を生むのはこの{TEAM_SIZE}頭だけ</p>
            <div className={styles.teamGrid}>
              {Array.from({ length: TEAM_SIZE }).map((_, i) => {
                const h = teamMembers[i];
                if (!h) {
                  return (
                    <div key={`t-empty-${i}`} className={styles.teamSlotEmpty}>
                      <span className={styles.teamSlotEmptyMark}>空き</span>
                    </div>
                  );
                }
                const tc = trophyCount(trophies, h.id);
                return (
                  <button key={h.id} className={`${styles.slot} ${styles.slotTeam}`} onClick={() => setOpenId(h.id)}>
                    <span className={styles.slotOrder}>{i + 1}</span>
                    <div className={styles.slotThumb}>
                      <HorseView horse={h} size={64} />
                      {h.locked && <span className={styles.slotLock} aria-label="ロック中"><Icon name="lock" size={9} /></span>}
                      {tc > 0 && <span className={styles.slotTrophy}><Icon name="trophy" size={11} />{tc}</span>}
                    </div>
                    <div className={styles.slotName}>{h.name}</div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ボックス：チーム外のウマ＋空き枠（最大30頭）。 */}
          <section className={styles.boxPanel}>
            <div className={styles.boxHead}>
              <span className={styles.boxHeadTitle}>ボックス</span>
              <span className={styles.boxHeadCount}>{horses.length}/{maxHorses}</span>
              {others.length > 0 && (
                <button
                  className={styles.bulkBtn}
                  onClick={() => { setPickMode((v) => !v); setPicked(new Set()); setBulkConfirm(false); }}
                >
                  {pickMode ? 'やめる' : 'まとめて引退'}
                </button>
              )}
            </div>
            {pickMode && (
              <p className={styles.bulkHint}>
                引退させるウマをタップして選んでね（ロック中のウマは選べません）
              </p>
            )}
            {othersAll.length > 1 && (
              <div className={styles.filterBar}>
                <div className={styles.starFilter}>
                  <span className={styles.filterLabel}>星</span>
                  {[5, 4, 3, 2, 1].map((n) => {
                    const on = starFilter.has(n);
                    return (
                      <button
                        key={n}
                        className={`${styles.starChip} ${on ? styles.starChipOn : ''}`}
                        onClick={() => setStarFilter((p) => {
                          const x = new Set(p);
                          if (x.has(n)) x.delete(n); else x.add(n);
                          return x;
                        })}
                        aria-pressed={on}
                      >
                        <Icon name="star" size={10} /> {n}
                      </button>
                    );
                  })}
                  {starFilter.size > 0 && (
                    <button className={styles.clearChip} onClick={() => setStarFilter(new Set())}>解除</button>
                  )}
                </div>
                <select
                  className={styles.sortSelect}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                  aria-label="並び替え"
                >
                  <option value="new">新しい順</option>
                  <option value="star">星が高い順</option>
                  <option value="total">能力が高い順</option>
                  <option value="name">名前順</option>
                </select>
              </div>
            )}
            <div className={styles.box}>
              {others.map((h) => {
                const tc = trophyCount(trophies, h.id);
                const on = picked.has(h.id);
                return (
                  <button
                    key={h.id}
                    className={`${styles.slot} ${on ? styles.slotPicked : ''} ${pickMode && h.locked ? styles.slotDim : ''}`}
                    onClick={() => {
                      if (!pickMode) { setOpenId(h.id); return; }
                      if (h.locked) return; // ロック中は選べない
                      setPicked((p) => {
                        const n = new Set(p);
                        if (n.has(h.id)) n.delete(h.id); else n.add(h.id);
                        return n;
                      });
                    }}
                  >
                    {on && <span className={styles.pickMark}>✓</span>}
                    <div className={styles.slotThumb}>
                      <HorseView horse={h} size={64} />
                      {h.locked && <span className={styles.slotLock} aria-label="ロック中"><Icon name="lock" size={9} /></span>}
                      {tc > 0 && <span className={styles.slotTrophy}><Icon name="trophy" size={11} />{tc}</span>}
                    </div>
                    <div className={styles.slotName}>{h.name}</div>
                  </button>
                );
              })}
              {starFilter.size === 0 && Array.from({ length: Math.max(0, maxHorses - horses.length) }).map((_, i) => (
                <div key={`empty-${i}`} className={styles.slotEmpty} aria-hidden />
              ))}
            </div>
          </section>

          {/* まとめて引退：選択中の確認バー */}
          {pickMode && picked.size > 0 && (
            <div className={styles.bulkBar}>
              {bulkConfirm ? (
                <>
                  <span className={styles.bulkText}>
                    {picked.size}頭を引退させます。<strong>戻せません。</strong>
                  </span>
                  <div className={styles.bulkActions}>
                    <button className="btn neutral" onClick={() => setBulkConfirm(false)}>やめる</button>
                    <button
                      className="btn secondary"
                      onClick={() => {
                        const r = retireMany([...picked]);
                        setBulkNote(`${r.retired}頭を引退させて ${r.coins.toLocaleString()} コインを受け取りました`);
                        setPicked(new Set());
                        setBulkConfirm(false);
                        setPickMode(false);
                      }}
                    >
                      引退する
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className={styles.bulkText}>
                    {picked.size}頭 ・ <CoinIcon size={12} />{' '}
                    {[...picked]
                      .map((id) => horses.find((h) => h.id === id))
                      .filter((h): h is Horse => !!h)
                      .reduce((n, h) => n + retireValueOf(h, trophies, badges), 0)
                      .toLocaleString()}
                  </span>
                  <button className="btn secondary" onClick={() => setBulkConfirm(true)}>
                    引退させる
                  </button>
                </>
              )}
            </div>
          )}
          {/* バーが浮いているぶんの逃げ場。最下段のウマもバーの上に出せるようにする。 */}
          {pickMode && picked.size > 0 && <div className={styles.bulkSpacer} aria-hidden />}
          {bulkNote && (
            <div className={styles.bulkNote} role="status" onClick={() => setBulkNote(null)}>
              {bulkNote}
            </div>
          )}
        </>
      )}

      {selected && rerollOpen && (
        <RerollPanel horse={selected} onClose={() => setRerollOpen(false)} />
      )}

      {selected && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/* 常に見えている閉じ口。中身が長いので、下まで送らないと閉じられない
                状態を無くす。左は今どの画面を見ているかの表示。 */}
            <div className={styles.modalBar}>
              <span className={styles.modalBarTitle}>
                {view === 'detail' ? selected.name : `${selected.name}を育てる`}
              </span>
              <button className={styles.modalClose} onClick={close} aria-label="閉じる">
                ✕
              </button>
            </div>
            {view === 'detail' ? (
              <>
                {/* 左右2列。1行目＝名前／脚質・合計、2行目＝ウマの絵／能力図。
                    左右の列幅をそろえて、真ん中のラインが通って見えるようにする。 */}
                <div className={styles.detailGrid}>
                  <div className={styles.dName}>
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
                        {freeRename ? '改名（無料）' : <><CoinIcon size={13} /> 改名（{RENAME_COST}）</>}
                      </button>
                    )}
                  </div>

                  <div className={styles.dMeta}>
                    <span className={styles.styleChip}>脚質：{RUN_STYLE_LABEL[styleFor(selected.id, selected.stats)]}</span>
                    <span className={styles.metaTotal}>合計 {total}<small> / {STAT_TOTAL_CAP}</small></span>
                  </div>

                  <div className={styles.dHorse}>
                    <HorseView horse={selected} size={150} shadow />
                  </div>

                  <div className={styles.dRadar}>
                    <StatRadar stats={selected.stats} size={150} />
                  </div>
                </div>

                {/* 固有スキル（生まれつき1つ。いまは表示のみ・レースには未反映） */}
                <div className={styles.skillRow}>
                  <span className={styles.skillLabel}>固有スキル</span>
                  <span className={styles.skillName}>{selectedSkill.name}</span>
                  <span className={styles.skillStars} aria-label={`星${selectedSkill.star}`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Icon key={i} name="star" size={11} className={i < selectedSkill.star ? styles.starOn : styles.starOff} />
                    ))}
                  </span>
                  <span className={styles.skillEffect}>{selectedSkill.effect}</span>
                </div>

                {/* コース適性（2×3表・銅/銀/金/虹。いまは表示のみ・レースには未反映） */}
                <div className={styles.aptBlock}>
                  <span className={styles.aptTitle}>コース適性</span>
                  <div className={styles.aptGrid}>
                    {COURSES.map((c) => {
                      const g = selectedApt[c.id];
                      const st = GRADE_STYLE[g];
                      return (
                        <div key={c.id} className={styles.aptCell}>
                          <span className={styles.aptCourse}>{c.name}</span>
                          <span
                            className={styles.aptGrade}
                            style={{ background: st.background, color: st.ink, borderColor: st.border }}
                            title={`${g}（${st.label}）`}
                          >
                            {g}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 厳選：全ウマ最大3回。1回につき厳選チケット1枚（対戦の入賞でもらえる）。
                    旧仕様で振り直したことがあるウマは使い切り扱いで出さない。 */}
                {selected && canRefine(selected) && rr && rr.left > 0 && (
                  <button className={styles.rerollBtn} onClick={() => setRerollOpen(true)}>
                    <Icon name="sparkle" size={14} /> 厳選する（のこり{rr.left}／{REFINE_MAX}回・
                    <Icon name="ticket" size={13} />{refineTickets}枚）
                  </button>
                )}

                <div className={styles.earnRow}>
                  {teamSet.has(selected.id) ? (
                    <span className={styles.earnIn}>
                      <CoinIcon size={14} /> 牧場収入 {Math.round(horseFarmRateOf(selected, trophies, badges)).toLocaleString()}／時
                    </span>
                  ) : (
                    <span className={styles.earnOut}>チーム外のため牧場収入なし・レースに出られません</span>
                  )}
                </div>

                {/* チーム編成：入れる/外す＋並び順 */}
                <div className={styles.teamEdit}>
                  {teamSet.has(selected.id) ? (
                    <>
                      <button
                        className={styles.teamMove}
                        disabled={teamIndex <= 0}
                        onClick={() => reorderTeam(selected.id, -1)}
                        aria-label="順番を前へ"
                      >
                        ◀
                      </button>
                      <span className={styles.teamPos}>チーム {teamIndex + 1}番目</span>
                      <button
                        className={styles.teamMove}
                        disabled={teamIndex < 0 || teamIndex >= teamCount - 1}
                        onClick={() => reorderTeam(selected.id, 1)}
                        aria-label="順番を後ろへ"
                      >
                        ▶
                      </button>
                      <button className={styles.teamLeave} onClick={() => leaveTeam(selected.id)}>
                        チームから外す
                      </button>
                    </>
                  ) : (
                    <>
                      <button className={styles.teamJoin} disabled={!joinCheck.ok} onClick={() => joinTeam(selected.id)}>
                        チームに入れる
                      </button>
                      {!joinCheck.ok && (
                        <span className={styles.teamWhy}>
                          チームは{TEAM_SIZE}頭までです。だれかを外してね。
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* トロフィーとバッジは左右に並べる。たくさん取っても縦に伸びない。 */}
                <div className={styles.rackWrap}>
                  <div className={styles.rackCol}>
                    <h3 className={styles.rackTitle}>トロフィー</h3>
                    <TrophyRack trophies={trophies.filter((t) => t.horseId === selected.id)} />
                  </div>
                  <div className={styles.rackCol}>
                    <h3 className={styles.rackTitle}>バッジ</h3>
                    <BadgeRack badges={badges.filter((b) => b.horseId === selected.id)} />
                  </div>
                </div>

                {/* お気に入りロック：大切なウマの誤引退を防ぐ */}
                <button
                  className={`${styles.lockBtn} ${selected.locked ? styles.lockBtnOn : ''}`}
                  onClick={() => toggleLock(selected.id)}
                  aria-pressed={!!selected.locked}
                >
                  <Icon name="lock" size={14} />
                  {selected.locked ? 'ロック中（引退できません）' : 'ロックする（引退を防ぐ）'}
                </button>

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
                      <button className={`${styles.smallBtn} ${styles.smallPrimary}`} onClick={() => setView('train')}>
                        育てる
                      </button>
                      <button className={styles.smallBtn} onClick={() => navigate(`/create?edit=${selected.id}`)}>
                        着せ替え
                      </button>
                    </div>
                    <div className={styles.actions}>
                      <button
                        className={`${styles.smallBtn} ${styles.smallDanger}`}
                        disabled={!!selected.locked}
                        title={selected.locked ? 'ロック中は引退できません' : ''}
                        onClick={() => setConfirmDelete(true)}
                      >
                        引退（<CoinIcon size={12} /> {retireVal.toLocaleString()}）
                      </button>
                      <button className={styles.smallBtn} onClick={close}>
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
