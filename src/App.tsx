import { NavLink, Outlet } from 'react-router-dom';
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
  return (
    <div className={styles.shell}>
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
