import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useAuth, saveDisplayName, setRankingAvatar, setRankingTrophies } from '../cloud';
import { normalizeUsername } from '../logic/username';
import { TOTAL_PARTS } from '../data/parts';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import TrophyIcon from './TrophyIcon';
import CoinIcon from './CoinIcon';
import AccountPanel from './AccountPanel';
import styles from './ProfileModal.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };
const SLOTS = 5;

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

  const user = useAuth((s) => s.user);
  const displayName = useAuth((s) => s.displayName);
  const setDisplayName = useAuth((s) => s.setDisplayName);

  const [tab, setTab] = useState<'profile' | 'account'>(initialTab);
  const [iconMode, setIconMode] = useState<'horse' | 'frame'>('horse'); // which icon aspect is being edited

  // Avatar: the chosen horse, or the first owned one, or a plain default.
  const avatar = useMemo<HorseLook>(() => {
    const byId = avatarHorseId ? horses.find((h) => h.id === avatarHorseId) : null;
    return byId ?? horses[0] ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  // Trophy counts owned per rank (gold/silver/bronze).
  const ownedTrophies = useMemo(() => {
    const c: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const t of trophies) c[t.rank]++;
    return c;
  }, [trophies]);

  // Lifetime profile stats (改修：プロフィール実績).
  const dexPct = useMemo(() => {
    const distinct = Math.min(TOTAL_PARTS, Object.values(owned).filter((n) => n > 0).length);
    return Math.round((distinct / TOTAL_PARTS) * 100);
  }, [owned]);
  // 最高回収率：1レースの「獲得賞金 ÷ 合計賭け金」の自己ベスト（% ）。
  const recoveryPct = pstats.betsPlaced > 0 ? pstats.maxRecoveryPct : null;

  const shelf = displayTrophies; // ranks, in order, max SLOTS
  const usedOf = (r: 1 | 2 | 3) => shelf.filter((x) => x === r).length;

  function saveShelf(next: number[]) {
    setDisplayTrophies(next);
    if (user) setRankingTrophies(next); // reflect on the ranking profile too
  }
  function addTrophy(r: 1 | 2 | 3) {
    if (shelf.length >= SLOTS) return;
    if (usedOf(r) >= ownedTrophies[r]) return;
    saveShelf([...shelf, r]);
  }
  function removeSlot(i: number) {
    saveShelf(shelf.filter((_, idx) => idx !== i));
  }

  // Ranking name edit (now lives in the header, next to the avatar).
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  useEffect(() => setNameDraft(displayName ?? ''), [displayName]);
  async function saveName() {
    const nm = normalizeUsername(nameDraft);
    if (!nm || nm === displayName) return;
    setNameBusy(true);
    const saved = await saveDisplayName(nm);
    setNameBusy(false);
    if (saved) setDisplayName(saved);
  }

  // Tapping the avatar jumps to the icon editor (horse mode) so it's obvious it's editable.
  function editIcon() {
    setTab('profile');
    setIconMode('horse');
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header: tappable avatar + editable name (+ save) + trophy shelf */}
        <div className={styles.head}>
          <button className={styles.avatarBtn} onClick={editIcon} aria-label="アイコンを変更">
            <HorseFace horse={avatar} size={84} />
            <span className={styles.avatarEdit} aria-hidden>✎</span>
          </button>
          <div className={styles.headInfo}>
            {user ? (
              <div className={styles.nameRow}>
                <input
                  className={styles.nameInput}
                  value={nameDraft}
                  maxLength={32}
                  placeholder="なまえ"
                  aria-label="なまえ（ランキング名）"
                  onChange={(e) => setNameDraft(e.target.value)}
                />
                <button
                  className={styles.saveBtn}
                  onClick={saveName}
                  disabled={nameBusy || !nameDraft.trim() || nameDraft.trim() === displayName}
                >
                  {nameBusy ? '…' : '保存'}
                </button>
              </div>
            ) : (
              <div className={styles.headName}>{displayName || 'ゲスト'}</div>
            )}
            <div className={styles.shelf}>
              {Array.from({ length: SLOTS }).map((_, i) => {
                const r = shelf[i] as 1 | 2 | 3 | undefined;
                return (
                  <button
                    key={i}
                    className={styles.shelfSlot}
                    onClick={() => r && removeSlot(i)}
                    aria-label={r ? 'トロフィーを外す' : '空きスロット'}
                    disabled={!r}
                  >
                    {r ? <TrophyIcon rank={r} size={30} /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Lifetime stats (プロフィール・アカウントの上) */}
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
          {tab === 'profile' ? (
            <>
              {/* Icon settings — a segmented control makes it clear whether you're
                  editing the horse or the frame (改修：アイコン/フレームの切替). */}
              <section className={styles.section}>
                <h3 className={styles.secTitle}>アイコン設定</h3>
                <div className={styles.seg}>
                  <button
                    className={`${styles.segBtn} ${iconMode === 'horse' ? styles.segOn : ''}`}
                    onClick={() => setIconMode('horse')}
                  >
                    ウマ
                  </button>
                  <button
                    className={`${styles.segBtn} ${iconMode === 'frame' ? styles.segOn : ''}`}
                    onClick={() => setIconMode('frame')}
                  >
                    フレーム
                  </button>
                </div>

                {iconMode === 'horse' ? (
                  horses.length === 0 ? (
                    <p className={styles.hint}>まだウマがいません。マイウマで作るとアイコンにできます。</p>
                  ) : (
                    <>
                      <p className={styles.hint}>アイコンにするウマをえらぶ</p>
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
                    </>
                  )
                ) : (
                  <p className={styles.hint}>フレーム装飾は近日実装予定です。お楽しみに！</p>
                )}
              </section>

              {/* Trophy decoration */}
              <section className={styles.section}>
                <h3 className={styles.secTitle}>トロフィーを飾る（{shelf.length}/{SLOTS}）</h3>
                {trophies.length === 0 ? (
                  <p className={styles.hint}>まだトロフィーがありません（グランプリで3位以内）。</p>
                ) : (
                  <>
                    <p className={styles.hint}>タップして上のたなに飾ろう。飾ったトロフィーを押すと外せます。</p>
                    <div className={styles.trophyPick}>
                      {([1, 2, 3] as const).map((r) =>
                        ownedTrophies[r] > 0 ? (
                          <button
                            key={r}
                            className={styles.trophyOption}
                            onClick={() => addTrophy(r)}
                            disabled={shelf.length >= SLOTS || usedOf(r) >= ownedTrophies[r]}
                          >
                            <TrophyIcon rank={r} size={40} />
                            <span className={styles.trophyCount}>
                              {usedOf(r)}/{ownedTrophies[r]}
                            </span>
                          </button>
                        ) : null,
                      )}
                    </div>
                  </>
                )}
              </section>
            </>
          ) : (
            <AccountPanel />
          )}
        </div>

        <button className={styles.closeLink} onClick={onClose}>とじる</button>
      </div>
    </div>
  );
}
