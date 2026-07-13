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

// Maruko27o's Project（anon キーは公開して安全な値。データは RLS で保護）
export const SUPABASE_URL = ENV_URL ?? 'https://kpvlmjdbnuulzkpxywzd.supabase.co';
export const SUPABASE_ANON_KEY =
  ENV_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwdmxtamRibnV1bHprcHh5d3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NDIyODIsImV4cCI6MjA5OTUxODI4Mn0.1B7ZOYPg4yONK-oAYGAR1RhDnplSEmTigNUKbdsm0dw';

export const CLOUD_ENABLED = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
