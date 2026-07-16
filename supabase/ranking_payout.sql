-- ===========================================================================
--  最大獲得賞金ランキング（③）— 最大オッズとは別軸のランキング
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- ・前提：ranking.sql（bet_scores / submit_bet_score）適用済み。
-- ・bet_scores に「1レースで得た払戻金の自己ベスト（best_payout）」を追加し、
--   submit_bet_score に p_payout を足して同時に更新できるようにします。
-- ・未適用でもアプリは通常どおり動作します（クライアントは旧シグネチャにフォールバック）。
-- ---------------------------------------------------------------------------

alter table public.bet_scores add column if not exists best_payout   bigint not null default 0;
alter table public.bet_scores add column if not exists payout_course text;

create index if not exists bet_scores_payout_idx on public.bet_scores (best_payout desc);

-- 提出関数を p_payout 付きに作り直す（best_odds と best_payout をそれぞれ自己ベスト更新）。
-- 旧シグネチャは残すと多重定義になるため削除してから作成。
drop function if exists public.submit_bet_score(numeric, text, text);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb);
create or replace function public.submit_bet_score(
  p_odds numeric, p_course text, p_username text,
  p_avatar jsonb default null, p_trophies jsonb default null, p_payout bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bet_scores (user_id, username, best_odds, course_id, avatar, display_trophies, best_payout, payout_course, updated_at)
  values (auth.uid(), coalesce(nullif(btrim(p_username), ''), 'プレイヤー'), p_odds, p_course, p_avatar, p_trophies, greatest(p_payout, 0), p_course, now())
  on conflict (user_id) do update
    set best_odds        = greatest(public.bet_scores.best_odds, excluded.best_odds),
        course_id        = case when excluded.best_odds > public.bet_scores.best_odds
                                then excluded.course_id else public.bet_scores.course_id end,
        best_payout      = greatest(public.bet_scores.best_payout, excluded.best_payout),
        payout_course    = case when excluded.best_payout > public.bet_scores.best_payout
                                then excluded.payout_course else public.bet_scores.payout_course end,
        username         = excluded.username,
        avatar           = coalesce(excluded.avatar, public.bet_scores.avatar),
        display_trophies = coalesce(excluded.display_trophies, public.bet_scores.display_trophies),
        updated_at       = now();
end;
$$;
grant execute on function public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint) to authenticated;
