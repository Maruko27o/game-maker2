-- ===========================================================================
--  「また消えた」の裏取り：いつ・どんな中身で上書きされたかを時系列で見る
-- ===========================================================================
-- 参照のみ。データは一切変更しません。
--
-- 読み方（想定している原因）
--   起動直後のアプリは “ゲスト枠” のセーブを読んでいる。クラウド突合はその後に
--   走るので、ゲスト枠の中身をアカウントの端末データだと誤認し、時計だけ新しい
--   ゲストデータでクラウドを上書きしていた。
--   → その場合、上書き直前のバックアップ（本物）が saves_backup に残り、
--     いまの本体は「ウマが数頭・コインが少ない・登録前後の作成日」になる。
-- ---------------------------------------------------------------------------

-- ▼ A: いまの本体と、バックアップ全部を1つの時系列で
select
  'now'::text                                                   as kind,
  null::bigint                                                  as backup_id,
  case when jsonb_typeof(s.data->'horses') = 'array'
       then jsonb_array_length(s.data->'horses') else 0 end     as horses,
  case when jsonb_typeof(s.data->'coins') = 'number'
       then (s.data->>'coins')::numeric else 0 end              as coins,
  case when jsonb_typeof(s.data->'trophies') = 'array'
       then jsonb_array_length(s.data->'trophies') else 0 end   as trophies,
  s.rev,
  s.updated_by,
  s.updated_at                                                  as at,
  to_timestamp(((s.data->>'savedAt')::bigint) / 1000.0)         as saved_at_in_data
from public.saves s
where s.user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'

union all

select
  'backup',
  b.id,
  case when jsonb_typeof(b.data->'horses') = 'array'
       then jsonb_array_length(b.data->'horses') else 0 end,
  case when jsonb_typeof(b.data->'coins') = 'number'
       then (b.data->>'coins')::numeric else 0 end,
  case when jsonb_typeof(b.data->'trophies') = 'array'
       then jsonb_array_length(b.data->'trophies') else 0 end,
  b.rev,
  null,
  b.backed_up_at,
  to_timestamp(((b.data->>'savedAt')::bigint) / 1000.0)
from public.saves_backup b
where b.user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'
order by at desc;

-- ▼ B: いまの本体に入っているウマ（何頭・いつ作られたか）
--   作成日が「アカウント登録より前」に寄っていれば、登録前に遊んだゲスト枠の
--   データで上書きされた＝今回の想定どおり。
select
  h->>'id'                                              as horse_id,
  h->>'name'                                            as name,
  to_timestamp(((h->>'createdAt')::bigint) / 1000.0)    as created_at
from public.saves s
cross join lateral jsonb_array_elements(s.data->'horses') as h
where s.user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'
order by created_at;

-- ▼ C: 決め手 — いまの本体のウマと、復旧元バックアップのウマが「別系統」か
--   overlap = 0 なら、同じアカウントの続きではない＝別の枠のセーブで
--   上書きされたことがはっきりする。
with best as (
  select b.id, b.data
  from public.saves_backup b
  where b.user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'
    and case when jsonb_typeof(b.data->'horses') = 'array'
             then jsonb_array_length(b.data->'horses') else 0 end > 0
  order by case when jsonb_typeof(b.data->'horses') = 'array'
                then jsonb_array_length(b.data->'horses') else 0 end desc,
           b.backed_up_at desc
  limit 1
),
cur_ids as (
  select h->>'id' as id
  from public.saves s
  cross join lateral jsonb_array_elements(s.data->'horses') as h
  where s.user_id = 'afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9'
),
bak_ids as (
  select h->>'id' as id
  from best b
  cross join lateral jsonb_array_elements(b.data->'horses') as h
)
select
  (select id from best)                                          as backup_id,
  (select count(*) from cur_ids)                                 as horses_now,
  (select count(*) from bak_ids)                                 as horses_in_backup,
  (select count(*) from cur_ids c join bak_ids k on k.id = c.id)  as overlap;
