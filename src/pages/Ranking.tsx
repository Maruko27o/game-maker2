import { useEffect, useMemo, useState } from 'react';
import { useAuth, loadLeaderboard, type ScoreRow, type RankBy } from '../cloud';
import { useStore } from '../store';
import type { HorseLook } from '../types';
import HorseFace from '../components/HorseFace';
import RankingProfileCard from '../components/RankingProfileCard';
import CoinIcon from '../components/CoinIcon';
import styles from './Ranking.module.css';

// Unset avatar → the plain starter horse (base colours).
const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// Max hit-odds leaderboard (改修④). One row per player — their best winning
// odds, with the player's chosen horse as their icon. Degrades gracefully:
// signed-out players are nudged to log in; if the DB isn't set up the list is empty.
export default function Ranking() {
  const user = useAuth((s) => s.user);
  const displayName = useAuth((s) => s.displayName);
  const configured = useAuth((s) => s.configured);
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const displayTrophies = useStore((s) => s.displayTrophies);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [viewing, setViewing] = useState<ScoreRow | null>(null); // profile card being shown
  // Remember the chosen tab across reloads (pull-to-refresh reloads the page), so
  // it doesn't snap back to 最大オッズ. Persisted in localStorage.
  const [tab, setTab] = useState<RankBy>(() => {
    try {
      return localStorage.getItem('rankTab') === 'payout' ? 'payout' : 'odds';
    } catch {
      return 'odds';
    }
  });
  function selectTab(t: RankBy) {
    setTab(t);
    try {
      localStorage.setItem('rankTab', t);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    let live = true;
    setRows(null);
    const load = () => loadLeaderboard(50, tab).then((r) => live && setRows(r));
    load();
    // Re-fetch when the tab regains focus, so changes made elsewhere show up.
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => {
      live = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [user, tab]);

  const metric = (r: ScoreRow) =>
    tab === 'payout'
      ? <><CoinIcon size={14} /> {r.bestPayout.toLocaleString()}</>
      : <>{r.bestOdds.toFixed(1)}倍</>;
  const shown = (rows ?? []).filter((r) => (tab === 'payout' ? r.bestPayout > 0 : r.bestOdds > 0));

  // The signed-in player's own avatar + trophies come from the local store, so
  // their own row/card always reflects their current settings immediately (even
  // before the server round-trips).
  const myLook = useMemo<HorseLook>(() => {
    const h = avatarHorseId ? horses.find((x) => x.id === avatarHorseId) : horses[0];
    return h ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  function withLocal(r: ScoreRow): ScoreRow {
    if (!user || r.userId !== user.id) return r;
    const h = avatarHorseId ? horses.find((x) => x.id === avatarHorseId) : horses[0];
    return { ...r, avatar: h ? { colors: h.colors, decos: h.decos } : r.avatar, displayTrophies };
  }

  function medal(place: number): string {
    return place === 1 ? styles.gold : place === 2 ? styles.silver : place === 3 ? styles.bronze : '';
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ランキング</h1>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'odds' ? styles.tabOn : ''}`} onClick={() => selectTab('odds')}>最大オッズ</button>
        <button className={`${styles.tab} ${tab === 'payout' ? styles.tabOn : ''}`} onClick={() => selectTab('payout')}>最大獲得賞金</button>
      </div>
      <p className={styles.lead}>
        {tab === 'payout'
          ? '1レースの馬券でいちばん多く払戻を得たプレイヤーは誰だ！'
          : 'どんな馬券でも、いちばん高い的中オッズで競争！'}
      </p>

      {!configured ? (
        <div className={styles.note}>クラウド機能が未設定です。</div>
      ) : !user ? (
        <div className={styles.note}>ランキングに載るには、左上のアイコンからログインしてね。</div>
      ) : rows === null ? (
        <div className={styles.note}>読み込み中…</div>
      ) : shown.length === 0 ? (
        <div className={styles.note}>
          {tab === 'payout' ? 'まだ記録がありません。馬券を的中させて払戻を得よう！' : 'まだ記録がありません。レースで馬券を的中させよう！'}
        </div>
      ) : (
        <ol className={styles.list}>
          {shown.slice(0, 5).map((r, i) => {
            const me = r.userId === user.id;
            const place = i + 1;
            const look: HorseLook = me
              ? myLook
              : r.avatar
                ? { name: '', colors: r.avatar.colors, decos: r.avatar.decos }
                : DEFAULT_LOOK;
            return (
              <li
                key={r.userId}
                className={`${styles.row} ${me ? styles.me : ''} ${place <= 3 ? `${styles.top} ${styles['top' + place]}` : ''}`}
                onClick={() => setViewing(withLocal(r))}
                role="button"
                tabIndex={0}
              >
                <span className={`${styles.place} ${medal(place)}`}>{place}</span>
                <span className={styles.avatar}>
                  <HorseFace horse={look} size={place <= 3 ? 46 : 34} />
                </span>
                <span className={styles.name}>
                  {r.username}
                  {me && <span className={styles.youTag}>あなた</span>}
                </span>
                <span className={styles.odds}>{metric(r)}</span>
              </li>
            );
          })}
          {shown.length > 5 && (
            <li className={styles.more} aria-hidden="true">
              <span className={styles.moreDots}><i></i><i></i><i></i></span>
              <span className={styles.moreGhost}></span>
              <span className={styles.moreGhost}></span>
            </li>
          )}
        </ol>
      )}

      {user && (
        <div className={styles.self}>
          <CoinIcon size={16} /> あなたの名前：<b>{displayName ?? '—'}</b>
          <span className={styles.selfHint}>（左上のアイコン→プロフィールから変更できます）</span>
        </div>
      )}

      {viewing && <RankingProfileCard row={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
