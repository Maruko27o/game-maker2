import { useStore } from '../store';
import CoinIcon from './CoinIcon';
import styles from './CoinBalance.module.css';

// A small always-visible coin balance (RACE_V4 §4), mirroring the account button.
export default function CoinBalance() {
  const coins = useStore((s) => s.coins);
  return (
    <div className={styles.pill} aria-label={`コイン ${coins}`}>
      <CoinIcon size={20} />
      <span className={styles.amount}>{coins.toLocaleString()}</span>
    </div>
  );
}
