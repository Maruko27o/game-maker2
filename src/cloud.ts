// Supabase-backed accounts + cloud save. Everything here degrades gracefully to
// "local only" when the project isn't configured (see supabaseConfig.ts).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { create } from 'zustand';
import type { SaveData } from './types';
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD_ENABLED } from './supabaseConfig';

export const supabase: SupabaseClient | null = CLOUD_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;

export const SAVE_TABLE = 'saves';

// Which account the *local* save currently belongs to (device-local only; never
// synced to the cloud). Used to stop guest/other-account data from overwriting
// an established account on sign-in.
const OWNER_KEY = 'horse-game/owner';

export function getOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setOwner(userId: string | null): void {
  try {
    if (userId) localStorage.setItem(OWNER_KEY, userId);
    else localStorage.removeItem(OWNER_KEY);
  } catch {
    // storage unavailable — reconciliation just falls back to "guest" (cloud wins)
  }
}

// The cloud rev we last synced to, so the debounced push can lock optimistically.
let currentRev: number | null = null;
export function getRev(): number | null {
  return currentRev;
}
export function setRev(rev: number | null): void {
  currentRev = rev;
}

export type SyncState = 'idle' | 'syncing' | 'saved' | 'error' | 'offline';
export type AuthUser = { id: string; email: string };

// A pending sync conflict awaiting the player's choice (ACCOUNT.md §1.6).
export type ConflictInfo = { userId: string; cloud: CloudSave; local: SaveData };

type AuthStore = {
  configured: boolean;
  ready: boolean; // initial session check finished
  user: AuthUser | null;
  playerNo: number | null; // sequential public player number (RACE_V3 accounts)
  sync: SyncState;
  error: string | null;
  conflict: ConflictInfo | null;
  wantAccount: boolean; // a request (e.g. from the title screen) to open the account panel
  setUser: (u: AuthUser | null) => void;
  setPlayerNo: (n: number | null) => void;
  setSync: (s: SyncState) => void;
  setError: (e: string | null) => void;
  setReady: (r: boolean) => void;
  setConflict: (c: ConflictInfo | null) => void;
  setWantAccount: (b: boolean) => void;
};

export const useAuth = create<AuthStore>((set) => ({
  configured: CLOUD_ENABLED,
  ready: !CLOUD_ENABLED, // when unconfigured there is nothing to wait for
  user: null,
  playerNo: null,
  sync: CLOUD_ENABLED ? 'idle' : 'offline',
  error: null,
  conflict: null,
  wantAccount: false,
  setUser: (user) => set({ user }),
  setPlayerNo: (playerNo) => set({ playerNo }),
  setSync: (sync) => set({ sync }),
  setError: (error) => set({ error }),
  setReady: (ready) => set({ ready }),
  setConflict: (conflict) => set({ conflict }),
  setWantAccount: (wantAccount) => set({ wantAccount }),
}));

/** The player's public number (id0000123). Creates it on first call. Returns
 *  null when cloud is off or the DB isn't set up yet (UI degrades gracefully). */
export async function loadPlayerNo(): Promise<number | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_or_create_profile');
  if (error || data == null) return null;
  const n = typeof data === 'number' ? data : Number(data);
  return Number.isFinite(n) ? n : null;
}

/** Format a player number as a zero-padded id (e.g. 123 → "ID-0000123"). */
export function formatPlayerId(n: number): string {
  return 'ID-' + String(n).padStart(7, '0');
}

function toUser(u: { id: string; email?: string | null } | null | undefined): AuthUser | null {
  return u ? { id: u.id, email: u.email ?? '' } : null;
}

/** Wire up the initial session and auth-change subscription. Call once. */
let authInited = false;
export function initAuth(): void {
  if (!supabase || authInited) return;
  authInited = true;
  supabase.auth
    .getSession()
    .then(({ data }) => useAuth.getState().setUser(toUser(data.session?.user)))
    .catch(() => {})
    .finally(() => useAuth.getState().setReady(true));
  supabase.auth.onAuthStateChange((_event, session) => {
    useAuth.getState().setUser(toUser(session?.user));
  });
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'メールアドレスかパスワードが違います。';
  if (m.includes('already registered')) return 'このメールアドレスは登録済みです。ログインしてください。';
  if (m.includes('password')) return 'パスワードは6文字以上にしてください。';
  if (m.includes('email')) return 'メールアドレスの形式を確認してください。';
  return message;
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'クラウド機能が未設定です。';
  const { error } = await supabase.auth.signUp({ email, password });
  return error ? friendly(error.message) : null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'クラウド機能が未設定です。';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? friendly(error.message) : null;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  setOwner(null); // local save reverts to "guest"; a later login won't clobber cloud
  await supabase.auth.signOut();
}

/** Send a password-reset email (handled entirely by Supabase Auth). */
export async function resetPassword(email: string): Promise<string | null> {
  if (!supabase) return 'クラウド機能が未設定です。';
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
  return error ? friendly(error.message) : null;
}

// A stable per-device id, shown as "updated_by" so a conflict can name the device.
function deviceId(): string {
  try {
    let id = localStorage.getItem('horse-game/device');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('horse-game/device', id);
    }
    return id;
  } catch {
    return 'dev';
  }
}

export type CloudSave = { data: SaveData; rev: number };

/** Load this user's save from the cloud (null when they have none yet). */
export async function cloudLoad(userId: string): Promise<CloudSave | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(SAVE_TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return { data: data.data as SaveData, rev: typeof data.rev === 'number' ? data.rev : 1 };
}

export type SaveResult =
  | { ok: true; rev: number }
  | { ok: false; conflict: true }
  | { ok: false; conflict: false; error: string };

/** Save with optimistic locking (ACCOUNT.md §1.6). Pass the rev you last saw;
 *  a mismatch returns `{conflict:true}` instead of silently overwriting. When the
 *  DB isn't set up for locking yet, falls back to a plain upsert. */
export async function cloudSave(userId: string, save: SaveData, expectedRev: number | null): Promise<SaveResult> {
  if (!supabase) return { ok: false, conflict: false, error: 'offline' };
  const { data, error } = await supabase.rpc('save_with_rev', {
    p_data: save,
    p_expected_rev: expectedRev,
    p_version: save.version,
    p_device: deviceId(),
  });
  if (!error) {
    if (data == null) return { ok: false, conflict: true }; // rev mismatch
    return { ok: true, rev: Number(data) };
  }
  // RPC missing (account.sql not applied) → fall back to a plain upsert.
  if (/function|schema cache|not exist|404/i.test(error.message)) {
    const up = await supabase
      .from(SAVE_TABLE)
      .upsert({ user_id: userId, data: save, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return up.error ? { ok: false, conflict: false, error: up.error.message } : { ok: true, rev: (expectedRev ?? 0) + 1 };
  }
  return { ok: false, conflict: false, error: error.message };
}

/** Stash a save into saves_backup (best-effort) and prune entries >7 days old. */
export async function backupSave(userId: string, data: SaveData, rev: number | null): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from('saves_backup').insert({ user_id: userId, data, rev });
    const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    await supabase.from('saves_backup').delete().eq('user_id', userId).lt('backed_up_at', cutoff);
  } catch {
    // backup table not set up / offline — non-fatal
  }
}
