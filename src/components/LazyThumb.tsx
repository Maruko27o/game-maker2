import { useEffect, useRef, useState, type ReactNode } from 'react';

// 画面に入るまで中身を描かない入れもの。
//
// 図鑑は1つのタブに最大67マス並び、1マスがウマの全身SVG（形が19個）なので、
// 開いた瞬間に大量のノードを一度に作っていた。開くたびに指が引っかかるのはこれが原因。
//
// **見た目は一切変えない。** 画面に入ったものは今までどおりの絵をそのまま描く。
// 一度描いたものは消さないので、スクロールで戻ったときにちらつくこともない。
//
// ■ 大きさは必ず親に合わせる（ここを間違えて図鑑を壊した）
// 最初は size で px を決め打ちしていたが、図鑑のマスは画面幅で決まる可変サイズ
// （5列・実寸およそ60px）で、親には overflow:hidden が付いている。78px の箱を
// 挟んだ結果、はみ出したぶんが切り取られ、**ウマの頭（上）とひづめ（下）が
// 消えて見えなくなった**。ここは 100% で伸ばし、場所取りは親（aspect-ratio など）に
// 任せる。使う側は「中身が無くても形が崩れない親」に入れること。
export default function LazyThumb({ children }: { children: ReactNode }) {
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
    <div ref={ref} style={{ width: '100%', height: '100%' }}>
      {shown ? children : null}
    </div>
  );
}
