-- ===========================================================================
--  アカウント堅牢化（楽観ロック rev + 衝突時バックアップ）のセットアップ
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- 既存の saves テーブル（user_id, data, updated_at）と profiles（profiles.sql）が
-- 作成済みである前提の「追加分」です。未実行でもアプリは従来どおり動きます
-- （その場合は楽観ロックなしの upsert にフォールバックします）。
-- ---------------------------------------------------------------------------

-- saves に楽観ロック用のリビジョン等を追加
alter table public.saves add column if not exists rev bigint not null default 1;
alter table public.saves add column if not exists save_version integer;
alter table public.saves add column if not exists updated_by text;

-- 衝突時に「選ばれなかった側」を退避するバックアップ（7日保持はクライアントが掃除）
create table if not exists public.saves_backup (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  data         jsonb not null,
  rev          bigint,
  backed_up_at timestamptz not null default now()
);
alter table public.saves_backup enable row level security;
drop policy if exists "own backup" on public.saves_backup;
create policy "own backup" on public.saves_backup
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 任意：表示名
alter table public.profiles add column if not exists display_name text;

-- 楽観ロック付き保存：expected_rev が一致するときだけ更新して新 rev を返す。
-- 一致しなければ null（＝衝突）。行が無ければ作成（初回）。
-- SECURITY DEFINER だが触るのは常に auth.uid() 自身の行のみ。
create or replace function public.save_with_rev(
  p_data jsonb, p_expected_rev bigint, p_version integer, p_device text
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_rev bigint;
  new_rev bigint;
begin
  select rev into cur_rev from public.saves where user_id = auth.uid();

  if cur_rev is null then
    insert into public.saves (user_id, data, save_version, rev, updated_by, updated_at)
    values (auth.uid(), p_data, p_version, 1, p_device, now())
    on conflict (user_id) do nothing;
    select rev into new_rev from public.saves where user_id = auth.uid();
    return new_rev;
  end if;

  if p_expected_rev is null or p_expected_rev = cur_rev then
    update public.saves
      set data = p_data, save_version = p_version, rev = cur_rev + 1,
          updated_by = p_device, updated_at = now()
      where user_id = auth.uid()
      returning rev into new_rev;
    return new_rev;
  end if;

  return null; -- rev 不一致 = 衝突
end;
$$;

grant execute on function public.save_with_rev(jsonb, bigint, integer, text) to authenticated;
