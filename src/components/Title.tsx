import { useMemo } from 'react';
import { useStore } from '../store';
import { useAuth, formatPlayerId } from '../cloud';
import { colorsBySlot } from '../data/parts';
import type { HorseLook } from '../types';
import HorseView from './HorseView';
import Icon from './Icon';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Title.module.css';

function randomLook(seed: number): HorseLook {
  const pick = <T,>(a: T[], n: number) => a[Math.floor(Math.abs(n)) % a.length];
  return {
    colors: {
      body: pick(colorsBySlot.body, seed * 3 + 1).id,
      mane: pick(colorsBySlot.mane, seed * 7 + 2).id,
      hoof: pick(colorsBySlot.hoof, seed * 5 + 3).id,
    },
    decos: {},
  };
}

// Title screen (ACCOUNT.md §3): a calm way into the game. Tap anywhere to start;
// shows the signed-in player's ID. Three horses graze idly in the meadow.
export default function Title({ onStart }: { onStart: () => void }) {
  const horses = useStore((s) => s.horses);
  const user = useAuth((s) => s.user);
  const playerNo = useAuth((s) => s.playerNo);
  const setWantAccount = useAuth((s) => s.setWantAccount);
  const reduced = usePrefersReducedMotion();

  // Prefer the player's own horses (nice to see them here), else random ones.
  const cast = useMemo<HorseLook[]>(() => {
    const owned = horses.slice(0, 3);
    const out: HorseLook[] = owned.map((h) => ({ colors: h.colors, decos: h.decos }));
    for (let i = out.length; i < 3; i++) out.push(randomLook(Date.now() / 1000 + i * 97));
    return out;
  }, [horses]);

  function start() {
    if (!user) setWantAccount(true); // not signed in → nudge to log in / register
    onStart();
  }

  return (
    <div className={styles.screen} onClick={start} role="button" aria-label="タップしてスタート">
      <div className={styles.sky} />
      <div className={styles.hill} />

      <h1 className={`${styles.logo} ${reduced ? '' : styles.logoIn}`}>ウマあつめ</h1>

      <div className={styles.meadow}>
        {cast.map((look, i) => (
          <div
            key={i}
            className={`${styles.grazer} ${reduced ? '' : styles.graze}`}
            style={{ animationDelay: `${i * 1.3}s`, zIndex: i }}
          >
            <HorseView horse={look} size={120} shadow />
          </div>
        ))}
      </div>

      <div className={`${styles.tap} ${reduced ? '' : styles.blink}`}>タップしてスタート</div>

      <div className={styles.foot} onClick={(e) => e.stopPropagation()}>
        {user && playerNo != null ? (
          <span className={styles.id}>{formatPlayerId(playerNo)}</span>
        ) : (
          <span className={styles.id}>{user ? 'ログイン中' : 'ゲスト'}</span>
        )}
        <button
          className={styles.gear}
          aria-label="設定・アカウント"
          onClick={() => {
            setWantAccount(true);
            onStart();
          }}
        >
          <Icon name="gear" size={18} />
        </button>
      </div>
    </div>
  );
}
