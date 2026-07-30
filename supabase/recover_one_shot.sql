-- ===========================================================================
--  セーブ復旧（これ1本で完了）
-- ===========================================================================
-- Supabase ダッシュボード → SQL Editor に全文を貼って Run するだけ。
-- user_id を書き換えれば他のプレイヤーにもそのまま使えます。
--
-- やること（1文＝1トランザクションで全部）
--   1. saves_backup から「一番良い行」を自動で選ぶ
--      （ウマの数 → コイン → 新しさ の順に強い行が勝つ。id を探す必要なし）
--   2. いまの本体を saves_backup へ退避（やり直せるように）
--   3. その行で本体を上書きし、savedAt を「いま」に進める
--      ※ savedAt を進めないと、端末に残っている空セーブのほうが新しいと判定され、
--         次の同期でまた消える（last-write-wins）。ここが復旧の肝。
--   4. 結果を1行で返す
--
-- 安全のため：
--   ・いまの本体のほうがウマが多い（＝すでに直っている／消えていない）ときは
--     何もしません。結果が 0 行なら「復旧の必要なし」です。
--   ・戻せるバックアップが1件も無いときも 0 行（＝何も壊しません）。
--   ・何度実行しても安全です（2回目以降は 0 行になります）。
--   ・対象は where の user_id 1人だけ。他のプレイヤーの行には触れません。
--   ・中身が壊れている行（horses が配列でない等）は「0頭」とみなして除外します。
--     jsonb_typeof で型を確かめてから数えているのは、そういう行があっても
--     エラーで止まらない（＝他人の壊れた行に巻き込まれない）ようにするためです。
--
-- 実行前に本人へ：「アプリを完全に閉じて、レースもガチャもしないで」。
--   開いたままだと端末の空データが自動保存で上がり、復旧をまた消します。
--
-- ★ saves_backup は7日で自動削除されます。早めに実行してください。
-- ---------------------------------------------------------------------------

with t as (
  select 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'::uuid as uid   -- ← 対象プレイヤー
),
now_ms as (
  select (extract(epoch from now()) * 1000)::bigint as ms
),
cur as (  -- いまの本体（更新前のスナップショット）
  select s.user_id,
         case when jsonb_typeof(s.data->'horses') = 'array'
              then jsonb_array_length(s.data->'horses') else 0 end as horses
  from public.saves s, t
  where s.user_id = t.uid
),
best as (  -- 復旧元：ウマが一番多い行（同数ならコインが多い方 → 新しい方）
  select b.id, b.data, b.backed_up_at,
         case when jsonb_typeof(b.data->'horses') = 'array'
              then jsonb_array_length(b.data->'horses') else 0 end as horses
  from public.saves_backup b, t
  where b.user_id = t.uid
    and case when jsonb_typeof(b.data->'horses') = 'array'
             then jsonb_array_length(b.data->'horses') else 0 end > 0
  order by horses desc,
           case when jsonb_typeof(b.data->'coins') = 'number'
                then (b.data->>'coins')::numeric else 0 end desc,
           b.backed_up_at desc
  limit 1
),
go as (  -- 復旧する価値があるときだけ実行する（＝いまのほうが少ないとき）
  select best.id, best.data, best.horses, best.backed_up_at
  from best
  left join cur on true
  where coalesce(cur.horses, -1) < best.horses
),
stash as (  -- いまの本体を退避（本体が無い＝行が無いなら何も入らない）
  insert into public.saves_backup (user_id, data, rev)
  select s.user_id, s.data, s.rev
  from public.saves s, t, go
  where s.user_id = t.uid
  returning id
),
restored as (  -- 本体を上書き（行が無ければ作成）。savedAt は「いま」に進める
  insert into public.saves (user_id, data, rev, save_version, updated_by, updated_at)
  select t.uid,
         jsonb_set(go.data, '{savedAt}', to_jsonb(now_ms.ms)),
         1,
         case when jsonb_typeof(go.data->'version') = 'number'
              then (go.data->>'version')::int else null end,
         'recover',
         now()
  from t, go, now_ms
  on conflict (user_id) do update
     set data         = excluded.data,
         rev          = public.saves.rev + 1,
         save_version = coalesce(excluded.save_version, public.saves.save_version),
         updated_by   = 'recover',
         updated_at   = now()
  returning user_id, data, rev
)
select
  (select id from go)                                          as restored_from_backup_id,
  (select backed_up_at from go)                                as backup_taken_at,
  (select count(*) from stash)                                 as stashed_current_rows,
  case when jsonb_typeof(r.data->'horses') = 'array'
       then jsonb_array_length(r.data->'horses') else 0 end    as horses,
  case when jsonb_typeof(r.data->'coins') = 'number'
       then (r.data->>'coins')::numeric else 0 end             as coins,
  case when jsonb_typeof(r.data->'trophies') = 'array'
       then jsonb_array_length(r.data->'trophies') else 0 end  as trophies,
  case when jsonb_typeof(r.data->'badges') = 'array'
       then jsonb_array_length(r.data->'badges') else 0 end    as badges,
  case when jsonb_typeof(r.data->'owned') = 'object'
       then (select count(*) from jsonb_object_keys(r.data->'owned')) else 0 end as owned_parts,
  to_timestamp(((r.data->>'savedAt')::bigint) / 1000.0)        as saved_at_now,
  r.rev
from restored r;

-- 結果の見方
--   1行返って horses / coins が期待どおり → 復旧完了。本人がアプリを開けば
--   クラウドのほうが新しいので自動で読み込まれます（ログインし直しは不要）。
--   0行 → 何も変更していません（すでに直っている、または戻せるバックアップが無い）。
