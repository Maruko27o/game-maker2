import { useRef, useState } from 'react';
import { useStore, migrate } from '../store';
import { useAuth } from '../cloud';
import CoinIcon from './CoinIcon';
import styles from './BackupPanel.module.css';

// 「セーブが消えた」を自力で復旧できるようにするための手元バックアップ。
// クラウド同期（ログイン）が第一の守りで、これは第二の守り：
//   ・ログインしていない端末はブラウザのストレージが消えたら終わり（iPhone の
//     Safari はホーム画面に追加していないサイトを7日で消す）。
//   ・ログインしていても「うっかり上書き」は起こり得るので、節目で書き出せると安心。
// 端末に書き出したファイルはこのゲームの外に残るので、サーバ側に何も無くても戻せる。

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function fmtDate(ms: number | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Preview = { json: string; horses: number; coins: number; savedAt: number | undefined };

export default function BackupPanel() {
  const exportSave = useStore((s) => s.exportSave);
  const importSave = useStore((s) => s.importSave);
  const horseCount = useStore((s) => s.horses.length);
  const coins = useStore((s) => s.coins);
  const savedAt = useStore((s) => s.savedAt);
  const configured = useAuth((s) => s.configured);
  const user = useAuth((s) => s.user);

  const fileRef = useRef<HTMLInputElement>(null);
  const [outMsg, setOutMsg] = useState<string | null>(null);
  const [inMsg, setInMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [done, setDone] = useState(false);

  function download() {
    const json = exportSave();
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `umaatsume-${stamp(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setOutMsg('バックアップを書き出しました。ファイルは消さずに保管してね。');
    } catch {
      setOutMsg('書き出せませんでした。下の「文字でコピー」を使ってね。');
    }
  }

  async function copyText() {
    const json = exportSave();
    try {
      await navigator.clipboard.writeText(json);
      setOutMsg('コピーしました。メモアプリなどに貼り付けて保管してね。');
    } catch {
      setOutMsg('コピーできませんでした。ブラウザの設定で許可が必要かもしれません。');
    }
  }

  // 読み込む前に中身を見せる。ここではまだ何も書き換えない（誤爆防止の一段目）。
  function inspect(json: string) {
    setInMsg(null);
    let parsed: { data: { horses?: unknown[]; coins?: number; savedAt?: number } } | null = null;
    try {
      parsed = migrate(JSON.parse(json));
    } catch {
      parsed = null;
    }
    if (!parsed) {
      setPreview(null);
      setInMsg('このファイルは読み込めません（うまあつめのバックアップではないようです）。');
      return;
    }
    setPreview({
      json,
      horses: parsed.data.horses?.length ?? 0,
      coins: parsed.data.coins ?? 0,
      savedAt: parsed.data.savedAt,
    });
  }

  async function pickFile(f: File | null | undefined) {
    if (!f) return;
    try {
      inspect(await f.text());
    } catch {
      setInMsg('ファイルを読めませんでした。もう一度選んでね。');
    }
  }

  // 二段目：中身を確認した上での確定。ここで初めて今のデータが置き換わる。
  function confirmImport() {
    if (!preview) return;
    const ok = importSave(preview.json);
    setPreview(null);
    if (ok) {
      setDone(true);
      setInMsg('読み込みました！' + (user ? 'クラウドにも保存されます。' : ''));
    } else {
      setInMsg('読み込みに失敗しました。データが壊れているかもしれません。');
    }
  }

  return (
    <div className={styles.wrap}>
      <h4 className={styles.title}>データのバックアップ</h4>

      {configured && !user && (
        <p className={styles.warn}>
          いまログインしていません。データは<strong>この端末のブラウザだけ</strong>に入っているので、
          ブラウザのデータを消したり、iPhoneのSafariでしばらく開かなかったりすると
          <strong>元に戻せなくなります</strong>。上の「新規登録」でアカウントを作るのが一番安全です。
        </p>
      )}

      <div className={styles.card}>
        <p className={styles.lead}>いまのデータ</p>
        <p className={styles.summary}>
          ウマ <b>{horseCount}</b>頭 ／ <CoinIcon size={13} /> <b>{coins.toLocaleString()}</b>
          <span className={styles.at}>最終更新 {fmtDate(savedAt)}</span>
        </p>
        <div className={styles.row}>
          <button className="btn" onClick={download}>ファイルに書き出す</button>
          <button className="btn neutral" onClick={copyText}>文字でコピー</button>
        </div>
        {outMsg && <p className={styles.msg}>{outMsg}</p>}
      </div>

      <div className={styles.card}>
        <p className={styles.lead}>バックアップから戻す</p>
        <p className={styles.note}>
          書き出したファイルを選ぶと、中身を確認してから読み込めます。
          読み込むと<strong>いまのデータは置き換わります</strong>。
        </p>
        <div className={styles.row}>
          <button className="btn neutral" onClick={() => fileRef.current?.click()}>ファイルを選ぶ</button>
          <button className="btn neutral" onClick={() => setPasteOpen((v) => !v)}>
            文字で貼り付け {pasteOpen ? '▲' : '▼'}
          </button>
        </div>
        <input
          ref={fileRef}
          className={styles.file}
          type="file"
          accept="application/json,.json,text/plain"
          onChange={(e) => {
            void pickFile(e.target.files?.[0]);
            e.target.value = ''; // 同じファイルを選び直せるように
          }}
        />
        {pasteOpen && (
          <div className={styles.pasteBox}>
            <textarea
              className={styles.textarea}
              placeholder="コピーしたバックアップの文字を貼り付け"
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
            <button className="btn neutral" onClick={() => inspect(pasted.trim())} disabled={!pasted.trim()}>
              中身を確認する
            </button>
          </div>
        )}

        {preview && (
          <div className={styles.confirm}>
            <p className={styles.confirmHead}>このバックアップを読み込みますか？</p>
            <p className={styles.summary}>
              ウマ <b>{preview.horses}</b>頭 ／ <CoinIcon size={13} /> <b>{preview.coins.toLocaleString()}</b>
              <span className={styles.at}>保存 {fmtDate(preview.savedAt)}</span>
            </p>
            <p className={styles.confirmWarn}>いまのデータ（ウマ{horseCount}頭）は置き換わります。</p>
            <div className={styles.row}>
              <button className="btn secondary" onClick={confirmImport}>読み込む</button>
              <button className="btn neutral" onClick={() => setPreview(null)}>やめる</button>
            </div>
          </div>
        )}

        {inMsg && <p className={done ? styles.okMsg : styles.msg}>{inMsg}</p>}
      </div>
    </div>
  );
}
