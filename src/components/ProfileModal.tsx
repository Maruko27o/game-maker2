import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useAuth, saveDisplayName, setRankingAvatar, setRankingTrophies, setRankingFrame } from '../cloud';
import { normalizeUsername } from '../logic/username';
import { TOTAL_PARTS } from '../data/parts';
import type { HorseLook, EquipFrame } from '../types';
import { isStreakFrame } from '../types';
import { ownedLevels } from '../logic/streak';
import HorseFace from './HorseFace';
import EquippedFrame from './EquippedFrame';
import TrophyIcon from './TrophyIcon';
import CoinIcon from './CoinIcon';
import AccountPanel from './AccountPanel';
import styles from './ProfileModal.module.css';

// アイコンに装備できるフレーム同士の同一判定。
function sameFrame(a: EquipFrame | null, b: EquipFrame | null): boolean {
  if (!a || !b) return a === b;
  if (isStreakFrame(a) || isStreakFrame(b)) return isStreakFrame(a) && isStreakFrame(b) && a.level === b.level;
  return a.period === b.period && a.rank === b.rank && a.metric === b.metric;
}

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };
const SLOTS = 5;
// ランキング／殿堂の各行に1行で収まる長さに制限（長すぎる名前でのレイアウト崩れ防止）。
const NAME_MAX = 12;

