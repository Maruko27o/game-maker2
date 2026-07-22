import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store';
import { useAuth, formatPlayerId } from '../cloud';
import { colorsBySlot } from '../data/parts';
import type { HorseLook } from '../types';
import HorseView from './HorseView';
import Icon from './Icon';
import SkyLayers from './SkyLayers';
import { sampleDayNight, clockPhase, lightPool, horseGlowFilter } from '../logic/daynight';
import { usePrefersReducedMotion } from '../hooks';
import styles from './Title.module.css';

const DAY_CYCLE_MS = 3_600_000; // 草むらと同じく1時間で昼→夕→夜→朝を一周（ゆっくり）。

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

// 昼夜サイクルに合わせてタイトル文字色＋発光を補間（昼=濃い茶、夜=金に発光）。
function titleStyle(glow: number, nightMix: number): React.CSSProperties {
  const t = Math.min(1, Math.max(glow, nightMix));
  const r = Math.round(74 + (255 - 74) * t);
  const g = Math.round(52 + (246 - 52) * t);
  const b = Math.round(16 + (222 - 16) * t);
  const dayShadow = `0 3px 0 rgba(243,230,200,${(1 - glow).toFixed(2)}), 0 6px 0 rgba(74,52,16,${(0.25 * (1 - glow)).toFixed(2)})`;
  const glowShadow = glow > 0.02 ? `, 0 0 ${(10 + glow * 18).toFixed(0)}px rgba(255,232,160,${(0.5 + glow * 0.4).toFixed(2)}), 0 0 ${(glow * 34).toFixed(0)}px rgba(255,205,110,${(glow * 0.7).toFixed(2)})` : '';
  return { color: `rgb(${r},${g},${b})`, textShadow: dayShadow + glowShadow };
}

// Title screen (ACCOUNT.md §3): a calm way into the game. Tap anywhere to start;
// shows the signed-in player's ID. Three horses graze in a day↔night meadow.
export default function Title({ onStart }: { onStart: () => void }) {
  const horses = useStore((s) => s.horses);
  const user = useAuth((s) => s.user);
  const playerNo = useAuth((s) => s.playerNo);
  const setWantAccount = useAuth((s) => s.setWantAccount);
  const reduced = usePrefersReducedMotion();

  // Day-night phase: tied to the wall clock so it cycles slowly over 1 hour (same
  // as the meadow). Reduced motion freezes it at daytime.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [reduced]);
  const d = sampleDayNight(reduced ? 0 : clockPhase(now, DAY_CYCLE_MS));

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
      <SkyLayers d={d} reduced={reduced} />
      {/* 丘（2層パララックス）。夜は暗く落とす。 */}
      <div className={styles.hills} style={{ filter: `brightness(${(1 - d.nightMix * 0.5).toFixed(3)}) saturate(${(1 - d.nightMix * 0.15).toFixed(3)})` }}>
        <div className={styles.hillBack} />
        <div className={styles.hillFront} />
      </div>

      <h1 className={`${styles.logo} ${reduced ? '' : styles.logoIn}`} style={titleStyle(d.titleGlow, d.nightMix)}>ウマあつめ</h1>

      <div className={styles.meadow}>
        {d.lightStrength > 0.05 && <div className={styles.lightPool} style={{ background: lightPool(d) }} />}
        {cast.map((look, i) => (
          <div
            key={i}
            className={`${styles.grazer} ${reduced ? '' : styles.graze}`}
            style={{ animationDelay: `${i * 1.3}s`, zIndex: i, filter: horseGlowFilter(d) }}
          >
            <div
              className={styles.hShadow}
              style={{
                width: `${72 + Math.abs(d.shadowDx)}px`,
                transform: `translateX(calc(-50% + ${(d.shadowDx / 2).toFixed(1)}px))`,
                background: `rgba(28,22,30,${d.shadowAlpha})`,
                filter: `blur(${d.shadowBlur}px)`,
              }}
            />
            <HorseView horse={look} size={120} />
          </div>
        ))}
      </div>

      <div className={`${styles.tap} ${reduced ? '' : styles.blink}`} style={{ color: d.nightMix > 0.5 ? '#fff6de' : '#4a3410', background: d.nightMix > 0.5 ? 'rgba(255,240,200,0.16)' : 'rgba(243,230,200,0.7)' }}>タップしてスタート</div>

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
