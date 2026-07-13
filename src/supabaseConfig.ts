// ===========================================================================
//  アカウント機能（メールでログイン・全端末で同期）の設定
// ===========================================================================
// ここに Supabase プロジェクトの値を貼ると、アカウント機能が有効になります。
// 空のままなら、これまでどおり「この端末だけのローカル保存」で動きます。
//
// どちらも公開して大丈夫な値です（anon キーは行レベルセキュリティ(RLS)で守られます）。
//
//   1. https://supabase.com で無料プロジェクトを作成
//   2. Project Settings → API を開く
//   3. 「Project URL」を SUPABASE_URL に、
//      「anon public」キーを SUPABASE_ANON_KEY に貼り付け
//   4. 保存 → main にコミットすると自動でデプロイ・有効化されます
//
// （詳しい手順とデータベースの初期設定SQLは README.md を参照）
// ---------------------------------------------------------------------------

const ENV_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ENV_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const SUPABASE_URL = ENV_URL ?? ''; // 例: 'https://abcd1234.supabase.co'
export const SUPABASE_ANON_KEY = ENV_KEY ?? ''; // 例: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...'

export const CLOUD_ENABLED = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
