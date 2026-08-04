-- ===========================================================================
--  称号をランキングに反映（プロフィールで選んだ称号を、ランキングのアイコンを
--  タップしたときの個人ページに表示する）
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- ・前提：ranking.sql / ranking_payout.sql / ranking_monthly.sql / ranking_frames.sql
--   が適用済みであること。
-- ・bet_scores に title（text）列を足し、提出と専用RPCで保存できるようにします。
-- ・未適用でもアプリは通常どおり動きます（他人の称号が出ないだけで、自分の
--   プロフィールでは選べます）。
-- ---------------------------------------------------------------------------

-- 1) 称号ID の列を追加（未設定は null ＝「かけだし」扱い）。
alter table public.bet_scores add column if not exists title text;

-- 2) 提出関数に p_title を追加（当月の行へ upsert）。
--    称号は「今つけているもの」なので、渡ってきたら常に上書きする。
--    ただし null（未設定・旧クライアント）のときは既存値を消さない。
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb, text);
create or replace function public.submit_bet_score(
  p_odds numeric, p_course text, p_username text,
  p_avatar jsonb default null, p_trophies jsonb default null, p_payout bigint default 0,
  p_frame jsonb default null, p_title text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare per text := public.current_period();
begin
  insert into public.bet_scores (user_id, period, username, best_odds, course_id, avatar, display_trophies, best_payout, payout_course, equipped_frame, title, updated_at)
  values (auth.uid(), per, coalesce(nullif(btrim(p_username), ''), 'プレイヤー'), p_odds, p_course, p_avatar, p_trophies, greatest(p_payout, 0), p_course, p_frame, p_title, now())
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
        title            = coalesce(excluded.title, public.bet_scores.title),
        updated_at       = now();
end;
$$;
grant execute on function public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb, text) to authenticated;

-- 3) 称号だけを更新する RPC（当月の行が対象。set_bet_frame と同型）。
--    外した（null）ときも反映できるよう coalesce はしない。
create or replace function public.set_bet_title(p_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bet_scores set title = p_title
    where user_id = auth.uid() and period = public.current_period();
end; $$;
grant execute on function public.set_bet_title(text) to authenticated;
