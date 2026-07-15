-- ===========================================================================
--  ランキング（的中倍率・改修④）＋ ランキング基盤（RACE_V4 §5）
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- ・メインは下半分「的中倍率ランキング（改修④）」。適用してデプロイすると、
--   ログイン中プレイヤーの最大的中倍率が 1人1行 で載ります（ENABLE_RANKING=true）。
-- ・上半分の race_results/leaderboards はコース別ベストタイムの基盤（将来用）。
-- ・未適用でもアプリは通常どおり動作します（送信・取得は握りつぶし）。
-- ・前提：saves / profiles(profiles.sql) と account.sql(profiles.display_name) 適用済み。
-- ---------------------------------------------------------------------------

-- レース結果（本人のみ書き込み・全員が verified 済みを閲覧）
create table if not exists public.race_results (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  horse_name  text not null,
  course_id   text not null,
  mode        smallint not null,               -- 30 or 60
  rank        smallint not null,               -- 着順（本人の馬）
  time_ms     integer not null,                -- 本人の馬のタイム（ミリ秒）
  seed        bigint not null,                 -- レースのシード（再現用）
  sim_version integer not null,                -- シムのバージョン
  verified    boolean not null default false,  -- サーバ再現で一致したら true
  created_at  timestamptz not null default now()
);

create index if not exists race_results_course_idx
  on public.race_results (course_id, mode, verified, time_ms);

alter table public.race_results enable row level security;

-- 本人だけ INSERT できる（verified は既定 false のまま。true 化はサーバ関数側）
drop policy if exists "own results insert" on public.race_results;
create policy "own results insert" on public.race_results
  for insert with check (auth.uid() = user_id);

-- 検証済みの結果は全員が閲覧できる（＝ランキング表示用）
drop policy if exists "verified results read" on public.race_results;
create policy "verified results read" on public.race_results
  for select using (verified);

-- 自分の結果は未検証でも閲覧できる（自分の記録確認用）
drop policy if exists "own results read" on public.race_results;
create policy "own results read" on public.race_results
  for select using (auth.uid() = user_id);

-- リーダーボード：コース×モードごとのベストタイム上位（コース別ベストタイム主軸）。
-- verified 済みのみを対象にした読み取り専用ビュー。
create or replace view public.leaderboards as
  select
    r.course_id,
    r.mode,
    r.user_id,
    p.player_no,
    r.horse_name,
    min(r.time_ms) as best_time_ms
  from public.race_results r
  left join public.profiles p on p.user_id = r.user_id
  where r.verified
  group by r.course_id, r.mode, r.user_id, p.player_no, r.horse_name;

-- ビューは呼び出し元権限で評価され、下層の race_results RLS（verified のみ公開）が
-- そのまま効くため、リーダーボードには検証済みの記録だけが載る。
grant select on public.leaderboards to authenticated;

-- ===========================================================================
--  的中倍率ランキング（改修④）— 1ユーザ1行・自己ベスト倍率のみ
-- ===========================================================================
-- ユーザネーム（既定値はクライアントが自動付与し、変更可）: profiles.display_name は
-- account.sql で追加済み。本人だけ更新できるポリシーと設定関数を用意する。

drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 表示名を設定（前後空白を除去・32文字まで）。本人のみ。
create or replace function public.set_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare nm text;
begin
  nm := nullif(btrim(p_name), '');
  if nm is null then return null; end if;
  nm := left(nm, 32);
  update public.profiles set display_name = nm where user_id = auth.uid();
  return nm;
end;
$$;
grant execute on function public.set_display_name(text) to authenticated;

-- 的中スコア（PK=user_id → 1ユーザ必ず1行。best_odds は自己ベストのみ）
create table if not exists public.bet_scores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  username   text not null,
  best_odds  numeric not null,
  course_id  text,
  updated_at timestamptz not null default now()
);
create index if not exists bet_scores_odds_idx on public.bet_scores (best_odds desc);
alter table public.bet_scores enable row level security;

-- 全員が閲覧できる（ランキング表示用）。書込は下の関数(SECURITY DEFINER)経由のみ。
drop policy if exists "scores read all" on public.bet_scores;
create policy "scores read all" on public.bet_scores for select using (true);

-- 自己ベスト倍率を提出：既存より大きいときだけ更新。常に auth.uid() 自身の1行。
create or replace function public.submit_bet_score(p_odds numeric, p_course text, p_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bet_scores (user_id, username, best_odds, course_id, updated_at)
  values (auth.uid(), coalesce(nullif(btrim(p_username), ''), 'プレイヤー'), p_odds, p_course, now())
  on conflict (user_id) do update
    set best_odds  = greatest(public.bet_scores.best_odds, excluded.best_odds),
        course_id  = case when excluded.best_odds > public.bet_scores.best_odds
                          then excluded.course_id else public.bet_scores.course_id end,
        username   = excluded.username,
        updated_at = now();
end;
$$;
grant execute on function public.submit_bet_score(numeric, text, text) to authenticated;
