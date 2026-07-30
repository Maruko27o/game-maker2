import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Horse } from './types';

// セーブ枠（localStorage のキー）の取り違えが、ぎっつまさんのデータ消失の根本原因。
//
//   ・ストアはモジュール読み込み時に activeKey から初期化される。
//     activeKey の初期値はゲスト枠なので、ログイン済みでも起動直後の中身はゲスト。
//   ・クラウド突合はそのあとに走るので、対策前は「ゲスト枠の中身」を
//     アカウントの端末データだと思って突合していた。
//
// ここでは「起動直後はゲスト枠を読む」ことと、reloadFromKey(uid) で
// アカウント枠へ正しく切り替わることを固定する。CloudSync は突合の前に
// これを呼ぶ（owner が一致するとき）。

const mem = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size;
  },
};

function horse(id: string): Horse {
  return {
    id,
    name: id,
    colors: { body: 'body_bay', mane: 'mane_black', hoof: 'hoof_dark' },
    decos: {},
    stats: { spd: 8, sta: 8, pwr: 8, jmp: 8, gut: 8, wit: 8 },
    createdAt: 0,
    skill: 'straight_run',
  };
}
function saveWith(ids: string[], coins: number, savedAt: number) {
  return JSON.stringify({ version: 6, owned: { body_bay: 1 }, horses: ids.map(horse), coins, savedAt });
}

const UID = 'user-A';

describe('セーブ枠の取り違え（データ消失の根本原因）', () => {
  beforeEach(() => {
    mem.clear();
    vi.resetModules();
    vi.stubGlobal('localStorage', fakeStorage);
  });

  it('起動直後はアカウント枠ではなくゲスト枠を読む（ここが事故の入口）', async () => {
    // ゲスト枠：登録前に少し遊んだぶん。起動時の commit で savedAt だけ新しくなる。
    mem.set('horse-game/v1', saveWith(['guest1', 'guest2'], 40, 9_999_999));
    // アカウント枠：本物（27頭）。
    mem.set(`horse-game/v3/${UID}`, saveWith(Array.from({ length: 27 }, (_, i) => `real${i}`), 616_696, 1_000));

    const { useStore } = await import('./store');
    expect(useStore.getState().horses.map((h) => h.id)).toEqual(['guest1', 'guest2']);
  });

  it('reloadFromKey(uid) でアカウント枠に切り替わる（突合の前にこれを呼ぶ）', async () => {
    mem.set('horse-game/v1', saveWith(['guest1', 'guest2'], 40, 9_999_999));
    mem.set(`horse-game/v3/${UID}`, saveWith(['real0', 'real1', 'real2'], 616_696, 1_000));

    const { useStore } = await import('./store');
    useStore.getState().reloadFromKey(UID);

    const s = useStore.getState();
    expect(s.horses.map((h) => h.id)).toEqual(['real0', 'real1', 'real2']);
    expect(s.coins).toBe(616_696);
  });

  it('切り替えたあとの保存はアカウント枠に書かれ、ゲスト枠は汚さない', async () => {
    mem.set('horse-game/v1', saveWith(['guest1'], 40, 9_999_999));
    mem.set(`horse-game/v3/${UID}`, saveWith(['real0'], 100, 1_000));

    const { useStore } = await import('./store');
    useStore.getState().reloadFromKey(UID);
    useStore.getState().addCoins(500);

    const account = JSON.parse(mem.get(`horse-game/v3/${UID}`)!);
    const guest = JSON.parse(mem.get('horse-game/v1')!);
    expect(account.coins).toBe(600);
    expect(guest.coins).toBe(40); // ゲスト枠は据え置き
    expect(guest.horses).toHaveLength(1);
  });

  it('アカウント枠がまだ無ければ空のセーブになる（＝突合の安全網が効く側）', async () => {
    mem.set('horse-game/v1', saveWith(['guest1', 'guest2'], 40, 9_999_999));

    const { useStore } = await import('./store');
    useStore.getState().reloadFromKey(UID);
    expect(useStore.getState().horses).toHaveLength(0);
  });
});
