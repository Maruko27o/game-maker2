import { useState } from 'react';
import { useStore, bindSaveKey } from '../store';
import type { SaveData } from '../types';
import { useAuth, cloudSave, backupSave, setOwner, setRev, loadPlayerNo } from '../cloud';
import styles from './SyncConflictModal.module.css';

function ago(ms: number): string {
  if (!ms) return '—';
  const d = Date.now() - ms;
  const m = Math.floor(d / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
}

function Side({ title, save, accent }: { title: string; save: SaveData; accent: string }) {
  return (
    <div className={styles.side} style={{ borderColor: accent }}>
      <div className={styles.sideHead} style={{ background: accent }}>{title}</div>
      <ul className={styles.sideList}>
        <li>ウマ <b>{save.horses.length}</b> 頭</li>
        <li>パーツ <b>{Object.keys(save.owned).length}</b> 種</li>
        <li>トロフィー <b>{save.trophies.length}</b></li>
        <li className={styles.sideTime}>最終更新 {ago(save.savedAt)}</li>
      </ul>
    </div>
  );
}

// Ask the player which save to keep when this device and the server disagree
// (ACCOUNT.md §1.6). The rejected save is backed up for 7 days.
export default function SyncConflictModal() {
  const conflict = useAuth((s) => s.conflict);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<null | 'device' | 'server'>(null);
  if (!conflict) return null;
  const { userId, cloud, local } = conflict;

  async function keepDevice() {
    setBusy(true);
    await backupSave(userId, cloud.data, cloud.rev); // stash the server copy for 7 days
    bindSaveKey(userId);
    useStore.getState().hydrate(local); // keep this device's data locally...
    const res = await cloudSave(userId, local, cloud.rev); // ...and push it to the cloud
    setOwner(userId);
    if (res.ok) setRev(res.rev);
    useAuth.getState().setSync(res.ok ? 'saved' : 'error');
    finish();
  }

  async function keepServer() {
    setBusy(true);
    // The device's local save stays in the guest slot as an implicit backup.
    await backupSave(userId, local, null);
    bindSaveKey(userId);
    useStore.getState().hydrate(cloud.data);
    setOwner(userId);
    setRev(cloud.rev);
    useAuth.getState().setSync('saved');
    finish();
  }

  async function finish() {
    const no = await loadPlayerNo();
    useAuth.getState().setPlayerNo(no);
    useAuth.getState().setConflict(null);
    setBusy(false);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <h2 className={styles.title}>データが食い違っています</h2>
        <p className={styles.note}>
          この端末のデータと、アカウント（サーバー）のデータが違います。どちらを使いますか？
          <br />
          選ばなかった方は<strong>7日間バックアップ</strong>として残ります。
        </p>
        <div className={styles.sides}>
          <Side title="この端末" save={local} accent="#3f7fd6" />
          <Side title="サーバー" save={cloud.data} accent="#8c6a41" />
        </div>
        <div className={styles.actions}>
          <button className="btn" disabled={busy} onClick={() => setPending('device')}>
            この端末を使う
          </button>
          <button className="btn neutral" disabled={busy} onClick={() => setPending('server')}>
            サーバーを使う
          </button>
        </div>

        {pending && (
          <div className={styles.confirm}>
            <p className={styles.confirmMsg}>
              本当に<strong>「{pending === 'device' ? 'この端末' : 'サーバー'}」</strong>のデータでよろしいですか？
              <br />
              {pending === 'device'
                ? 'サーバー側のデータは、この端末のデータで上書きされます'
                : 'この端末のデータは、サーバーのデータで置きかえられます'}
              （選ばれなかった方は7日間バックアップに残ります）。
            </p>
            <div className={styles.actions}>
              <button
                className="btn"
                disabled={busy}
                onClick={() => (pending === 'device' ? keepDevice() : keepServer())}
              >
                はい、これでOK
              </button>
              <button className="btn neutral" disabled={busy} onClick={() => setPending(null)}>
                戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
