import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { setRankingFrame } from '../cloud';
import { monthLabel } from '../logic/period';
import type { FrameAward, HorseLook, MailItem } from '../types';
import Icon from './Icon';
import AvatarFrame from './AvatarFrame';
import HorseFace from './HorseFace';
import styles from './MailButton.module.css';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };
const metricLabel = (m: FrameAward['metric']) => (m === 'payout' ? '最大獲得賞金' : '最大オッズ');
const frameTitle = (f: FrameAward) => `${monthLabel(f.period)} ${metricLabel(f.metric)} ${f.rank}位`;
const sameFrame = (a: FrameAward | null | undefined, b: FrameAward) => !!a && a.period === b.period && a.rank === b.rank && a.metric === b.metric;

// Top-bar mailbox (タスクの横). フレーム配布のほか、今後の補填・お知らせにも使う汎用受信箱。
export default function MailButton() {
  const mailbox = useStore((s) => s.mailbox ?? []);
  const equippedFrame = useStore((s) => s.equippedFrame ?? null);
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const markMailRead = useStore((s) => s.markMailRead);
  const equipFrame = useStore((s) => s.equipFrame);

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<MailItem | null>(null);

  const unread = mailbox.filter((m) => !m.read).length;
  const look = useMemo<HorseLook>(() => {
    const h = avatarHorseId ? horses.find((x) => x.id === avatarHorseId) : horses[0];
    return h ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  function openMail(m: MailItem) {
    if (!m.read) markMailRead(m.id);
    setDetail(m);
  }

  // Equip/unequip locally *and* mirror it to the player's ranking row so everyone
  // sees the frame on their line (best-effort; no-op when signed out / offline).
  function equip(frame: FrameAward | null) {
    equipFrame(frame);
    void setRankingFrame(frame);
  }

  return (
    <>
      <button className={styles.fab} onClick={() => setOpen(true)} aria-label="メールボックス">
        <Icon name="mail" size={22} />
        {unread > 0 && <span className={styles.badge} aria-hidden>{unread}</span>}
      </button>

      {open && (
        <div className={styles.overlay} onClick={() => { setOpen(false); setDetail(null); }}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.head}>
              <h2 className={styles.h2}><Icon name="mail" size={20} /> メールボックス</h2>
              <button className={styles.close} onClick={() => { setOpen(false); setDetail(null); }} aria-label="閉じる">✕</button>
            </div>

            {mailbox.length === 0 ? (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}><Icon name="mail" size={38} /></div>
                <p>メールはまだありません。</p>
                <p className={styles.emptySub}>ランキングで月間トップ3に入ると、翌月フレームが届きます。</p>
              </div>
            ) : (
              <ul className={styles.list}>
                {mailbox.map((m) => (
                  <li key={m.id}>
                    <button className={`${styles.row} ${m.read ? '' : styles.unread}`} onClick={() => openMail(m)}>
                      {m.kind === 'frame' && m.frame ? (
                        <>
                          <span className={styles.thumb}><AvatarFrame rank={m.frame.rank} metric={m.frame.metric} period={m.frame.period} look={look} size={52} /></span>
                          <span className={styles.rowText}>
                            <span className={styles.rowTitle}>アイコンフレーム獲得！</span>
                            <span className={styles.rowSub}>{frameTitle(m.frame)}</span>
                          </span>
                        </>
                      ) : (
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>{m.title ?? 'おしらせ'}</span>
                          <span className={styles.rowSub}>{m.body ?? ''}</span>
                        </span>
                      )}
                      {!m.read && <span className={styles.dot} aria-hidden />}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className={styles.foot}>受信箱は今後、補填やお知らせにも使われます。</p>
          </div>

          {detail && detail.kind === 'frame' && detail.frame && (
            <div className={styles.detailOverlay} onClick={() => setDetail(null)}>
              <div className={styles.detailCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.congrats}>殿堂入りおめでとう！</div>
                <div className={styles.detailFrame}>
                  <AvatarFrame rank={detail.frame.rank} metric={detail.frame.metric} period={detail.frame.period} look={look} size={168} />
                </div>
                <div className={styles.detailTitle}>{frameTitle(detail.frame)}</div>
                <div className={styles.detailActions}>
                  {sameFrame(equippedFrame, detail.frame) ? (
                    <button className="btn neutral" onClick={() => equip(null)}>はずす</button>
                  ) : (
                    <button className="btn" onClick={() => equip(detail.frame!)}>アイコンにつける</button>
                  )}
                  <button className="btn neutral" onClick={() => setDetail(null)}>とじる</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// A player icon optionally wrapped in their equipped frame — reused by ProfileButton.
export function FramedFace({ look, size, frame }: { look: HorseLook; size: number; frame: FrameAward | null }) {
  if (frame) return <AvatarFrame rank={frame.rank} metric={frame.metric} period={frame.period} look={look} size={size} />;
  return <HorseFace horse={look} size={size} />;
}
