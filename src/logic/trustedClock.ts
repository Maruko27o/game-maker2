// 「信頼できる現在時刻」。端末の時計を進めても／戻しても、放置収入(牧場)や対戦の
// 「部」を先取りできないようにするための時刻源。
//
// 仕組み：
//  1) セッション中の経過は performance.now()（単調増加・壁時計の変更に不感）で測る。
//     → アプリを開いたまま時計をいじっても、実際に流れた秒数しか進まない。
//  2) オンライン時はサーバ時刻でアンカーし直す（anchorServerTime）。以後は端末時計の
//     改変が完全に無効になり、実時刻に追従する。
//  3) 再読み込みをまたいで「単調フロア」を localStorage に保存し、巻き戻し（時計を
//     戻して二度取りする類）を防ぐ。
//
// これはサーバ権限の不正対策ではなく（コインはローカル保存なので厳密な防御は別問題）、
// 「時計を変えるだけ」の一番簡単な抜け道を塞ぐことが目的。

const FLOOR_KEY = 'horse-game/tclock-floor/v1';
const SANE_MIN = Date.UTC(2024, 0, 1); // これ未満のサーバ/端末時刻は異常値として無視
const PERSIST_STEP = 15000; // フロアの保存間隔（ms相当）— 書き込みを間引く

function perf(): number {
  try {
    return typeof performance !== 'undefined' ? performance.now() : 0;
  } catch {
    return 0;
  }
}
function readFloor(): number {
  try {
    const v = Number(localStorage.getItem(FLOOR_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}
function writeFloor(t: number): void {
  try {
    localStorage.setItem(FLOOR_KEY, String(Math.floor(t)));
  } catch {
    /* storage unavailable — フォールバックは in-memory のみ */
  }
}

const perfOrigin = perf();
// オフライン基準：端末時計と、これまでに到達した単調フロアの大きい方。
let baseEpoch = Math.max(Date.now(), readFloor());
let floor = readFloor();
let lastPersist = floor;
// サーバでアンカーできたら以後はこちらを使う（壁時計に一切依存しない）。
let server: { epoch: number; perf: number } | null = null;

/** サーバのエポック(ms)でアンカーする。オンライン確認時に呼ぶ。以後、端末時計を
 *  いじっても trustedNow は実時刻にしか進まない。フロアもサーバ時刻へ合わせ直し、
 *  オフラインで水増しされたフロアをリセットする（サーバが権威）。 */
export function anchorServerTime(serverEpochMs: number): void {
  if (!Number.isFinite(serverEpochMs) || serverEpochMs < SANE_MIN) return;
  server = { epoch: serverEpochMs, perf: perf() };
  baseEpoch = serverEpochMs;
  floor = serverEpochMs;
  lastPersist = serverEpochMs;
  writeFloor(serverEpochMs);
}

/** 信頼できる現在時刻(ms)。壁時計を進めても戻しても、実際の経過ぶんしか進まない。 */
export function trustedNow(): number {
  const elapsed = Math.max(0, (server ? perf() - server.perf : perf() - perfOrigin));
  const anchor = server ? server.epoch : baseEpoch;
  let t = anchor + elapsed;
  if (t < floor) {
    t = floor; // 単調フロア：巻き戻しを許さない
  } else if (t - lastPersist >= PERSIST_STEP) {
    floor = t;
    lastPersist = t;
    writeFloor(t);
  } else {
    floor = t;
  }
  return t;
}

/** テスト用：モジュール内状態を初期化する。 */
export function __resetTrustedClockForTest(now = Date.now()): void {
  server = null;
  baseEpoch = now;
  floor = 0;
  lastPersist = 0;
}
