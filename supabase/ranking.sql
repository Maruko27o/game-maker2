-- ===========================================================================
--  ランキング基盤（RACE_V4 §5）— テーブルと RLS のみ。今は未使用（flag OFF）。
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- クライアントは「結果」ではなく「入力（seed / コース / モード / 出走馬）」を
-- 送り、サーバが決定的シムで再現して verified を立てる設計です（不正防止）。
-- アプリ側は ENABLE_RANKING=false のあいだ何も送信しません。SQL 未適用でも
-- ゲームは通常どおり動作します。
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
