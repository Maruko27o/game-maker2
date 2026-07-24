import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './UpdateGate.module.css';

// Detects that a newer version has been deployed (the served version.json differs
// from the version baked into this running bundle) and prompts the player to
// update. The update button clears caches/service workers and reloads fresh.
//
// 「今すぐ更新」が何度も出る問題対策：同じデプロイ版に対して一度「更新」または「あとで」
// を選んだら、そのバージョンでは二度と促さない（handled をローカルに記録）。これにより
// フォーカスのたびに再表示されたり、端末キャッシュで更新が反映されず無限ループになるのを防ぐ。
// 本当に新しいデプロイ（version が変わったとき）だけ、改めて1回だけ案内する。
const HANDLED_KEY = 'updateGate:handledVersion';

function readHandled(): string | null {
  try {
    return localStorage.getItem(HANDLED_KEY);
  } catch {
    return null;
  }
}
function writeHandled(v: string | null): void {
  try {
    if (v) localStorage.setItem(HANDLED_KEY, v);
    else localStorage.removeItem(HANDLED_KEY);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

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
  const deployedRef = useRef<string | null>(null);

  const check = useCallback(async () => {
    const deployed = await fetchDeployedVersion();
    deployedRef.current = deployed;
    // 取得失敗、または今動いているバージョンが最新なら出さない。
    if (!deployed || deployed === __APP_VERSION__) {
      if (deployed === __APP_VERSION__) writeHandled(null); // 最新に追いついたら記録をクリア
      setStale(false);
      return;
    }
    // このデプロイ版には既に一度対応済み（更新試行 or あとで）なら、もう促さない。
    if (deployed === readHandled()) {
      setStale(false);
      return;
    }
    setStale(true);
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  function later() {
    writeHandled(deployedRef.current); // このバージョンでは以後促さない
    setStale(false);
  }

  async function update() {
    setBusy(true);
    // 先に「対応済み」を記録：万一この更新でも反映されなくても、無限ループにならないように。
    writeHandled(deployedRef.current);
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
        <button className={styles.later} onClick={later} disabled={busy}>
          あとで
        </button>
      </div>
    </div>
  );
}
