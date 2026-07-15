import { useEffect, useState } from 'react';
import { useAuth, signIn, signUp, signOut, formatPlayerId, saveDisplayName, loginIdFromEmail } from '../cloud';
import { normalizeUsername } from '../logic/username';
import Icon from './Icon';
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
  const playerNo = useAuth((s) => s.playerNo);
  const displayName = useAuth((s) => s.displayName);
  const setDisplayName = useAuth((s) => s.setDisplayName);
  const sync = useAuth((s) => s.sync);

  const wantAccount = useAuth((s) => s.wantAccount);
  const setWantAccount = useAuth((s) => s.setWantAccount);

  const [open, setOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  useEffect(() => setNameDraft(displayName ?? ''), [displayName]);

  async function saveName() {
    const nm = normalizeUsername(nameDraft);
    if (!nm || nm === displayName) return;
    setNameBusy(true);
    const saved = await saveDisplayName(nm);
    setNameBusy(false);
    if (saved) setDisplayName(saved);
  }

  // The title screen (or elsewhere) can request the account panel be opened.
  useEffect(() => {
    if (wantAccount) {
      setOpen(true);
      setWantAccount(false);
    }
  }, [wantAccount, setWantAccount]);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const err = mode === 'login' ? await signIn(loginId.trim(), password) : await signUp(loginId.trim(), password);
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
        <Icon name={signedIn ? 'account' : 'cloud'} size={20} />
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
                {user!.email && <p className={styles.email}>ログインID: {loginIdFromEmail(user!.email)}</p>}
                {playerNo != null && (
                  <p className={styles.playerId}>
                    プレイヤーID: <strong>{formatPlayerId(playerNo)}</strong>
                  </p>
                )}
                {/* Ranking username (改修④) — auto-assigned, editable here. */}
                <div className={styles.nameRow}>
                  <span className={styles.nameLabel}>ランキング名</span>
                  <input
                    className={styles.nameInput}
                    value={nameDraft}
                    maxLength={32}
                    placeholder="なまえ"
                    onChange={(e) => setNameDraft(e.target.value)}
                  />
                  <button
                    className={styles.nameSave}
                    onClick={saveName}
                    disabled={nameBusy || !nameDraft.trim() || nameDraft.trim() === displayName}
                  >
                    {nameBusy ? '…' : '保存'}
                  </button>
                </div>
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
                  type="text"
                  inputMode="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="プレイヤーID（英数字）"
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
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
                <button className="btn" onClick={submit} disabled={busy || loginId.trim().length < 3 || password.length < 6}>
                  {busy ? '…' : mode === 'login' ? 'ログイン' : '登録する'}
                </button>
                <p className={styles.note}>
                  {mode === 'signup'
                    ? 'プレイヤーIDとパスワードで登録します（メールアドレスは不要）。IDとパスワードは忘れないようにメモしてね。いまこの端末にあるデータは、そのままアカウントに保存されます。'
                    : 'プレイヤーIDとパスワードでログインします。保存されたデータが読み込まれます（この端末のデータで上書きされません）。'}
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
