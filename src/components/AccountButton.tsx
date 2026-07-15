import { useEffect, useState } from 'react';
import { useAuth, signIn, signUp, signOut, changePassword, formatPlayerId, saveDisplayName } from '../cloud';
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
  const [identifier, setIdentifier] = useState(''); // player number (or legacy email)
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState(''); // signup confirm
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    if (mode === 'signup' && password !== password2) {
      setMsg('パスワードが一致しません。');
      return;
    }
    setBusy(true);
    setMsg(null);
    const err = mode === 'login' ? await signIn(identifier, password) : await signUp(password);
    setBusy(false);
    if (err) {
      setMsg(err);
    } else {
      setPassword('');
      setPassword2('');
      if (mode === 'signup') setMsg('登録しました！このあと表示される「プレイヤーID」を必ずメモしてね。');
    }
  }

  // ---- password change (旧確認 → 新 → 確認) --------------------------------
  const [pwOpen, setPwOpen] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState(false);

  async function changePw() {
    setPwOk(false);
    if (newPw.length < 6) {
      setPwMsg('新しいパスワードは6文字以上にしてください。');
      return;
    }
    if (newPw !== newPw2) {
      setPwMsg('新しいパスワードが一致しません。');
      return;
    }
    setPwBusy(true);
    setPwMsg(null);
    const err = await changePassword(oldPw, newPw);
    setPwBusy(false);
    if (err) {
      setPwMsg(err);
    } else {
      setPwOk(true);
      setPwMsg('パスワードを変更しました。');
      setOldPw('');
      setNewPw('');
      setNewPw2('');
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
                {playerNo != null && (
                  <p className={styles.playerId}>
                    プレイヤーID: <strong>{formatPlayerId(playerNo)}</strong>
                  </p>
                )}
                <p className={styles.note}>この番号とパスワードでログインします。番号は忘れずにメモしてね。</p>

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

                {/* Password change (改修：いつでも変更) */}
                <div className={styles.pwBox}>
                  <button className={styles.pwToggle} onClick={() => { setPwOpen((v) => !v); setPwMsg(null); }}>
                    パスワードを変更 {pwOpen ? '▲' : '▼'}
                  </button>
                  {pwOpen && (
                    <div className={styles.pwForm}>
                      <div className={styles.pwField}>
                        <input
                          className={styles.pwInput}
                          type={showOld ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder="いまのパスワード"
                          value={oldPw}
                          onChange={(e) => setOldPw(e.target.value)}
                        />
                        <button
                          className={styles.eyeBtn}
                          type="button"
                          onClick={() => setShowOld((v) => !v)}
                          aria-label={showOld ? 'パスワードを隠す' : 'パスワードを表示'}
                        >
                          <Icon name={showOld ? 'eyeOff' : 'eye'} size={18} />
                        </button>
                      </div>
                      <p className={styles.pwWarn}>※パスワードは誰にも教えないでね。</p>
                      <div className={styles.pwField}>
                        <input
                          className={styles.pwInput}
                          type={showNew ? 'text' : 'password'}
                          autoComplete="new-password"
                          placeholder="新しいパスワード（6文字以上）"
                          value={newPw}
                          onChange={(e) => setNewPw(e.target.value)}
                        />
                        <button
                          className={styles.eyeBtn}
                          type="button"
                          onClick={() => setShowNew((v) => !v)}
                          aria-label={showNew ? 'パスワードを隠す' : 'パスワードを表示'}
                        >
                          <Icon name={showNew ? 'eyeOff' : 'eye'} size={18} />
                        </button>
                      </div>
                      <input
                        className={styles.pwInput}
                        type={showNew ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="新しいパスワード（確認）"
                        value={newPw2}
                        onChange={(e) => setNewPw2(e.target.value)}
                      />
                      {pwMsg && <p className={pwOk ? styles.okMsg : styles.msg}>{pwMsg}</p>}
                      <button
                        className={styles.nameSave}
                        onClick={changePw}
                        disabled={pwBusy || !oldPw || newPw.length < 6 || !newPw2}
                      >
                        {pwBusy ? '…' : '変更する'}
                      </button>
                    </div>
                  )}
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
                {mode === 'login' && (
                  <input
                    className={styles.input}
                    type="text"
                    inputMode="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="プレイヤーID（例: 0000001）"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                )}
                <div className={styles.pwField}>
                  <input
                    className={styles.pwInput}
                    type={showPw ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="パスワード（6文字以上）"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className={styles.eyeBtn}
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'パスワードを隠す' : 'パスワードを表示'}
                  >
                    <Icon name={showPw ? 'eyeOff' : 'eye'} size={18} />
                  </button>
                </div>
                {mode === 'signup' && (
                  <input
                    className={styles.pwInput}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="パスワード（確認）"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                  />
                )}
                {msg && <p className={styles.msg}>{msg}</p>}
                <button
                  className="btn"
                  onClick={submit}
                  disabled={
                    busy ||
                    password.length < 6 ||
                    (mode === 'login' && !identifier.trim()) ||
                    (mode === 'signup' && !password2)
                  }
                >
                  {busy ? '…' : mode === 'login' ? 'ログイン' : '登録する'}
                </button>
                <p className={styles.note}>
                  {mode === 'signup'
                    ? 'パスワードだけで登録します（メールアドレス不要）。登録すると「プレイヤーID（番号）」が発行されます。次からはその番号とパスワードでログインするので、必ずメモしてね。'
                    : 'プレイヤーID（番号）とパスワードでログインします。保存されたデータが読み込まれます（この端末のデータで上書きされません）。'}
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
