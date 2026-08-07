import { useMemo, useState } from 'react';
import { useStore } from '../store';
import { monthLabel } from '../logic/period';
import type { BoxFrameKind, EquipFrame, FrameAward, HorseLook, MailItem } from '../types';
import { BOXES, boxMailId } from '../data/boxes';
import Icon from './Icon';
import AvatarFrame from './AvatarFrame';
import EquippedFrame from './EquippedFrame';
import HorseFace from './HorseFace';
import BoxOpen from './BoxOpen';
import styles from './MailButton.module.css';
import CloseButton from './CloseButton';

const DEFAULT_LOOK: HorseLook = { name: '', colors: { body: '', mane: '', hoof: '' }, decos: {} };
const metricLabel = (m: FrameAward['metric']) => (m === 'payout' ? '最大獲得賞金' : '最大オッズ');
const frameTitle = (f: FrameAward) => `${monthLabel(f.period)} ${metricLabel(f.metric)} ${f.rank}位`;

// Top-bar mailbox (タスクの横). フレーム配布のほか、今後の補填・お知らせにも使う汎用受信箱。
export default function MailButton() {
  const mailbox = useStore((s) => s.mailbox ?? []);
  const horses = useStore((s) => s.horses);
  const avatarHorseId = useStore((s) => s.avatarHorseId);
  const markMailRead = useStore((s) => s.markMailRead);

  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<MailItem | null>(null);
  const [boxOpen, setBoxOpen] = useState<BoxFrameKind | null>(null);

  const unread = mailbox.filter((m) => !m.read).length;
  const look = useMemo<HorseLook>(() => {
    const h = avatarHorseId ? horses.find((x) => x.id === avatarHorseId) : horses[0];
    return h ?? DEFAULT_LOOK;
  }, [avatarHorseId, horses]);

  // 開封中のボックスの残り個数は store から都度読む（開けるたびに減るので prop 固定にしない）。
  const boxLeft = boxOpen ? (mailbox.find((m) => m.id === boxMailId(boxOpen))?.count ?? 0) : 0;

  function openMail(m: MailItem) {
    if (!m.read) markMailRead(m.id);
    if (m.kind === 'box' && m.box) {
      setBoxOpen(m.box);
      return;
    }
    setDetail(m);
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
            <CloseButton onClick={() => { setOpen(false); setDetail(null); }} />
            <div className={styles.head}>
              <h2 className={styles.h2}><Icon name="mail" size={20} /> メールボックス</h2>
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
                          <span className={styles.thumb}><AvatarFrame rank={m.frame.rank} metric={m.frame.metric} period={m.frame.period} look={look} size={40} /></span>
                          <span className={styles.rowText}>
                            <span className={styles.rowTitle}>アイコンフレーム獲得！</span>
                            <span className={styles.rowSub}>{frameTitle(m.frame)}</span>
                          </span>
                        </>
                      ) : m.kind === 'box' && m.box ? (
                        <>
                          <span
                            className={`${styles.thumb} ${styles.boxThumb}`}
                            style={{ ['--c1' as string]: BOXES[m.box].colors[0], ['--c2' as string]: BOXES[m.box].colors[1] }}
                          >
                            <Icon name={m.box === 'gold' ? 'crown' : 'gift'} size={24} />
                          </span>
                          <span className={styles.rowText}>
                            <span className={styles.rowTitle}>{BOXES[m.box].name}</span>
                            <span className={styles.rowSub}>タップすると開けられるよ</span>
                          </span>
                          <span className={styles.count}>×{m.count ?? 1}</span>
                        </>
                      ) : (
                        <span className={styles.rowText}>
                          <span className={styles.rowTitle}>{m.title ?? 'お知らせ'}</span>
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

          {/* おしらせ（お詫び・補填など）は全文を読める形で開く */}
          {detail && detail.kind !== 'frame' && detail.kind !== 'box' && (
            <div className={styles.detailOverlay} onClick={() => setDetail(null)}>
              <div className={`${styles.detailCard} ${styles.noticeCard}`} onClick={(e) => e.stopPropagation()}>
                <CloseButton onClick={() => setDetail(null)} />
                <div className={styles.noticeTitle}>{detail.title ?? 'お知らせ'}</div>
                <p className={styles.noticeBody}>{detail.body ?? ''}</p>
                <div className={styles.detailActions}>
                  <button className="btn neutral" onClick={() => setDetail(null)}>閉じる</button>
                </div>
              </div>
            </div>
          )}

          {detail && detail.kind === 'frame' && detail.frame && (
            <div className={styles.detailOverlay} onClick={() => setDetail(null)}>
              <div className={styles.detailCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.congrats}>殿堂入りおめでとう！</div>
                <div className={styles.detailFrame}>
                  <AvatarFrame rank={detail.frame.rank} metric={detail.frame.metric} period={detail.frame.period} look={look} size={128} />
                </div>
                <div className={styles.detailTitle}>{frameTitle(detail.frame)}</div>
                {/* 着けかえは「プロフィール → アイコン設定 → フレーム」に一本化した。
                    受信箱と2か所にあると、どちらが本体か分からなくなるため。 */}
                <p className={styles.detailNote}>
                  プロフィール → アイコン設定 → フレーム から着けられます。
                </p>
                <div className={styles.detailActions}>
                  <button className="btn neutral" onClick={() => setDetail(null)}>閉じる</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 受信箱のオーバーレイの外に出す（中に置くと閉じるクリックが親まで伝わってしまう） */}
      {boxOpen && <BoxOpen kind={boxOpen} count={boxLeft} look={look} onClose={() => setBoxOpen(null)} />}
    </>
  );
}

// A player icon optionally wrapped in their equipped frame — reused by ProfileButton.
export function FramedFace({ look, size, frame }: { look: HorseLook; size: number; frame: EquipFrame | null }) {
  if (frame) return <EquippedFrame frame={frame} look={look} size={size} />;
  return <HorseFace horse={look} size={size} />;
}
