import styles from './CloseButton.module.css';

// 画面を閉じるボタン。以前は下線つきの「閉じる」テキストだったり、背景の無い薄い
// ✕ だったりと画面ごとにバラバラで、木目の地色に沈んで見つけにくかった。
// どの画面でも同じ「右上の丸い✕」に揃える（指で押しやすいよう当たり判定は44px）。
//
// 置き場所は親（シート）の右上。親に position: relative が要る。
export default function CloseButton({
  onClick,
  label = '閉じる',
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.close} ${className ?? ''}`}
      onClick={onClick}
      aria-label={label}
    >
      <span className={styles.mark} aria-hidden>✕</span>
    </button>
  );
}
