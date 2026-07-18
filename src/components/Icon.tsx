// Hand-drawn SVG icon set (改修③: no emoji). Single-colour silhouettes on a
// 24×24 grid using currentColor, so they tint with their context (e.g. active vs
// inactive nav tabs). Friendly, rounded shapes to match the game's look.
export type IconName =
  | 'leaf' | 'horse' | 'palette' | 'book' | 'flag' | 'trophy'
  | 'star' | 'account' | 'cloud' | 'gear' | 'lock' | 'gift'
  | 'refresh' | 'bolt' | 'skip' | 'medal' | 'crown' | 'clipboard' | 'sparkle' | 'swords'
  | 'dice' | 'eye' | 'eyeOff';

const P: Record<IconName, JSX.Element> = {
  // 草むら
  leaf: (
    <path d="M4 20c-1-8 3-15 16-16 1 9-4 15-12 15 2-4 5-6 9-7-4 0-8 2-10 5-1 1-2 2-3 3z" />
  ),
  // マイウマ (horse head, facing right — sharp ear + muzzle to read clearly)
  horse: (
    <path d="M4.5 21c0-5.5 1.8-9 5-11l-2.7-4.4c-.5-.8.5-1.6 1.2-1L11 7l1.3-3.6c.3-.9 1.6-.7 1.7.3l.3 3.4c1.7-1 3.9-1.5 6.4-1.4-.8 1.9-2 3.3-3.6 4.2 1.7 1.2 2.7 3.2 2.7 5.7 0 4-3 6.4-6.6 6.4l.5-4c-2 1-3.6 2.8-3.9 4z" />
  ),
  // つくる (palette)
  palette: (
    <path d="M12 3C6 3 3 7 3 12c0 4 3 7 7 7 1 0 2-1 2-2s-1-1-1-2 1-2 2-2h3c3 0 5-2 5-5 0-3-4-5-9-5zm-5 9a1.4 1.4 0 110-3 1.4 1.4 0 010 3zm3-4a1.4 1.4 0 110-3 1.4 1.4 0 010 3zm5 0a1.4 1.4 0 110-3 1.4 1.4 0 010 3z" />
  ),
  // 図鑑 (book)
  book: (
    <path d="M4 5c3-1 6-1 8 1 2-2 5-2 8-1v14c-3-1-6-1-8 1-2-2-5-2-8-1V5zm8 3v10" fillRule="evenodd" />
  ),
  // レース (checkered flag)
  flag: (
    <path d="M5 3v18H3V3h2zm2 1h13v9H7V4zm2 2v2h2V6H9zm4 0v2h2V6h-2zm-4 4v-2H7v2h2zm4 0v-2h-2v2h2zm4 0V8h-2v2h2zm-8 2v-2H7v2h2zm4 0v-2h-2v2h2z" fillRule="evenodd" />
  ),
  // ランキング / 優勝 (trophy)
  trophy: (
    <path d="M6 3h12v2h3v3c0 2-2 4-4 4-1 1-2 2-3 2v3h3v2H7v-2h3v-3c-1 0-2-1-3-2-2 0-4-2-4-4V5h3V3zm0 4H5v1c0 1 1 2 1 2V7zm12 0v3s1-1 1-2V8h-1z" fillRule="evenodd" />
  ),
  star: <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 21.4l1.4-6.8L2.2 9.9l6.9-.8L12 2z" />,
  // アカウント (person)
  account: <path d="M12 12a4.5 4.5 0 100-9 4.5 4.5 0 000 9zm-8 9c0-4 4-6.5 8-6.5s8 2.5 8 6.5H4z" />,
  cloud: <path d="M7 19a4 4 0 01-.5-8A5 5 0 0116 9a3.5 3.5 0 011 6.9V19H7z" />,
  gear: (
    <path d="M12 8a4 4 0 100 8 4 4 0 000-8zm0 2.4a1.6 1.6 0 110 3.2 1.6 1.6 0 010-3.2zM10.5 2h3l.5 2.5 2.2 1 2.3-1.2 2 2.6-1.6 1.8.5 2.3 2.3.8v3l-2.3.8-.5 2.3 1.6 1.8-2 2.6-2.3-1.2-2.2 1L13.5 22h-3L10 19.5l-2.2-1-2.3 1.2-2-2.6 1.6-1.8-.5-2.3L2.3 12v-3l2.3-.8.5-2.3L3.5 4.1l2-2.6L7.8 2.7l2.2-1L10.5 2z" fillRule="evenodd" />
  ),
  lock: <path d="M7 10V8a5 5 0 0110 0v2h1v11H6V10h1zm2 0h6V8a3 3 0 00-6 0v2z" fillRule="evenodd" />,
  gift: <path d="M3 8h18v4H3V8zm1 5h16v8H4v-8zm7-9a2 2 0 012 2v1H9V6a2 2 0 012-2zm2 0a2 2 0 100 4h3a2 2 0 00-3-4zm-2 0a2 2 0 100 4H8a2 2 0 013-4zm0 5v13" fillRule="evenodd" />,
  refresh: <path d="M12 5a7 7 0 016.7 5H16l3.5 4 3.5-4h-2.2A9 9 0 003 12h2a7 7 0 017-7zm0 14a7 7 0 01-6.7-5H8L4.5 10 1 14h2.2A9 9 0 0021 12h-2a7 7 0 01-7 7z" fillRule="evenodd" />,
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,
  skip: <path d="M4 5l8 7-8 7V5zm9 0l7 7-7 7V5z" />,
  medal: <path d="M8 2h8l-2 6H10L8 2zm4 6a7 7 0 100 14 7 7 0 000-14zm0 3l1.5 3 3.3.3-2.5 2.2.8 3.2L12 21l-2.9 1.9.8-3.2-2.5-2.2 3.3-.3L12 11z" fillRule="evenodd" />,
  crown: <path d="M3 8l3.5 3L12 5l5.5 6L21 8l-1.5 10h-15L3 8zm2 12h14v2H5v-2z" fillRule="evenodd" />,
  clipboard: <path d="M9 3h6v2h3v16H6V5h3V3zm0 4h6V5H9v2zm-1 4h8v-2H8v2zm0 4h8v-2H8v2zm0 4h5v-2H8v2z" fillRule="evenodd" />,
  sparkle: <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6zm7 12l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />,
  swords: <path d="M3 3l6 2 8 8 1 4-4-1-8-8L3 3zm18 0l-2 6-3-1 4-5h1zM5 19l4-4 1 1-4 4-1-1zm12-4l4 4-1 1-4-4 1-1z" fillRule="evenodd" />,
  // サイコロ（5の目・目は穴として抜く）
  dice: <path d="M7 3h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7a4 4 0 014-4zM8 6.5a1.5 1.5 0 100 3 1.5 1.5 0 100-3zM16 6.5a1.5 1.5 0 100 3 1.5 1.5 0 100-3zM12 10.5a1.5 1.5 0 100 3 1.5 1.5 0 100-3zM8 14.5a1.5 1.5 0 100 3 1.5 1.5 0 100-3zM16 14.5a1.5 1.5 0 100 3 1.5 1.5 0 100-3z" fillRule="evenodd" />,
  // パスワード表示トグル（目）
  eye: <path d="M12 5C6.5 5 2.7 9 1.5 12 2.7 15 6.5 19 12 19s9.3-4 10.5-7C21.3 9 17.5 5 12 5zm0 3a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z" fillRule="evenodd" />,
  eyeOff: <path d="M3.3 2L2 3.3l3.2 3.2C3.4 7.8 2.2 9.7 1.5 12 2.7 15 6.5 19 12 19c1.7 0 3.3-.4 4.7-1.1l4 4L22 20.7 3.3 2zM12 16a4 4 0 01-3.7-5.6l1.6 1.6a2 2 0 002.1 2.1l1.6 1.6c-.5.2-1 .3-1.6.3zm0-11c5.5 0 9.3 4 10.5 7-.5 1.2-1.4 2.6-2.7 3.8l-2.9-2.9A4 4 0 0012 8c-.4 0-.8 0-1.1.1L8.6 5.8C9.7 5.3 10.8 5 12 5z" fillRule="evenodd" />,
};

export default function Icon({ name, size = 24, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden focusable="false">
      {P[name]}
    </svg>
  );
}
