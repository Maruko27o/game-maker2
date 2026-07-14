import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { useAuth, signIn, signUp, signOut, resetPassword, formatPlayerId } from '../cloud';
import styles from './AccountButton.module.css';

// Download the current save as a JSON file (offline backup, ACCOUNT.md §0).
function exportToFile() {
  const json = useStore.getState().exportSave();
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `umaatsume-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

const SYNC_LABEL: Record<string, string> = {
  idle: '',
  syncing: '同期中…',
  saved: '同期済み ✓',
  error: '同期エラー',
  offline: 'この端末のみ',
};

export default function AccountButton() {
  const configured = useAuth((s) => s.configured);
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const playerNo = useAuth((s) => s.playerNo);
  const sync = useAuth((s) => s.sync);

  const importSave = useStore((s) => s.importSave);
  const wantAccount = useAuth((s) => s.wantAccount);
  const setWantAccount = useAuth((s) => s.setWantAccount);
  const fileRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);

  // The title screen (or elsewhere) can request the account panel be opened.
  useEffect(() => {
    if (wantAccount) {
      setOpen(true);
      setWantAccount(false);
    }
  }, [wantAccount, setWantAccount]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const err = mode === 'login' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (err) {
      setMsg(err);
    } else {
      setPassword('');
      if (mode === 'signup') setMsg('登録しました！このままログインされます。');
    }
  }

  async function onReset() {
    if (!email.trim()) {
      setMsg('メールアドレスを入力してから「パスワードを忘れた」を押してください。');
      return;
    }
    setBusy(true);
    const err = await resetPassword(email.trim());
    setBusy(false);
    setMsg(err ?? '再設定メールを送りました。メールのリンクから再設定してください。');
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((t) => setMsg(importSave(t) ? 'データを読み込みました。' : '読み込みに失敗しました（ファイルを確認）。'));
    e.target.value = '';
  }

  const signedIn = !!user;

  return (
    <>
      <button
        className={styles.fab}
        onClick={() => setOpen(true)}
        aria-label="アカウント"
        data-state={signedIn ? 'in' : 'out'}
      >
        {signedIn ? '👤' : '☁️'}
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => setOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.title}>アカウント</h2>

            {!configured ? (
              <p className={styles.note}>
                クラウド同期は未設定です。いまは<strong>この端末だけ</strong>にデータが保存されています。
                <br />
                全端末で同期するには、開発者がSupabaseの設定を行う必要があります（README参照）。
              </p>
            ) : !ready ? (
              <p className={styles.note}>読み込み中…</p>
            ) : signedIn ? (
              <div className={styles.signedIn}>
                <p className={styles.email}>📧 {user!.email}</p>
                {playerNo != null && (
                  <p className={styles.playerId}>
                    プレイヤーID: <strong>{formatPlayerId(playerNo)}</strong>
                  </p>
                )}
                <p className={styles.syncLine}>状態: {SYNC_LABEL[sync] || '—'}</p>
                <p className={styles.note}>ログインしたどの端末でもデータが同期されます。</p>
                <button
                  className="btn secondary"
                  onClick={async () => {
                    await signOut();
                    setOpen(false);
                  }}
                >
                  ログアウト
                </button>
              </div>
            ) : (
              <div className={styles.form}>
                <div className={styles.tabs}>
                  <button
                    className={`${styles.tab} ${mode === 'login' ? styles.tabOn : ''}`}
                    onClick={() => { setMode('login'); setMsg(null); }}
                  >
                    ログイン
                  </button>
                  <button
                    className={`${styles.tab} ${mode === 'signup' ? styles.tabOn : ''}`}
                    onClick={() => { setMode('signup'); setMsg(null); }}
                  >
                    新規登録
                  </button>
                </div>
                <input
                  className={styles.input}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="メールアドレス"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <input
                  className={styles.input}
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="パスワード（6文字以上）"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {msg && <p className={styles.msg}>{msg}</p>}
                <button className="btn" onClick={submit} disabled={busy || !email || password.length < 6}>
                  {busy ? '…' : mode === 'login' ? 'ログイン' : '登録する'}
                </button>
                {mode === 'login' && (
                  <button className={styles.textLink} onClick={onReset} disabled={busy}>
                    パスワードを忘れた
                  </button>
                )}
                <p className={styles.note}>
                  {mode === 'signup'
                    ? '登録すると、いまこの端末にあるデータがそのままアカウントに保存されます。'
                    : 'ログインすると、アカウントに保存されたデータが読み込まれます（この端末のデータで上書きされません）。'}
                </p>
              </div>
            )}

            {/* Local backup — works with or without an account (ACCOUNT.md §0) */}
            <div className={styles.backup}>
              <span className={styles.backupLabel}>データのバックアップ</span>
              <div className={styles.backupRow}>
                <button className="btn neutral" onClick={exportToFile}>書き出す</button>
                <button className="btn neutral" onClick={() => fileRef.current?.click()}>読み込む</button>
              </div>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportFile} />
            </div>

            <button className={styles.closeLink} onClick={() => setOpen(false)}>
              とじる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
