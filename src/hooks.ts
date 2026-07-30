import { useEffect, useState } from 'react';

/** Tracks the user's prefers-reduced-motion setting (CLAUDE.md §5.2, §10). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/** 画面が切り替わったら本文を一番上に戻す。
 *  レース系の画面はどれも縦に長く、前の画面でスクロールした位置のままだと
 *  レースやパドックが見えないまま始まってしまう。1人でレース・グランプリ・対戦の
 *  すべてで同じ挙動にしたいので、各画面に書かず共通のフックにしている。 */
export function useScrollTopOnChange(key: unknown): void {
  useEffect(() => {
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'auto' });
  }, [key]);
}