export default function ProfileModal({
  onClose,
  initialTab = 'profile',
}: {
  onClose: () => void;
  initialTab?: 'profile' | 'account';
}) {
  const horses = useStore((s) => s.horses);
  const trophies = useStore((s) => s.trophies);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const displayTrophies = useStore((s) => s.displayTrophies);
  const setAvatarHorse = useStore((s) => s.setAvatarHorse);
  const setDisplayTrophies = useStore((s) => s.setDisplayTrophies);
  const owned = useStore((s) => s.owned);
  const tasks = useStore((s) => s.tasks);
  const pstats = useStore((s) => s.stats);
  const streakClaimed = useStore((s) => s.streakClaimed ?? 0);
  const mailbox = useStore((s) => s.mailbox ?? []);
  const equippedFrame = useStore((s) => s.equippedFrame ?? null);
  const equipFrame = useStore((s) => s.equipFrame);

  const user = useAuth((s) => s.user);
  const displayName = useAuth((s) => s.displayName);
  const setDisplayName = useAuth((s) => s.setDisplayName);

  const [tab, setTab] = useState<'profile' | 'account'>(initialTab);
  const [editing, setEditing] = useState<null | 'icon' | 'trophy'>(null); // tap a header box to open
  const [iconMode, setIconMode] = useState<'horse' | 'frame'>('horse');

  const avatar = useMemo<HorseLook>(() => {
    const byId = avatarHorseId ? horses.find((h) => h.id === avatarHorseId) : null;
    return byId ?? horses[0] ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  // 獲得済みフレーム一覧（連勝フレーム＋殿堂フレーム）。アイコン設定の「フレーム」で装備する。
  const ownedFrames = useMemo<EquipFrame[]>(() => {
    const streak: EquipFrame[] = ownedLevels({ soloStreak: 0, streakBest: 0, streakClaimed })
      .slice()
      .reverse() // 高い連勝ほど手前に
      .map((level) => ({ kind: 'streak', level }));
    const seen = new Set<string>();
    const rank: EquipFrame[] = [];
    for (const m of mailbox) {
      if (m.kind !== 'frame' || !m.frame) continue;
      const key = `${m.frame.period}-${m.frame.rank}-${m.frame.metric}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rank.push(m.frame);
    }
    return [...streak, ...rank];
  }, [streakClaimed, mailbox]);

  // フレームを装備／解除（ローカル＋ランキング行にも反映）。
  function equip(frame: EquipFrame | null) {
    equipFrame(frame);
    void setRankingFrame(frame);
  }

  const ownedTrophies = useMemo(() => {
    const c: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const t of trophies) c[t.rank]++;
    return c;
  }, [trophies]);

  const dexPct = useMemo(() => {
    const distinct = Math.min(TOTAL_PARTS, Object.values(owned).filter((n) => n > 0).length);
    return Math.round((distinct / TOTAL_PARTS) * 100);
  }, [owned]);
  const recoveryPct = pstats.betsPlaced > 0 ? pstats.maxRecoveryPct : null;

  const shelf = displayTrophies;
  const usedOf = (r: 1 | 2 | 3) => shelf.filter((x) => x === r).length;

  function saveShelf(next: number[]) {
    setDisplayTrophies(next);
    if (user) setRankingTrophies(next);
  }
  function addTrophy(r: 1 | 2 | 3) {
    if (shelf.length >= SLOTS || usedOf(r) >= ownedTrophies[r]) return;
    saveShelf([...shelf, r]);
  }
  function removeSlot(i: number) {
    saveShelf(shelf.filter((_, idx) => idx !== i));
  }

  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  useEffect(() => setNameDraft((displayName ?? '').slice(0, NAME_MAX)), [displayName]);
  async function saveName() {
    const nm = normalizeUsername(nameDraft);
    if (!nm || nm === displayName) return;
    setNameBusy(true);
    const saved = await saveDisplayName(nm);
    setNameBusy(false);
    if (saved) setDisplayName(saved);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header: tap the avatar to change the icon, tap the shelf to edit trophies */}
        <div className={styles.head}>
          <button className={styles.avatarBtn} onClick={() => { setIconMode('horse'); setEditing('icon'); }} aria-label="アイコンを変更">
            <HorseFace horse={avatar} size={76} />
            <span className={styles.avatarEdit} aria-hidden>✎</span>
          </button>
          <div className={styles.headInfo}>
            {user ? (
              <>
                <div className={styles.nameRow}>
                  <input
                    className={styles.nameInput}
                    value={nameDraft}
                    maxLength={NAME_MAX}
                    placeholder="名前"
                    aria-label="名前（ランキング名）"
                    onChange={(e) => setNameDraft(e.target.value.slice(0, NAME_MAX))}
                  />
                  <button className={styles.saveBtn} onClick={saveName} disabled={nameBusy || !nameDraft.trim() || nameDraft.trim() === displayName}>
                    {nameBusy ? '…' : '保存'}
                  </button>
                </div>
                <div className={styles.nameHint}>なまえは{NAME_MAX}文字まで</div>
              </>
            ) : (
              <div className={styles.headName}>{displayName || 'ゲスト'}</div>
            )}
          </div>
        </div>

        {/* トロフィー棚：名前の下に横いっぱいで飾る（棚の上に並ぶ見た目） */}
        <button className={styles.shelfBtn} onClick={() => setEditing('trophy')} aria-label="トロフィーを飾る">
          {Array.from({ length: SLOTS }).map((_, i) => {
            const r = shelf[i] as 1 | 2 | 3 | undefined;
            return (
              <span key={i} className={styles.shelfSlot}>
                {r ? <TrophyIcon rank={r} size={60} /> : null}
              </span>
            );
          })}
          <span className={styles.shelfEdit} aria-hidden>✎</span>
        </button>

        {/* Lifetime stats */}
        <div className={styles.statGrid}>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>総レース回数</span>
            <span className={styles.statValue}>{tasks.racesFinished.toLocaleString()}<small>回</small></span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>最大オッズ</span>
            <span className={styles.statValue}>{pstats.maxOdds > 0 ? <>{pstats.maxOdds.toLocaleString(undefined, { maximumFractionDigits: 1 })}<small>倍</small></> : '—'}</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>最高回収率</span>
            <span className={styles.statValue}>{recoveryPct === null ? '—' : <>{recoveryPct.toLocaleString()}<small>%</small></>}</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>図鑑コンプリート率</span>
            <span className={styles.statValue}>{dexPct}<small>%</small></span>
          </div>
          <div className={`${styles.statCell} ${styles.statWide}`}>
            <span className={styles.statLabel}>最大獲得賞金</span>
            <span className={styles.statValue}><CoinIcon size={14} /> {pstats.maxPayout.toLocaleString()}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'profile' ? styles.tabOn : ''}`} onClick={() => setTab('profile')}>
            プロフィール
          </button>
          <button className={`${styles.tab} ${tab === 'account' ? styles.tabOn : ''}`} onClick={() => setTab('account')}>
            アカウント
          </button>
        </div>

        <div className={styles.body}>
          {tab === 'profile' ? null : <AccountPanel />}
        </div>

        <button className={styles.closeLink} onClick={onClose}>閉じる</button>
      </div>

      {/* Icon editor (opened by tapping the avatar) */}
      {editing === 'icon' && (
        <div className={styles.editorOverlay} onClick={() => setEditing(null)}>
          <div className={styles.editorCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editorHead}>
              <h3 className={styles.editorTitle}>アイコン設定</h3>
              <button className={styles.close} onClick={() => setEditing(null)} aria-label="閉じる">✕</button>
            </div>
            <div className={styles.seg}>
              <button className={`${styles.segBtn} ${iconMode === 'horse' ? styles.segOn : ''}`} onClick={() => setIconMode('horse')}>ウマ</button>
              <button className={`${styles.segBtn} ${iconMode === 'frame' ? styles.segOn : ''}`} onClick={() => setIconMode('frame')}>フレーム</button>
            </div>
            {iconMode === 'horse' ? (
              horses.length === 0 ? (
                <p className={styles.hint}>まだウマがいません。マイウマで作るとアイコンにできます。</p>
              ) : (
                <div className={styles.horseGrid}>
                  {horses.map((h) => {
                    const sel = (avatarHorseId ?? horses[0]?.id) === h.id;
                    return (
                      <button
                        key={h.id}
                        className={`${styles.horsePick} ${sel ? styles.picked : ''}`}
                        onClick={() => {
                          setAvatarHorse(h.id);
                          if (user) setRankingAvatar({ colors: h.colors, decos: h.decos });
                        }}
                        title={h.name}
                      >
                        <HorseFace horse={h} size={54} />
                      </button>
                    );
                  })}
                </div>
              )
            ) : ownedFrames.length === 0 ? (
              <p className={styles.hint}>まだフレームがありません。連勝チャレンジ（タスク→スペシャル）や殿堂入りで手に入ります。</p>
            ) : (
              <>
                <div className={styles.frameGrid}>
                  {/* なし（フレームを外す） */}
                  <button
                    className={`${styles.framePick} ${!equippedFrame ? styles.picked : ''}`}
                    onClick={() => equip(null)}
                    aria-label="フレームなし"
                  >
                    <div className={styles.frameFace}><HorseFace horse={avatar} size={56} /></div>
                    <span className={styles.frameName}>なし</span>
                  </button>
                  {ownedFrames.map((f, i) => {
                    const on = sameFrame(equippedFrame, f);
                    return (
                      <button
                        key={i}
                        className={`${styles.framePick} ${on ? styles.picked : ''}`}
                        onClick={() => equip(f)}
                        aria-label="フレーム"
                      >
                        <EquippedFrame frame={f} look={avatar} size={56} />
                        {on && <span className={styles.frameTag}>装備中</span>}
                      </button>
                    );
                  })}
                </div>
                <p className={styles.hint}>タップでアイコンに装備できます。</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Trophy editor (opened by tapping the shelf) */}
      {editing === 'trophy' && (
        <div className={styles.editorOverlay} onClick={() => setEditing(null)}>
          <div className={styles.editorCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.editorHead}>
              <h3 className={styles.editorTitle}>トロフィーを飾る（{shelf.length}/{SLOTS}）</h3>
              <button className={styles.close} onClick={() => setEditing(null)} aria-label="閉じる">✕</button>
            </div>
            {/* current shelf — tap a trophy to remove it */}
            <div className={styles.shelfEdit2}>
              {Array.from({ length: SLOTS }).map((_, i) => {
                const r = shelf[i] as 1 | 2 | 3 | undefined;
                return (
                  <button key={i} className={styles.shelfSlot2} onClick={() => r && removeSlot(i)} disabled={!r} aria-label={r ? 'トロフィーを外す' : '空き'}>
                    {r ? <TrophyIcon rank={r} size={30} /> : null}
                  </button>
                );
              })}
            </div>
            {trophies.length === 0 ? (
              <p className={styles.hint}>まだトロフィーがありません（グランプリで3位以内）。</p>
            ) : (
              <>
                <p className={styles.hint}>下のトロフィーをタップして棚に飾ろう。棚のトロフィーを押すと外せます。</p>
                <div className={styles.trophyPick}>
                  {([1, 2, 3] as const).map((r) =>
                    ownedTrophies[r] > 0 ? (
                      <button key={r} className={styles.trophyOption} onClick={() => addTrophy(r)} disabled={shelf.length >= SLOTS || usedOf(r) >= ownedTrophies[r]}>
                        <TrophyIcon rank={r} size={40} />
                        <span className={styles.trophyCount}>{usedOf(r)}/{ownedTrophies[r]}</span>
                      </button>
                    ) : null,
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
