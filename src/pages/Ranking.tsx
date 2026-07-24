import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, loadLeaderboard, type ScoreRow, type RankBy } from '../cloud';
import { useStore } from '../store';
import type { HorseLook, FrameAward } from '../types';
import HorseFace from '../components/HorseFace';
import AvatarFrame from '../components/AvatarFrame';
import TrophyMark from '../components/TrophyMark';
import RankingProfileCard from '../components/RankingProfileCard';
import CoinIcon from '../components/CoinIcon';
import { monthKey, monthLabel, msToNextMonth, splitCountdown } from '../logic/period';
import { trustedNow } from '../logic/trustedClock';
import styles from './Ranking.module.css';

// Unset avatar → the plain starter horse (base colours).
const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };

// Max hit-odds leaderboard (改修④). One row per player — their best winning
// odds, with the player's chosen horse as their icon. Degrades gracefully:
// signed-out players are nudged to log in; if the DB isn't set up the list is empty.
export default function Ranking() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const configured = useAuth((s) => s.configured);
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const displayTrophies = useStore((s) => s.displayTrophies);
  const myFrame = useStore((s) => s.equippedFrame ?? null);
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

  // 今月の対象月（JST）。毎月1日0:00で自動的に新しい月へ切り替わる。
  const period = monthKey();
  // 1秒ごとに更新まで残り時間を再計算（赤いカウントダウン用）。
  const [now, setNow] = useState(() => trustedNow());
  useEffect(() => {
    const t = setInterval(() => setNow(trustedNow()), 1000);
    return () => clearInterval(t);
  }, []);
  const cd = splitCountdown(msToNextMonth(now));

  useEffect(() => {
    let live = true;
    setRows(null);
    const load = () => loadLeaderboard(50, tab, period).then((r) => live && setRows(r));
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
  // 自分の順位（4位以下でも自分のスコアを見せるため）。見つからなければ null。
  const myIdx = user ? shown.findIndex((r) => r.userId === user.id) : -1;
  const myRank = myIdx >= 0 ? myIdx + 1 : null;

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

  const pad = (n: number) => String(n).padStart(2, '0');

  // 1行分の描画（トップ3と「あなたの順位」で共用）。自分の行はローカルの見た目を即時反映。
  function renderRow(r: ScoreRow, place: number) {
    const me = r.userId === user?.id;
    const look: HorseLook = me
      ? myLook
      : r.avatar
        ? { name: '', colors: r.avatar.colors, decos: r.avatar.decos }
        : DEFAULT_LOOK;
    const frame: FrameAward | null = me ? myFrame : r.equippedFrame;
    const facePx = place <= 3 ? 46 : 34;
    return (
      <li
        key={r.userId}
        className={`${styles.row} ${me ? styles.me : ''} ${place <= 3 ? `${styles.top} ${styles['top' + place]}` : ''}`}
        onClick={() => setViewing(withLocal(r))}
        role="button"
        tabIndex={0}
      >
        <span className={`${styles.place} ${medal(place)}`}>{place}</span>
        {frame ? (
          <span className={styles.avatarFramed}>
            <AvatarFrame rank={frame.rank} metric={frame.metric} period={frame.period} look={look} size={facePx} />
          </span>
        ) : (
          <span className={styles.avatar}>
            <HorseFace horse={look} size={facePx} />
          </span>
        )}
        <span className={styles.name}>
          <span className={styles.uname}>{r.username}</span>
          {me && <span className={styles.youTag}>あなた</span>}
        </span>
        <span className={styles.odds}>{metric(r)}</span>
      </li>
    );
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>ランキング</h1>
      <div className={styles.monthBar}>
        <span className={styles.monthName}>{monthLabel(period)}</span>
        <span className={styles.countdown}>
          更新まで <b>{cd.days}日 {pad(cd.h)}:{pad(cd.m)}:{pad(cd.s)}</b>
        </span>
      </div>
      <button className={styles.hallLink} onClick={() => navigate('/hall')}>
        <span className={styles.hallCrest}><TrophyMark size={26} /></span>
        <span className={styles.hallText}>殿堂<small>歴代トップ3を見る</small></span>
        <span className={styles.hallGo}>›</span>
      </button>
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === 'odds' ? styles.tabOn : ''}`} onClick={() => selectTab('odds')}>最大オッズ</button>
        <button className={`${styles.tab} ${tab === 'payout' ? styles.tabOn : ''}`} onClick={() => selectTab('payout')}>最大獲得賞金</button>
      </div>
      <p className={styles.lead}>
        {tab === 'payout'
          ? '1番多く払戻を得たプレイヤーは誰だ！'
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
          {tab === 'payout' ? '今月はまだ記録がありません。馬券を的中させて払戻を得よう！' : '今月はまだ記録がありません。レースで馬券を的中させよう！'}
        </div>
      ) : (
        <>
          <ol className={styles.list}>
            {shown.slice(0, 3).map((r, i) => renderRow(r, i + 1))}
            {shown.length > 3 && (
              <li className={styles.more} aria-hidden="true">
                <span className={styles.moreGhost}></span>
                <span className={styles.moreGhost}></span>
              </li>
            )}
          </ol>

          {/* 4位以下の自分のスコアを、トップ3の下に表示（自分がどの位置か分かるように）。 */}
          {myRank !== null && myRank > 3 && (
            <div className={styles.myRank}>
              <div className={styles.myRankLabel}>あなたの順位</div>
              <ol className={styles.list}>{renderRow(shown[myIdx], myRank)}</ol>
            </div>
          )}
        </>
      )}

      {viewing && <RankingProfileCard row={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
