import { useEffect, useRef, useState, type ReactNode } from 'react';

// 画面に入るまで中身を描かない入れもの。
//
// 図鑑は1つのタブに最大67マス並び、1マスがウマの全身SVG（形が19個＋グラデーション定義）
// なので、開いた瞬間に 3,600 ノードほどを一度に作っていた。開くたびに指が引っかかる
// のはこれが原因。
//
// **見た目は一切変えない**。画面に入ったものは今までどおりの絵をそのまま描く。
// 変えたのは「まだ見えていないものを、見えるまで作らない」ことだけ。
// 一度描いたものは消さないので、スクロールで戻ったときにちらつくこともない。
//
// rootMargin を大きめに取ってあるので、スクロールしてマスが画面に届く前に描き終わる。
export default function LazyThumb({
  size,
  children,
}: {
  /** 描く前の場所取り。ここが実際の中身と同じ大きさでないと、並びがガタつく。 */
  size: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;
    // IntersectionObserver が無い環境（古い WebView・テスト）では、
    // 何も描かれないほうが困るので、そのまま全部描く。
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // 画面の前後1画面ぶんを先に描いておく（スクロールしても間に合う）
      { rootMargin: '300px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return (
    <div ref={ref} style={{ width: size, height: size, display: 'grid', placeItems: 'center' }}>
      {shown ? children : null}
    </div>
  );
}
