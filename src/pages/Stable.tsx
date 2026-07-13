import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, MAX_HORSES } from '../store';
import HorseView from '../components/HorseView';
import styles from './Stable.module.css';

export default function Stable() {
  const navigate = useNavigate();
  const horses = useStore((s) => s.horses);
  const renameHorse = useStore((s) => s.renameHorse);
  const removeHorse = useStore((s) => s.removeHorse);

  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const selected = horses.find((h) => h.id === openId) ?? null;

  function close() {
    setOpenId(null);
    setConfirmDelete(false);
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>マイウマ</h1>
        <span className={styles.count}>
          {horses.length}/{MAX_HORSES}
        </span>
      </header>

      {horses.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyEmoji}>🐴</div>
          <p>まだウマがいません。</p>
          <p className={styles.emptySub}>草むらでパーツをあつめて、ウマをつくろう！</p>
          <button className="btn" onClick={() => navigate('/create')}>
            ウマをつくる
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {horses.map((h) => (
            <button key={h.id} className={styles.card} onClick={() => setOpenId(h.id)}>
              <div className={styles.cardThumb}>
                <HorseView horse={h} size={130} shadow />
              </div>
              <div className={styles.cardName}>{h.name}</div>
            </button>
          ))}
          {horses.length < MAX_HORSES && (
            <button className={styles.add} onClick={() => navigate('/create')}>
              <span className={styles.plus}>＋</span>
              <span>つくる</span>
            </button>
          )}
        </div>
      )}

      {selected && (
        <div className={styles.overlay} onClick={close}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalThumb}>
              <HorseView horse={selected} size={240} shadow />
            </div>
            <input
              className={styles.nameInput}
              value={selected.name}
              maxLength={12}
              onChange={(e) => renameHorse(selected.id, e.target.value)}
              aria-label="なまえ"
            />

            {confirmDelete ? (
              <div className={styles.confirm}>
                <p className={styles.confirmText}>
                  「{selected.name}」を消しますか？<br />
                  <strong>消すと戻せません。</strong>
                </p>
                <div className={styles.row}>
                  <button className="btn neutral" onClick={() => setConfirmDelete(false)}>
                    やめる
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => {
                      removeHorse(selected.id);
                      close();
                    }}
                  >
                    けす
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button className="btn" onClick={() => navigate(`/create?edit=${selected.id}`)}>
                  なおす
                </button>
                <button className="btn secondary" onClick={() => setConfirmDelete(true)}>
                  けす
                </button>
                <button className="btn neutral" onClick={close}>
                  とじる
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
