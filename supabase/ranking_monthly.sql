-- ===========================================================================
--  月次ランキング（改修：ランキングは1ヶ月ごと・毎月1日 0:00 JST で更新）
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
-- ・前提：ranking.sql / ranking_payout.sql 適用済み（bet_scores / submit_bet_score）。
-- ・bet_scores を「月ごと（period='YYYY-MM' JST）」に変更します。提出は当月の行へ、
--   ランキング表示は当月のみ → 毎月自動でリセットされ、過去月は殿堂用に残ります。
-- ・未適用でもアプリは通常どおり動作します（提出・取得は握りつぶし）。
-- ---------------------------------------------------------------------------

-- 対象月（JST の暦月）を返すヘルパ。クライアントの logic/period.ts と一致する。
create or replace function public.current_period()
returns text language sql stable as $$
  select to_char((now() at time zone 'Asia/Tokyo'), 'YYYY-MM')
$$;

-- 1) period 列を追加し、既存行を当月に割り当ててから複合主キーへ移行。
alter table public.bet_scores add column if not exists period text;
update public.bet_scores set period = public.current_period() where period is null;
alter table public.bet_scores alter column period set not null;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'bet_scores_pkey') then
    alter table public.bet_scores drop constraint bet_scores_pkey;
  end if;
end $$;
alter table public.bet_scores add constraint bet_scores_pkey primary key (user_id, period);

create index if not exists bet_scores_period_odds_idx   on public.bet_scores (period, best_odds  desc);
create index if not exists bet_scores_period_payout_idx on public.bet_scores (period, best_payout desc);

-- 2) 提出関数を「当月の行」へ upsert するよう作り直す（period はサーバが決定）。
drop function if exists public.submit_bet_score(numeric, text, text);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb);
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint);
create or replace function public.submit_bet_score(
  p_odds numeric, p_course text, p_username text,
  p_avatar jsonb default null, p_trophies jsonb default null, p_payout bigint default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare per text := public.current_period();
begin
  insert into public.bet_scores (user_id, period, username, best_odds, course_id, avatar, display_trophies, best_payout, payout_course, updated_at)
  values (auth.uid(), per, coalesce(nullif(btrim(p_username), ''), 'プレイヤー'), p_odds, p_course, p_avatar, p_trophies, greatest(p_payout, 0), p_course, now())
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
        updated_at       = now();
end;
$$;
grant execute on function public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint) to authenticated;

-- 3) アイコン／トロフィー／表示名の更新は「当月の行」だけを対象に（過去月＝殿堂は保持）。
create or replace function public.set_bet_avatar(p_avatar jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bet_scores set avatar = p_avatar
    where user_id = auth.uid() and period = public.current_period();
end; $$;
grant execute on function public.set_bet_avatar(jsonb) to authenticated;

create or replace function public.set_bet_trophies(p_trophies jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.bet_scores set display_trophies = p_trophies
    where user_id = auth.uid() and period = public.current_period();
end; $$;
grant execute on function public.set_bet_trophies(jsonb) to authenticated;

create or replace function public.set_display_name(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  nm := nullif(btrim(p_name), '');
  if nm is null then return null; end if;
  nm := left(nm, 32);
  update public.profiles set display_name = nm where user_id = auth.uid();
  -- 現在ランキングに載っている当月の行の表示名も揃える。
  update public.bet_scores set username = nm
    where user_id = auth.uid() and period = public.current_period();
  return nm;
end; $$;
grant execute on function public.set_display_name(text) to authenticated;
