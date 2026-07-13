import styles from './Placeholder.module.css';

type Props = { title: string; emoji: string; note: string };

// Race (/race) and Vote (/vote) are reachable from the nav but not built yet
// (CLAUDE.md §6). Horse/SaveData are shaped to extend into these later.
export default function Placeholder({ title, emoji, note }: Props) {
  return (
    <div className={styles.wrap}>
      <div className={styles.emoji} aria-hidden>
        {emoji}
      </div>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.badge}>準備中</p>
      <p className={styles.note}>{note}</p>
    </div>
  );
}
