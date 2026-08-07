import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { TITLES, titleCtx, activeTitle, type TitleDef } from '../data/titles';
import { useAuth, saveDisplayName, setRankingAvatar, setRankingTrophies, setRankingFrame, setRankingTitle } from '../cloud';
import { normalizeUsername } from '../logic/username';
import { TOTAL_PARTS } from '../data/parts';
import type { HorseLook, EquipFrame, FrameAward } from '../types';
import { monthLabel } from '../logic/period';
import { isStreakFrame, isAptFrame, isBoxFrame } from '../types';
import { frameCatalog, rankingFrames } from '../logic/frameCatalog';
import { fmtOdds } from '../logic/betting';
import HorseFace from './HorseFace';
import EquippedFrame from './EquippedFrame';
import TrophyIcon from './TrophyIcon';
import CoinIcon from './CoinIcon';
import AccountPanel from './AccountPanel';
import styles from './ProfileModal.module.css';
import CloseButton from './CloseButton';
import TitleBanner from './TitleBanner';
import CollectionModal from './CollectionModal';
import Icon from './Icon';

// アイコンに装備できるフレーム同士の同一判定。
function sameFrame(a: EquipFrame | null, b: EquipFrame | null): boolean {
  if (!a || !b) return a === b;
  if (isStreakFrame(a) || isStreakFrame(b)) return isStreakFrame(a) && isStreakFrame(b) && a.level === b.level;
  if (isAptFrame(a) || isAptFrame(b)) return isAptFrame(a) && isAptFrame(b) && a.grade === b.grade;
  if (isBoxFrame(a) || isBoxFrame(b)) return isBoxFrame(a) && isBoxFrame(b) && a.box === b.box;
  return a.period === b.period && a.rank === b.rank && a.metric === b.metric;
}

