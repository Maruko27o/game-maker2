-- ===========================================================================
--  対戦（勝ち抜きトーナメント・1日2回開催）— 他プレイヤーのウマの共有プール
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて実行してください（再実行OK）。
-- ・開催は1日2回。12時間ごとの「部」を整数ID(period)で管理する（0時/12時で+1）。
-- ・各プレイヤーは1つの部に1頭を登録（enter_arena）。他プレイヤーの同じ部の
--   エントリーからトーナメントの相手を抽選する。足りない分はCOMで自動補充。
-- ・溜め込み防止：登録のたびに古い部を自動削除（テーブルは常に数日ぶんだけ）。
-- ・未適用でもアプリは動作します（登録は握りつぶし・相手はCOM）。
-- ・前提：profiles(profiles.sql) 適用済み（player_no を引くため）。
--
-- ★ 旧版（race_day 方式）から移行します。このスクリプトは古い arena_entries を
--   ドロップして作り直すため、溜まっていた古いエントリーは一括で消えます（意図通り）。
-- ---------------------------------------------------------------------------

-- 旧テーブル・旧関数を掃除してから作り直す（データは使い捨て前提）。
drop function if exists public.enter_arena(date, text, jsonb, jsonb, text);
drop table if exists public.arena_entries cascade;

create table public.arena_entries (
  user_id     uuid not null references auth.users(id) on delete cascade,
  period      bigint not null,               -- 開催「部」ID（12hごと・0時/12時で+1）
  player_no   int,                           -- 表示用の公開プレイヤー番号
  horse_name  text not null,
  look        jsonb not null,                -- { colors, decos }（見た目）
  stats       jsonb not null,                -- スピード等の能力（シム用）
  style       text not null,                 -- 脚質 nige/senko/sashi/oikomi
  created_at  timestamptz not null default now(),
  primary key (user_id, period)              -- 1人1部1エントリー
);

create index if not exists arena_entries_period_idx on public.arena_entries (period);

alter table public.arena_entries enable row level security;

-- 全員が閲覧できる（相手抽選のため）。書込は下の関数(SECURITY DEFINER)経由のみ。
drop policy if exists "arena read all" on public.arena_entries;
create policy "arena read all" on public.arena_entries for select using (true);

-- 部エントリーを登録／上書き（1人1部1行）。本人のみ。player_no は profiles から補完。
create or replace function public.enter_arena(
  p_period bigint, p_name text, p_look jsonb, p_stats jsonb, p_style text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare pno int;
begin
  select player_no into pno from public.profiles where user_id = auth.uid();
  insert into public.arena_entries (user_id, period, player_no, horse_name, look, stats, style, created_at)
  values (
    auth.uid(), p_period, pno,
    left(coalesce(nullif(btrim(p_name), ''), 'ライバル'), 32),
    p_look, p_stats, p_style, now()
  )
  on conflict (user_id, period) do update
    set horse_name = excluded.horse_name,
        look       = excluded.look,
        stats      = excluded.stats,
        style      = excluded.style,
        player_no  = excluded.player_no,
        created_at = now();

  -- 溜め込み防止：8部（＝4日）より前のエントリーを自動削除。誰かが登録するたびに
  -- 掃除されるので、テーブルは常に数日ぶんだけに保たれる。
  delete from public.arena_entries where period < p_period - 8;
end;
$$;
grant execute on function public.enter_arena(bigint, text, jsonb, jsonb, text) to authenticated;

-- ---------------------------------------------------------------------------
-- （任意）今すぐ全エントリーを空にしたいときは、次の行のコメントを外して実行：
-- truncate table public.arena_entries;
-- ---------------------------------------------------------------------------
