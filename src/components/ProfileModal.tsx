import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useAuth, saveDisplayName, setRankingAvatar } from '../cloud';
import { normalizeUsername } from '../logic/username';
import type { HorseLook } from '../types';
import HorseFace from './HorseFace';
import TrophyIcon from './TrophyIcon';
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

  const user = useAuth((s) => s.user);
  const displayName = useAuth((s) => s.displayName);
  const setDisplayName = useAuth((s) => s.setDisplayName);

  const [tab, setTab] = useState<'profile' | 'account'>(initialTab);

  // Avatar: the chosen horse, or the first owned one, or a plain default.
  const avatar = useMemo<HorseLook>(() => {
    const byId = avatarHorseId ? horses.find((h) => h.id === avatarHorseId) : null;
    return byId ?? horses[0] ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  // Trophy counts owned per rank (gold/silver/bronze).
  const owned = useMemo(() => {
    const c: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
    for (const t of trophies) c[t.rank]++;
    return c;
  }, [trophies]);

  const shelf = displayTrophies; // ranks, in order, max SLOTS
  const usedOf = (r: 1 | 2 | 3) => shelf.filter((x) => x === r).length;

  function addTrophy(r: 1 | 2 | 3) {
    if (shelf.length >= SLOTS) return;
    if (usedOf(r) >= owned[r]) return;
    setDisplayTrophies([...shelf, r]);
  }
  function removeSlot(i: number) {
    setDisplayTrophies(shelf.filter((_, idx) => idx !== i));
  }

  // Ranking name edit.
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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header: avatar + name + trophy shelf */}
        <div className={styles.head}>
          <div className={styles.avatarBox}>
            <HorseFace horse={avatar} size={84} />
          </div>
          <div className={styles.headInfo}>
            <div className={styles.headName}>{displayName || 'ゲスト'}</div>
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
              {/* Ranking name */}
              <section className={styles.section}>
                <h3 className={styles.secTitle}>なまえ（ランキング名）</h3>
                {user ? (
                  <div className={styles.nameRow}>
                    <input
                      className={styles.nameInput}
                      value={nameDraft}
                      maxLength={32}
                      placeholder="なまえ"
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
                  <p className={styles.hint}>ログインすると、ランキング名を設定できます（「アカウント」タブ）。</p>
                )}
              </section>

              {/* Avatar horse picker */}
              <section className={styles.section}>
                <h3 className={styles.secTitle}>アイコンにするウマ</h3>
                {horses.length === 0 ? (
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
                            // Reflect the new icon on the ranking too (best-effort).
                            if (user) setRankingAvatar({ colors: h.colors, decos: h.decos });
                          }}
                          title={h.name}
                        >
                          <HorseFace horse={h} size={54} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Icon frame — coming soon (今後実装予定) */}
              <section className={styles.section}>
                <h3 className={styles.secTitle}>アイコンのフレーム</h3>
                <p className={styles.hint}>フレーム装飾は近日実装予定です。お楽しみに！</p>
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
                        owned[r] > 0 ? (
                          <button
                            key={r}
                            className={styles.trophyOption}
                            onClick={() => addTrophy(r)}
                            disabled={shelf.length >= SLOTS || usedOf(r) >= owned[r]}
                          >
                            <TrophyIcon rank={r} size={40} />
                            <span className={styles.trophyCount}>
                              {usedOf(r)}/{owned[r]}
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