// 殿堂フレームの説明（読み上げと見出し用）。
const metricLabel = (m: FrameAward['metric']) => (m === 'payout' ? '最大獲得賞金' : '最大オッズ');
const frameAwardLabel = (f: FrameAward) => `${monthLabel(f.period)} ${metricLabel(f.metric)} ${f.rank}位`;

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
  const equippedFrame = useStore((s) => s.equippedFrame ?? null);
  const mailbox = useStore((s) => s.mailbox ?? []);
  const aptFrames = useStore((s) => s.aptFrames ?? []);
  const boxFrames = useStore((s) => s.boxFrames ?? []);
  const equipFrame = useStore((s) => s.equipFrame);

  const user = useAuth((s) => s.user);
  const displayName = useAuth((s) => s.displayName);
  const setDisplayName = useAuth((s) => s.setDisplayName);

  const [tab, setTab] = useState<'profile' | 'account'>(initialTab);
  const [editing, setEditing] = useState<null | 'icon' | 'trophy' | 'title'>(null); // tap a header box to open
  const [iconMode, setIconMode] = useState<'horse' | 'frame'>('horse');
  const [frameHint, setFrameHint] = useState<string | null>(null); // 未取得フレームをタップしたときの獲得条件
  const [showCollection, setShowCollection] = useState(false);

  const avatar = useMemo<HorseLook>(() => {
    const byId = avatarHorseId ? horses.find((h) => h.id === avatarHorseId) : null;
    return byId ?? horses[0] ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  // フレーム一覧（目録は logic/frameCatalog.ts に集約）。まだ持っていないものも
  // ぼかして並べる。何があるか見えないと集めようがないため。
  const frameSlots = useMemo(
    () => frameCatalog({ boxFrames, streakClaimed, aptFrames }),
    [streakClaimed, aptFrames, boxFrames],
  );
  // 殿堂フレームは「持っているぶんだけ」を目録のうしろに足す。毎月増えるので
  // 未取得の枠は作らない（作ると一覧が月の数だけ伸びてしまう）。
  const rankFrames = useMemo(() => rankingFrames(mailbox), [mailbox]);

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

  // 称号：いま達成しているものと、装備中のもの。
  const equippedTitle = useStore((s) => s.equippedTitle);
  const equipTitle = useStore((s) => s.equipTitle);
  const ctx = useMemo(() => titleCtx(useStore.getState(), dexPct), [dexPct, horses, trophies, pstats, owned]);
  const active = activeTitle(equippedTitle, ctx);
  // コレクションの入口に出す集まり具合（ctx を使うので、その下で数える）。
  const frameHave = frameSlots.filter((f) => f.owned).length;
  const titleHave = TITLES.filter((t) => t.check(ctx)).length;
  function pickTitle(t: TitleDef) {
    if (!t.check(ctx)) return;
    equipTitle(t.id);
    void setRankingTitle(t.id);
    setEditing(null);
  }

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
        <CloseButton onClick={onClose} />
        {/* Header: tap the avatar to change the icon, tap the shelf to edit trophies */}
        <div className={styles.head}>
          <button
            className={`${styles.avatarBtn} ${equippedFrame ? styles.avatarBare : ''}`}
            onClick={() => { setIconMode('horse'); setEditing('icon'); }}
            aria-label="アイコンを変更"
          >
            {equippedFrame ? (
              <EquippedFrame frame={equippedFrame} look={avatar} size={86} />
            ) : (
              <HorseFace horse={avatar} size={76} />
            )}
            <span className={styles.avatarEdit} aria-hidden>✎</span>
          </button>
          <div className={styles.headInfo}>
            {/* 称号は名前の上。右下のペンで付け替える（アイコンと同じ操作）。 */}
            <button
              className={styles.titleChipBtn}
              onClick={() => setEditing('title')}
              aria-label="称号を変更"
            >
              <TitleBanner title={active} className={styles.titleChipArt} />
              <span className={styles.titleChipStar} aria-hidden>{'★'.repeat(active.tier)}</span>
              <span className={styles.titleChipName}>{active.name}</span>
              <span className={styles.titleChipEdit} aria-hidden>✎</span>
            </button>
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
                {r ? <TrophyIcon rank={r} size={78} /> : null}
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
            <span className={styles.statValue}>{pstats.maxOdds > 0 ? <>{fmtOdds(pstats.maxOdds)}<small>倍</small></> : '—'}</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>最大獲得賞金</span>
            <span className={styles.statValue}><CoinIcon size={14} /> {pstats.maxPayout.toLocaleString()}</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>図鑑コンプリート率</span>
            <span className={styles.statValue}>{dexPct}<small>%</small></span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>ウマ発見数</span>
            <span className={styles.statValue}>{ctx.horsesFound.toLocaleString()}<small>頭</small></span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statLabel}>対戦勝利数</span>
            <span className={styles.statValue}>{ctx.arenaWins.toLocaleString()}<small>回</small></span>
          </div>
          <div className={`${styles.statCell} ${styles.statWide}`}>
            <span className={styles.statLabel}>総獲得賞金</span>
            <span className={styles.statValue}><CoinIcon size={14} /> {(pstats.totalEarned ?? 0).toLocaleString()}</span>
          </div>
        </div>

        {/* コレクション：フレームと称号が「あと何で埋まるか」を眺める場所。 */}
        <button className={styles.collectionBtn} onClick={() => setShowCollection(true)}>
          <span className={styles.collectionLabel}><Icon name="book" size={16} /> コレクション</span>
          <span className={styles.collectionCount}>フレーム {frameHave}/{frameSlots.length}・称号 {titleHave}/{TITLES.length}</span>
        </button>

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

      </div>

      {/* Icon editor (opened by tapping the avatar) */}
      {editing === 'icon' && (
        <div className={styles.editorOverlay} onClick={() => setEditing(null)}>
          <div className={styles.editorCard} onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={() => setEditing(null)} />
            <div className={styles.editorHead}>
              <h3 className={styles.editorTitle}>アイコン設定</h3>
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
            ) : (
              <>
                <div className={styles.frameGrid}>
                  {/* フレームを外す（文字は置かない。素の顔が「なし」そのもの） */}
                  <button
                    className={`${styles.framePick} ${!equippedFrame ? styles.picked : ''}`}
                    onClick={() => equip(null)}
                    aria-label="フレームなし"
                  >
                    <div className={styles.frameFace}><HorseFace horse={avatar} size={56} /></div>
                    {!equippedFrame && <span className={styles.frameTag}>装備中</span>}
                  </button>
                  {frameSlots.map(({ key, frame, owned: got, hint }) => {
                    const on = got && sameFrame(equippedFrame, frame);
                    return (
                      <button
                        key={key}
                        className={`${styles.framePick} ${on ? styles.picked : ''} ${got ? '' : styles.frameLocked}`}
                        onClick={() => { if (got) equip(frame); else setFrameHint(hint); }}
                        aria-label={got ? 'フレーム' : `未取得のフレーム：${hint}`}
                      >
                        <span className={got ? undefined : styles.frameBlur}>
                          <EquippedFrame frame={frame} look={avatar} size={56} />
                        </span>
                        {on && <span className={styles.frameTag}>装備中</span>}
                      </button>
                    );
                  })}
                  {/* 殿堂（月間トップ3）。持っているものだけを後ろに並べる。 */}
                  {rankFrames.map((f) => {
                    const on = sameFrame(equippedFrame, f);
                    return (
                      <button
                        key={`rank-${f.period}-${f.rank}-${f.metric}`}
                        className={`${styles.framePick} ${on ? styles.picked : ''}`}
                        onClick={() => equip(f)}
                        aria-label={`殿堂フレーム ${frameAwardLabel(f)}`}
                      >
                        <EquippedFrame frame={f} look={avatar} size={56} />
                        {on && <span className={styles.frameTag}>装備中</span>}
                      </button>
                    );
                  })}
                </div>
                <p className={styles.hint}>
                  {frameHint ?? 'タップでアイコンに装備できます。ぼやけているものはまだ持っていません。'}
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* 称号エディタ（名前の上のバッジをタップ） */}
      {editing === 'title' && (
        <div className={styles.editorOverlay} onClick={() => setEditing(null)}>
          <div className={styles.editorCard} onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={() => setEditing(null)} />
            <div className={styles.editorHead}>
              <h3 className={styles.editorTitle}>称号をえらぶ</h3>
            </div>
        <ul className={styles.titleList}>
              {TITLES.map((t) => {
                const got = t.check(ctx);
                const on = active.id === t.id;
                return (
                  <li key={t.id}>
                    <button
                      className={`${styles.titleCard} ${on ? styles.titleOn : ''} ${got ? '' : styles.titleLocked}`}
                      onClick={() => pickTitle(t)}
                      disabled={!got}
                    >
                      <TitleBanner title={t} className={styles.titleArt} />
                      <span className={styles.titleBody}>
                        <span className={styles.titleName}>{t.name}</span>
                        <span className={styles.titleDesc}>{t.desc}</span>
                        <span className={styles.titleTier}>{'★'.repeat(t.tier)}</span>
                      </span>
                      {on && <span className={styles.titleCheck}>✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* Trophy editor (opened by tapping the shelf) */}
      {editing === 'trophy' && (
        <div className={styles.editorOverlay} onClick={() => setEditing(null)}>
          <div className={styles.editorCard} onClick={(e) => e.stopPropagation()}>
            <CloseButton onClick={() => setEditing(null)} />
            <div className={styles.editorHead}>
              <h3 className={styles.editorTitle}>トロフィーを飾る（{shelf.length}/{SLOTS}）</h3>
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

      {showCollection && <CollectionModal look={avatar} onClose={() => setShowCollection(false)} />}
    </div>
  );
}
