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

export type SyncState = 'idle' | 'syncing' | 'saved' | 'error' | 'offline';
export type AuthUser = { id: string; email: string };

type AuthStore = {
  configured: boolean;
  ready: boolean; // initial session check finished
  user: AuthUser | null;
  playerNo: number | null; // sequential public player number (RACE_V3 accounts)
  sync: SyncState;
  error: string | null;
  setUser: (u: AuthUser | null) => void;
  setPlayerNo: (n: number | null) => void;
  setSync: (s: SyncState) => void;
  setError: (e: string | null) => void;
  setReady: (r: boolean) => void;
};

export const useAuth = create<AuthStore>((set) => ({
  configured: CLOUD_ENABLED,
  ready: !CLOUD_ENABLED, // when unconfigured there is nothing to wait for
  user: null,
  playerNo: null,
  sync: CLOUD_ENABLED ? 'idle' : 'offline',
  error: null,
  setUser: (user) => set({ user }),
  setPlayerNo: (playerNo) => set({ playerNo }),
  setSync: (sync) => set({ sync }),
  setError: (error) => set({ error }),
  setReady: (ready) => set({ ready }),
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

/** Format a player number as a zero-padded id (e.g. 123 → "id0000123"). */
export function formatPlayerId(n: number): string {
  return 'id' + String(n).padStart(7, '0');
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

/** Load this user's save from the cloud (null when they have none yet). */
export async function cloudLoad(userId: string): Promise<SaveData | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from(SAVE_TABLE).select('data').eq('user_id', userId).maybeSingle();
  if (error || !data) return null;
  return data.data as SaveData;
}

/** Upsert this user's save to the cloud. Returns an error message or null. */
export async function cloudSave(userId: string, save: SaveData): Promise<string | null> {
  if (!supabase) return 'offline';
  const { error } = await supabase
    .from(SAVE_TABLE)
    .upsert({ user_id: userId, data: save, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return error ? error.message : null;
}
