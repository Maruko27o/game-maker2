import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from './store';
import { useAuth } from './cloud';
import CloudSync from './components/CloudSync';
import SyncConflictModal from './components/SyncConflictModal';
import ProfileButton from './components/ProfileButton';
import TaskButton from './components/TaskButton';
import MailButton from './components/MailButton';
import UpdateGate from './components/UpdateGate';
import CoinBalance from './components/CoinBalance';
import Title from './components/Title';
import Icon, { type IconName } from './components/Icon';
import styles from './App.module.css';

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: '草むら', icon: 'leaf', end: true },
  { to: '/stable', label: 'マイウマ', icon: 'horse' },
  { to: '/collection', label: '図鑑', icon: 'book' },
  { to: '/race', label: 'レース', icon: 'flag' },
  { to: '/ranking', label: 'ランキング', icon: 'trophy' },
];

// Which screen's fixed background accent to show. The accent lives on <main>
// (the scroll container) so it — like the wood wall — stays put while the page
// content scrolls. 草むら is intentionally left plain (its room art covers it).
function screenOf(pathname: string): string {
  if (pathname.startsWith('/stable')) return 'stable';
  if (pathname.startsWith('/collection')) return 'collection';
  if (pathname.startsWith('/race')) return 'race';
  if (pathname.startsWith('/ranking')) return 'ranking';
  if (pathname.startsWith('/hall')) return 'ranking';
  return 'grass';
}

export default function App() {
  const migrated = useStore((s) => s.migrated);
  const clearMigrated = useStore((s) => s.clearMigrated);
  const screen = screenOf(useLocation().pathname);
  const raceBusy = useStore((s) => s.raceBusy);

  // 未ログインのまま育てていると、端末のブラウザからデータが消えた時に戻す手段が
  // 何も無い（iOS Safari はホーム画面に追加していないサイトの保存領域を消す）。
  // ある程度ウマが増えてから、失うと痛い人にだけ一度知らせる。
  const authReady = useAuth((s) => s.ready);
  const cloudConfigured = useAuth((s) => s.configured);
  const signedIn = useAuth((s) => !!s.user);
  const setWantAccount = useAuth((s) => s.setWantAccount);
  const horseCount = useStore((s) => s.horses.length);
  const [guestSeen, setGuestSeen] = useState(() => {
    try {
      return !!sessionStorage.getItem('seenGuestWarn');
    } catch {
      return false;
    }
  });
  function dismissGuest() {
    try {
      sessionStorage.setItem('seenGuestWarn', '1');
    } catch {
      /* ignore */
    }
    setGuestSeen(true);
  }
  // レース中は同じ位置に別の告知が出るので出さない（重ならないように）。
  const showGuestWarn =
    cloudConfigured && authReady && !signedIn && horseCount >= 3 && !guestSeen && !raceBusy;

  // Show the title once per session (a calm entry point, ACCOUNT.md §3).
  const [showTitle, setShowTitle] = useState(() => {
    try {
      return !sessionStorage.getItem('seenTitle');
    } catch {
      return true;
    }
  });
  function dismissTitle() {
    try {
      sessionStorage.setItem('seenTitle', '1');
    } catch {
      /* ignore */
    }
    setShowTitle(false);
  }
  return (
    <div className={styles.shell}>
      <UpdateGate />
      <CloudSync />
      <SyncConflictModal />
      {showTitle && <Title onStart={dismissTitle} />}
      {/* 上部アイコンの裏を固定の木目バンドで埋める（スクロールしても中身が
          アイコンの裏に透けない様に）。草むらは専用シーンなので出さない。 */}
      <div className={styles.topBand} data-screen={screen} aria-hidden />
      <ProfileButton />
      <TaskButton />
      <MailButton />
      <CoinBalance />
      {migrated && (
        <div className={styles.notice} role="status">
          <span>ステータスの仕組みが変わりました（合計40の割り振り制）。マイウマから1回だけ無料で振り直せます。</span>
          <button className={styles.noticeClose} onClick={clearMigrated} aria-label="閉じる">
            ✕
          </button>
        </div>
      )}
      {showGuestWarn && (
        <div className={`${styles.notice} ${styles.guestNotice}`} role="status">
          <span>未ログインです。この端末からデータが消えると戻せません。</span>
          <button
            className={styles.guestAction}
            onClick={() => { setWantAccount(true); dismissGuest(); }}
          >
            アカウントを作る
          </button>
          <button className={styles.noticeClose} onClick={dismissGuest} aria-label="閉じる">
            ✕
          </button>
        </div>
      )}
      {raceBusy && (
        <div className={styles.busyNote} role="status">レース中はほかの画面に移動できません</div>
      )}
      <main className={styles.main} data-screen={screen}>
        <Outlet />
      </main>
      <nav className={styles.nav} aria-label="メインメニュー">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            // レース進行中はタブ移動を止める。賭け金を預けたまま他の画面へ行くと
            // コインだけ減って馬券が消えるため（グランプリのパドックで発生していた）。
            onClick={(e) => { if (raceBusy) e.preventDefault(); }}
            aria-disabled={raceBusy || undefined}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''} ${raceBusy ? styles.tabLocked : ''}`}
          >
            <span className={styles.icon} aria-hidden>
              <Icon name={item.icon} size={24} />
            </span>
            <span className={styles.tabLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
