-- ===========================================================================
--  装備フレームをランキングに反映（改修：各プレイヤーが設定中のアイコンフレームを
--  ランキング各行に表示する）
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- ・前提：ranking.sql / ranking_payout.sql / ranking_monthly.sql 適用済み。
-- ・bet_scores に equipped_frame（jsonb）列を足し、提出・専用RPCで保存できるように
--   します。読み取り（loadLeaderboard）はこの列を含めて取得し、各行に表示します。
-- ・未適用でもアプリは通常どおり動作します（列が無ければ自分の行のみローカル表示）。
-- ---------------------------------------------------------------------------

-- 1) 装備フレーム列を追加（{period, rank, metric} を丸ごと保存。未装備は null）。
alter table public.bet_scores add column if not exists equipped_frame jsonb;

-- 2) 提出関数に p_frame を追加（当月の行へ upsert。null のときは既存値を保持）。
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb);
create or replace function public.submit_bet_score(
  p_odds numeric, p_course text, p_username text,
  p_avatar jsonb default null, p_trophies jsonb default null, p_payout bigint default 0,
  p_frame jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare per text := public.current_period();
begin
  insert into public.bet_scores (user_id, period, username, best_odds, course_id, avatar, display_trophies, best_payout, payout_course, equipped_frame, updated_at)
  values (auth.uid(), per, coalesce(nullif(btrim(p_username), ''), 'プレイヤー'), p_odds, p_course, p_avatar, p_trophies, greatest(p_payout, 0), p_course, p_frame, now())
  on conflict (user_id, period) do update
    set best_odds        = greatest(public.bet_scores.best_odds, excluded.best_odds),
        course_id        = case when excluded.best_odds > public.bet_scores.best_odds
                                then excluded.course_id else public.bet_scores.course_id end,
        best_payout      = greatest(public.bet_scores.best_payout, excluded.best_payout),
        payout_course    = case when excluded.best_payout > public.bet_scores.best_payout
                                then excluded.payout_course else public.bet_scores.payout_course end,
        username         = excluded.username,
        avatar           = coalesce(excluded.avatar, public.bet_scores.avatar),
        display_trophies = coalesce(excluded.display_trophies, public.bet_scores.display_trophies),
        equipped_frame   = coalesce(excluded.equipped_frame, public.bet_scores.equipped_frame),
        updated_at       = now();
end;
$$;
grant execute on function public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb) to authenticated;

-- 3) 装備フレームだけを更新する RPC（当月の行が対象。set_bet_avatar と同型）。
--    フレームを外した（null）ときも反映できるよう coalesce はしない。
create or replace function public.set_bet_frame(p_frame jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bet_scores set equipped_frame = p_frame
    where user_id = auth.uid() and period = public.current_period();
end; $$;
grant execute on function public.set_bet_frame(jsonb) to authenticated;
