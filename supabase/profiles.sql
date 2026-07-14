-- ===========================================================================
--  プレイヤーID（連番 id0000001〜）のセットアップ
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- 登録済み・新規どちらのアカウントでも、初回ログイン時に自動で番号が振られます。
-- （saves テーブルは README の手順で作成済みの想定。これは追加分です）
-- ---------------------------------------------------------------------------

-- 連番の発番用シーケンス（1 から）
create sequence if not exists public.player_no_seq start 1;

-- プロフィール（アカウント ↔ プレイヤー番号 ↔ メール の紐付け）
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  player_no  bigint unique not null default nextval('public.player_no_seq'),
  email      text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 自分のプロフィールだけ読める
drop policy if exists "own profile read" on public.profiles;
create policy "own profile read" on public.profiles
  for select using (auth.uid() = user_id);

-- 呼び出し元のプレイヤー番号を返す。無ければ作成してから返す。
-- SECURITY DEFINER: RLS を越えて挿入できるが、触るのは常に auth.uid() 自身の行のみ。
create or replace function public.get_or_create_profile()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  select player_no into n from public.profiles where user_id = auth.uid();
  if n is null then
    insert into public.profiles (user_id, email)
    values (auth.uid(), (select email from auth.users where id = auth.uid()))
    on conflict (user_id) do nothing
    returning player_no into n;
    if n is null then
      select player_no into n from public.profiles where user_id = auth.uid();
    end if;
  end if;
  return n;
end;
$$;

grant execute on function public.get_or_create_profile() to authenticated;
