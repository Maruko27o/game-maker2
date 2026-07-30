-- ===========================================================================
--  特定のウマの能力値を書き換える（運営用）
-- ===========================================================================
-- 例：プレイヤーID 1 の「バブまるこ」を
--     スピード10 / スタミナ10 / パワー5 / 脚力5 / 根性10 / 賢さ8（合計48）に。
--
-- 触るところは3か所。ここを揃えないと表示と対戦の中身がズレる。
--   1. saves.data->horses[]        … 手持ちのウマ本体
--   2. saves.data->arena.pending   … 対戦にエントリー済みなら、その凍結スナップショット
--   3. arena_entries.stats         … 他プレイヤーが対戦する相手データ
--
-- ★ 実行前にアプリを完全に閉じること。開いたままだと端末側の古いデータが
--   自動保存で上がってきて、書き換えが無かったことになる。
--   （data.savedAt を「いま」に進めているのは、そのための保険）
-- ---------------------------------------------------------------------------

-- ▼ STEP 1: 対象の確認（参照のみ）。ここで1頭だけ出ることを必ず確かめる。
select
  p.player_no,
  h->>'id'    as horse_id,
  h->>'name'  as name,
  h->'stats'  as stats_now,
  (select sum((v)::int) from jsonb_each_text(h->'stats') as e(k, v)) as total_now
from public.profiles p
join public.saves s on s.user_id = p.user_id
cross join lateral jsonb_array_elements(s.data->'horses') as h
where p.player_no = 1
  and h->>'name' = 'バブまるこ';

-- ▼ STEP 2: 書き換え（3か所まとめて・1トランザクション）
with u as (
  select p.user_id as uid
  from public.profiles p
  where p.player_no = 1                       -- ← 対象プレイヤー
),
ns as (
  select jsonb_build_object(
           'spd', 10,   -- スピード
           'sta', 10,   -- スタミナ
           'pwr', 5,    -- パワー
           'jmp', 5,    -- 脚力
           'gut', 10,   -- 根性
           'wit', 8     -- 賢さ
         ) as st,
         'バブまるこ'::text as target                -- ← 対象のウマ名
),
-- 3. 他プレイヤーが対戦する相手データ（開催中の部のエントリー）
upd_entries as (
  update public.arena_entries e
     set stats = ns.st
    from u, ns
   where e.user_id = u.uid
     and e.horse_name = ns.target
  returning e.period
),
-- 1+2. セーブ本体（手持ち）と、対戦エントリーの凍結スナップショット
upd_save as (
  update public.saves s
     set data = jsonb_set(
                  jsonb_set(
                    -- 2. エントリー中のスナップショット（同じウマのときだけ）
                    case when s.data->'arena'->'pending'->'snapshot'->>'name' = ns.target
                         then jsonb_set(s.data, '{arena,pending,snapshot,stats}', ns.st)
                         else s.data end,
                    -- 1. 手持ちのウマ（並び順は with ordinality で保つ）
                    '{horses}',
                    (select jsonb_agg(
                              case when h->>'name' = ns.target
                                   then jsonb_set(h, '{stats}', ns.st)
                                   else h end
                              order by ord)
                     from jsonb_array_elements(s.data->'horses') with ordinality as x(h, ord))
                  ),
                  -- 端末に残っている古いデータに負けないよう、保存時刻を「いま」に
                  '{savedAt}', to_jsonb((extract(epoch from now()) * 1000)::bigint)
                ),
         rev        = s.rev + 1,
         updated_at = now(),
         updated_by = 'admin-stats'
    from u, ns
   where s.user_id = u.uid
     and exists (
       select 1 from jsonb_array_elements(s.data->'horses') as h
       where h->>'name' = ns.target
     )
  returning s.user_id, s.data, s.rev
)
select
  (select count(*) from upd_entries)                       as arena_entries_updated,
  (select count(*) from upd_save)                          as saves_updated,
  h->>'name'                                               as name,
  h->'stats'                                               as stats_new,
  (select sum((v)::int) from jsonb_each_text(h->'stats') as e(k, v)) as total_new,
  to_timestamp(((r.data->>'savedAt')::bigint) / 1000.0)    as saved_at_now,
  r.rev
from upd_save r,
     lateral jsonb_array_elements(r.data->'horses') as h
where h->>'name' = (select target from ns);

-- 結果の見方
--   saves_updated = 1 かつ stats_new が指定どおりなら成功。
--   0行なら対象が見つかっていない（名前かプレイヤーIDを確認）。
--
-- 補足：脚質はウマIDと能力値から自動で決まるので、能力を変えると脚質も変わり得る。
--   すでに対戦へエントリー済みの場合、エントリーの脚質は登録時のまま残るので、
--   揃えたいときはアプリで出走ウマを選び直す（別のウマ→元のウマ）と取り直せる。
