// 月次ランキングの「対象月」計算（改修：ランキングは1ヶ月ごと）。
// 全プレイヤーで境界を揃えるため、端末のタイムゾーンに依らず日本時間(JST, UTC+9)の
// 暦月を正とする。サーバ側も to_char((now() at time zone 'Asia/Tokyo'),'YYYY-MM') で
// 同じ 'YYYY-MM' を持つので、クライアントの monthKey と必ず一致する。

import { trustedNow } from './trustedClock';

const JST_OFFSET_MS = 9 * 3600 * 1000;

function jstParts(now: number): { y: number; m0: number } {
  const d = new Date(now + JST_OFFSET_MS);
  return { y: d.getUTCFullYear(), m0: d.getUTCMonth() }; // m0: 0-11
}

/** 現在の対象月キー 'YYYY-MM'（JST）。端末時計ではなく信頼できる時刻を使う。 */
export function monthKey(now = trustedNow()): string {
  const { y, m0 } = jstParts(now);
  return `${y}-${String(m0 + 1).padStart(2, '0')}`;
}

/** 次の月替わり（翌月1日 0:00 JST）までの残りミリ秒。 */
export function msToNextMonth(now = trustedNow()): number {
  const { y, m0 } = jstParts(now);
  const nextY = m0 === 11 ? y + 1 : y;
  const nextM0 = (m0 + 1) % 12;
  // 翌月1日 0:00 JST を UTC ミリ秒に戻す。
  const nextStartUtc = Date.UTC(nextY, nextM0, 1, 0, 0, 0) - JST_OFFSET_MS;
  return nextStartUtc - now;
}

/** 'YYYY-MM' → '2026年7月' の表示ラベル。 */
export function monthLabel(key: string): string {
  const [y, m] = key.split('-');
  return `${y}年${Number(m)}月`;
}

/** 残りミリ秒 → { days, h, m, s }（負値は0でクランプ）。 */
export function splitCountdown(ms: number): { days: number; h: number; m: number; s: number } {
  const t = Math.max(0, ms);
  const days = Math.floor(t / 86400000);
  const h = Math.floor((t % 86400000) / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return { days, h, m, s };
}
