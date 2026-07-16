import { useCallback, useEffect, useState } from 'react';
import styles from './UpdateGate.module.css';

// Detects that a newer version has been deployed (the served version.json differs
// from the version baked into this running bundle) and prompts the player to
// update. The update button clears caches/service workers and reloads fresh.
async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const base = window.location.href.split('#')[0].split('?')[0];
    const url = new URL('version.json', base).toString() + '?t=' + Date.now();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null;
  }
}

export default function UpdateGate() {
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    const deployed = await fetchDeployedVersion();
    if (deployed && deployed !== __APP_VERSION__) setStale(true);
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  async function update() {
    setBusy(true);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore — reload anyway */
    }
    // Cache-bust the document itself so a stale index.html is refetched.
    const u = new URL(window.location.href);
    u.searchParams.set('v', String(Date.now()));
    window.location.replace(u.toString());
  }

  if (!stale) return null;

  return (
    <div className={styles.overlay} role="alertdialog" aria-label="アップデート">
      <div className={styles.card}>
        <div className={styles.emoji} aria-hidden>🎉</div>
        <h2 className={styles.title}>新しいバージョンがあります</h2>
        <p className={styles.text}>
          最新の「ウマあつめ」に更新できます。
          <br />
          更新すると新しい機能や修正が反映されます。
        </p>
        <button className={styles.btn} onClick={update} disabled={busy}>
          {busy ? '更新中…' : '今すぐ更新'}
        </button>
        <button className={styles.later} onClick={() => setStale(false)} disabled={busy}>
          あとで
        </button>
      </div>
    </div>
  );
}
