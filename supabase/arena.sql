-- ===========================================================================
--  対戦（デイリー勝ち抜きトーナメント）— 他プレイヤーのウマの共有プール
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- ・各プレイヤーは1日1頭を arena_entries に登録（enter_arena）。
-- ・翌日、他プレイヤーの当日エントリーからトーナメントの相手を抽選する。
-- ・未適用でもアプリは動作します（登録は握りつぶし・相手はCOMで自動補充）。
-- ・前提：profiles(profiles.sql) 適用済み（player_no を引くため）。
-- ---------------------------------------------------------------------------

create table if not exists public.arena_entries (
  user_id     uuid not null references auth.users(id) on delete cascade,
  race_day    date not null,                 -- 開催日（＝エントリー日）
  player_no   int,                            -- 表示用の公開プレイヤー番号
  horse_name  text not null,
  look        jsonb not null,                 -- { colors, decos }（見た目）
  stats       jsonb not null,                 -- スピード等の能力（シム用）
  style       text not null,                  -- 脚質 nige/senko/sashi/oikomi
  created_at  timestamptz not null default now(),
  primary key (user_id, race_day)             -- 1人1日1エントリー
);

create index if not exists arena_entries_day_idx on public.arena_entries (race_day);

alter table public.arena_entries enable row level security;

-- 全員が閲覧できる（相手抽選のため）。書込は下の関数(SECURITY DEFINER)経由のみ。
drop policy if exists "arena read all" on public.arena_entries;
create policy "arena read all" on public.arena_entries for select using (true);

-- 当日エントリーを登録／上書き（1人1日1行）。本人のみ。player_no は profiles から補完。
create or replace function public.enter_arena(
  p_day date, p_name text, p_look jsonb, p_stats jsonb, p_style text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare pno int;
begin
  select player_no into pno from public.profiles where user_id = auth.uid();
  insert into public.arena_entries (user_id, race_day, player_no, horse_name, look, stats, style, created_at)
  values (
    auth.uid(), p_day, pno,
    left(coalesce(nullif(btrim(p_name), ''), 'ライバル'), 32),
    p_look, p_stats, p_style, now()
  )
  on conflict (user_id, race_day) do update
    set horse_name = excluded.horse_name,
        look       = excluded.look,
        stats      = excluded.stats,
        style      = excluded.style,
        player_no  = excluded.player_no,
        created_at = now();
end;
$$;
grant execute on function public.enter_arena(date, text, jsonb, jsonb, text) to authenticated;
