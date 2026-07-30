-- ===========================================================================
--  ぎっつま さんのセーブ復旧（user_id 判明済み）
-- ===========================================================================
-- Supabase ダッシュボード → SQL Editor に上から順に貼り付けて実行してください。
-- STEP 1〜3 は参照のみ（データを一切変更しません）。変更するのは STEP 5 だけです。
--
--   user_id : afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9
--   状況    : ログインできる／ランキングの最高倍率(2195.8倍)も残っている。
--             ゲーム内のコインとウマだけ消えた。
--
--   ★ saves_backup は7日で自動削除（クライアントが掃除）。急いでください。
-- ---------------------------------------------------------------------------

-- ▼ STEP 1: 本体セーブの現状
--   horses=0 なら「空のセーブで上書きされた」。行が無ければ一度も保存されていない。
--   updated_by / updated_at で、いつ・どの端末が最後に書いたか分かる。
select
  jsonb_array_length(coalesce(data->'horses', '[]'::jsonb))    as horses,
  coalesce((data->>'coins')::numeric, 0)                       as coins,
  jsonb_array_length(coalesce(data->'trophies', '[]'::jsonb))  as trophies,
  jsonb_array_length(coalesce(data->'badges',   '[]'::jsonb))  as badges,
  (select count(*) from jsonb_object_keys(coalesce(data->'owned', '{}'::jsonb))) as owned_parts,
  to_timestamp(((data->>'savedAt')::bigint) / 1000.0)          as saved_at_in_data,
  rev, save_version, updated_by, updated_at
from public.saves
where user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9';

-- ▼ STEP 2: 復旧候補（バックアップ）
--   ウマが入っている行があれば、それが消える前のデータ。id をメモする。
--   上書きの直前に必ず退避しているので、上書きが原因ならここに残っている。
select
  id,
  jsonb_array_length(coalesce(data->'horses', '[]'::jsonb))    as horses,
  coalesce((data->>'coins')::numeric, 0)                       as coins,
  jsonb_array_length(coalesce(data->'trophies', '[]'::jsonb))  as trophies,
  jsonb_array_length(coalesce(data->'badges',   '[]'::jsonb))  as badges,
  (select count(*) from jsonb_object_keys(coalesce(data->'owned', '{}'::jsonb))) as owned_parts,
  to_timestamp(((data->>'savedAt')::bigint) / 1000.0)          as saved_at_in_data,
  rev, backed_up_at
from public.saves_backup
where user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'
order by jsonb_array_length(coalesce(data->'horses', '[]'::jsonb)) desc, backed_up_at desc;

-- ▼ STEP 3: 中身の確認（STEP 2 で選んだ id を入れる）
--   本人に「これで合っている？」と見せられるように、ウマの名前と能力合計を出す。
select
  h->>'name'                                        as name,
  h->>'skill'                                       as skill,
  (select sum((v)::int) from jsonb_each_text(h->'stats') as e(k, v)) as stats_total
from public.saves_backup b,
     jsonb_array_elements(b.data->'horses') as h
where b.id = <BACKUP_ID>
order by stats_total desc;

-- ---------------------------------------------------------------------------
-- ▼ ここから先はデータを変更します。実行前に必ず本人へ：
--     「アプリを完全に閉じておいて（レース・ガチャもしない）」
--   開いたままだと、端末の空データが自動保存でクラウドへ上がり、
--   復旧した内容をまた消してしまいます。
-- ---------------------------------------------------------------------------

-- ▼ STEP 4: いまの（空の）本体を退避しておく。やり直せるように。
insert into public.saves_backup (user_id, data, rev)
select user_id, data, rev
from public.saves
where user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9';

-- ▼ STEP 5: バックアップで本体を上書き（<BACKUP_ID> は STEP 2 で選んだ id）
--   ★ data の savedAt を「いま」に進めるのが重要。
--     復旧データは消える前のものなので savedAt が古く、そのまま戻すと
--     端末に残っている空セーブのほうが新しいと判定され、次の同期で
--     また上書きされてしまう（last-write-wins）。
update public.saves s
   set data        = jsonb_set(
                       b.data,
                       '{savedAt}',
                       to_jsonb((extract(epoch from now()) * 1000)::bigint)
                     ),
       rev         = s.rev + 1,
       updated_at  = now(),
       updated_by  = 'recover'
  from public.saves_backup b
 where b.id = <BACKUP_ID>
   and b.user_id = s.user_id
   and s.user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9';

-- ▼ STEP 6: 復旧できたかの確認（STEP 1 と同じクエリ）
select
  jsonb_array_length(coalesce(data->'horses', '[]'::jsonb))    as horses,
  coalesce((data->>'coins')::numeric, 0)                       as coins,
  to_timestamp(((data->>'savedAt')::bigint) / 1000.0)          as saved_at_in_data,
  rev, updated_by, updated_at
from public.saves
where user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9';

-- そのあと本人がアプリを開けば、クラウドのほうが新しいので自動で読み込まれます。

-- ---------------------------------------------------------------------------
-- ▼ 参考: バックアップに中身が無かった場合に、他テーブルから拾えるもの
--   （完全復旧はできませんが「何が残っているか」の確認用。すべて参照のみ）
-- ---------------------------------------------------------------------------

-- 対戦にエントリーしたウマは、名前・見た目・能力・脚質がサーバに残っている。
-- ここから1頭ぶんは作り直せる。
select period, horse_name, look, stats, style, created_at
from public.arena_entries
where user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'
order by period desc
limit 20;

-- ランキング行（アイコン・飾りトロフィー・最高倍率・最高払戻）。
select username, best_odds, best_payout, avatar, display_trophies, equipped_frame, updated_at
from public.bet_scores
where user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9';
