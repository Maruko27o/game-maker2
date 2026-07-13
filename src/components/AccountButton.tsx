import { useState } from 'react';
import { useAuth, signIn, signUp, signOut } from '../cloud';
import styles from './AccountButton.module.css';

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
  const sync = useAuth((s) => s.sync);

  const [open, setOpen] = useState(false);
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
                <p className={styles.note}>
                  登録すると、いまこの端末にあるデータがそのままアカウントに保存されます。
                </p>
              </div>
            )}

            <button className={styles.closeLink} onClick={() => setOpen(false)}>
              とじる
            </button>
          </div>
        </div>
      )}
    </>
  );
}
