import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from './store';
import CloudSync from './components/CloudSync';
import SyncConflictModal from './components/SyncConflictModal';
import AccountButton from './components/AccountButton';
import CoinBalance from './components/CoinBalance';
import Title from './components/Title';
import styles from './App.module.css';

const NAV = [
  { to: '/', label: '草むら', icon: '🌿', end: true },
  { to: '/stable', label: 'マイウマ', icon: '🐴' },
  { to: '/create', label: 'つくる', icon: '🎨' },
  { to: '/collection', label: '図鑑', icon: '📖' },
  { to: '/race', label: 'レース', icon: '🏁' },
  { to: '/ranking', label: 'ランキング', icon: '⭐' },
];

export default function App() {
  const migrated = useStore((s) => s.migrated);
  const clearMigrated = useStore((s) => s.clearMigrated);
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
      <CloudSync />
      <SyncConflictModal />
      {showTitle && <Title onStart={dismissTitle} />}
      <CoinBalance />
      <AccountButton />
      {migrated && (
        <div className={styles.notice} role="status">
          <span>ステータスの仕組みが変わりました（合計40の割り振り制）。マイウマから1回だけ無料で振り直せます🏁</span>
          <button className={styles.noticeClose} onClick={clearMigrated} aria-label="閉じる">
            ✕
          </button>
        </div>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.nav} aria-label="メインメニュー">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `${styles.tab} ${isActive ? styles.active : ''}`}
          >
            <span className={styles.icon} aria-hidden>
              {item.icon}
            </span>
            <span className={styles.tabLabel}>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
