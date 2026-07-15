-- ===========================================================================
--  プレイヤーID（番号）でログイン（改修②改）
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください（再実行も安全）。
-- ・ログインは「プレイヤーID（例: 0000001）＋パスワード」だけで行えます。
-- ・番号 → ログイン用アドレス の解決だけをこの関数が担当します（ログイン前に
--   呼ぶため anon にも実行を許可）。パスワードは Supabase Auth が別途検証します。
-- ・前提：profiles(profiles.sql) 適用済み。
-- ---------------------------------------------------------------------------

-- プレイヤー番号 → 認証メール（内部アドレス）を返す。番号が無ければ null。
-- SECURITY DEFINER で auth.users を参照するが、返すのはメール文字列のみ。
create or replace function public.email_for_player_no(p_no bigint)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from public.profiles p
  join auth.users u on u.id = p.user_id
  where p.player_no = p_no
  limit 1;
$$;

-- ログインは認証前（anon）に呼ぶので、anon と authenticated の両方に許可。
grant execute on function public.email_for_player_no(bigint) to anon, authenticated;
