-- ウマあつめ：クラウドセーブ用テーブルとセキュリティ設定
-- Supabase ダッシュボードの「SQL Editor」に貼り付けて Run してください。
-- （各ユーザーは自分のデータだけ読み書きできます）

create table if not exists public.saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.saves enable row level security;

drop policy if exists "own save select" on public.saves;
drop policy if exists "own save insert" on public.saves;
drop policy if exists "own save update" on public.saves;

create policy "own save select" on public.saves
  for select using (auth.uid() = user_id);

create policy "own save insert" on public.saves
  for insert with check (auth.uid() = user_id);

create policy "own save update" on public.saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
