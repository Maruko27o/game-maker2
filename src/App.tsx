import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from './store';
import CloudSync from './components/CloudSync';
import AccountButton from './components/AccountButton';
import styles from './App.module.css';

const NAV = [
  { to: '/', label: '草むら', icon: '🌿', end: true },
  { to: '/stable', label: 'マイウマ', icon: '🐴' },
  { to: '/create', label: 'つくる', icon: '🎨' },
  { to: '/collection', label: '図鑑', icon: '📖' },
  { to: '/race', label: 'レース', icon: '🏁' },
  { to: '/vote', label: '投票', icon: '⭐' },
];

export default function App() {
  const migrated = useStore((s) => s.migrated);
  const clearMigrated = useStore((s) => s.clearMigrated);
  return (
    <div className={styles.shell}>
      <CloudSync />
      <AccountButton />
      {migrated && (
        <div className={styles.notice} role="status">
          <span>アップデート！ウマに能力値が付き、レースが本格化しました🏁</span>
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
