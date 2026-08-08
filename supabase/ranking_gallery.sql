-- ===========================================================================
--  ギャラリー（飾り棚）をランキングに反映
--  ── 集めたフレーム・称号・トロフィー・バッジのうち、自分で選んだものを
--     他の人の画面（ランキングのアイコンをタップしたときの個人ページ）に飾る
-- ===========================================================================
-- Supabase の SQL Editor に貼り付けて一度だけ実行してください。
--
-- ・前提：ranking.sql / ranking_payout.sql / ranking_monthly.sql /
--         ranking_frames.sql / ranking_titles.sql が適用済みであること。
-- ・bet_scores に gallery（jsonb）列を足し、専用RPCで保存できるようにします。
-- ・**未適用でもアプリは通常どおり動きます。** 自分の飾り棚は端末に保存されて
--   自分の画面には出ますが、他の人には見えないだけです（列が無いときは
--   クライアント側が1段落として今までどおりの列で読みます）。
--
-- ■ 入るデータについて
--   飾り棚に入るのは**見た目だけ**（どのフレーム／称号／トロフィー／バッジを
--   飾るか）で、強さにも確率にもコインにも一切かかわりません。
--   中身はクライアントで最大8件に絞ってから送られ、読むときも
--   logic/gallery.ts の parseGallery を必ず通して検証します。
--   例： [{"k":"frame","frame":{"kind":"animalMaster","animal":"penguin"}},
--         {"k":"title","id":"gold_emperor"},
--         {"k":"trophy","rank":1},
--         {"k":"badge","id":"badge_1st"}]
-- ---------------------------------------------------------------------------

-- 1) 飾り棚の列を追加（未設定は null ＝ 何も飾っていない）。
alter table public.bet_scores add column if not exists gallery jsonb;

-- 2) 飾り棚だけを更新する RPC（当月の行が対象。set_bet_frame / set_bet_title と同型）。
--    棚を空にした（[] を渡した）ときも反映できるよう coalesce はしない。
--    自分の行しか触れない（auth.uid() で絞る）ので、他人の棚は書き換えられない。
create or replace function public.set_bet_gallery(p_gallery jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 念のためサーバ側でも件数を抑える（クライアントの不具合や改造対策）。
  if p_gallery is not null and jsonb_typeof(p_gallery) = 'array' and jsonb_array_length(p_gallery) > 8 then
    p_gallery := (select jsonb_agg(e) from (select e from jsonb_array_elements(p_gallery) e limit 8) t);
  end if;
  update public.bet_scores set gallery = p_gallery
    where user_id = auth.uid() and period = public.current_period();
end; $$;
grant execute on function public.set_bet_gallery(jsonb) to authenticated;

-- 3) 提出関数にも p_gallery を追加（当月の行へ upsert）。
--    null（未設定・旧クライアント）のときは既存の棚を消さない。
drop function if exists public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb, text, jsonb);
create or replace function public.submit_bet_score(
  p_odds numeric, p_course text, p_username text,
  p_avatar jsonb default null, p_trophies jsonb default null, p_payout bigint default 0,
  p_frame jsonb default null, p_title text default null, p_gallery jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare per text := public.current_period();
begin
  insert into public.bet_scores (user_id, period, username, best_odds, course_id, avatar, display_trophies, best_payout, payout_course, equipped_frame, title, gallery, updated_at)
  values (auth.uid(), per, coalesce(nullif(btrim(p_username), ''), 'プレイヤー'), p_odds, p_course, p_avatar, p_trophies, greatest(p_payout, 0), p_course, p_frame, p_title, p_gallery, now())
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
        gallery          = coalesce(excluded.gallery, public.bet_scores.gallery),
        updated_at       = now();
end;
$$;
grant execute on function public.submit_bet_score(numeric, text, text, jsonb, jsonb, bigint, jsonb, text, jsonb) to authenticated;

-- 4) 確認用（実行しなくてもかまいません）
--    自分の行に棚が入っているか見るだけのSELECT。
-- select user_id, period, jsonb_array_length(coalesce(gallery,'[]'::jsonb)) as items
--   from public.bet_scores where user_id = auth.uid();
