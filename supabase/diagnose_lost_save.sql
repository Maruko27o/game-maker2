-- ===========================================================================
--  セーブが消えた？の調査と復旧（プレイヤー名から辿る版）
-- ===========================================================================
-- Supabase ダッシュボード → SQL Editor に貼り付け、上から順に実行してください。
-- SQL Editor は service_role 権限なので RLS を越えて確認できます。
--
-- ★ STEP 4（復旧）だけは実行前に必ず内容を確認してください。ここまでは全て
--   参照のみで、データは一切変更しません。
--
-- ★ 時間制限：saves_backup は「7日で自動削除」です（クライアントが掃除）。
--   バックアップから戻すなら、消えたと言われてから7日以内に実施してください。
-- ---------------------------------------------------------------------------

-- 調べたいプレイヤー名（ランキングに出ている表示名）
--   例: 'ぎっつま'
\set target_name 'ぎっつま'

-- ▼ STEP 1: 表示名から user_id / アカウントを特定
--   bet_scores（ランキング）と saves（セーブ本体）は別テーブルで、
--   ランキング行は消えないし best_odds は greatest() でしか動かない。
--   つまり「ランキングには残っているのにゲームが空」は普通に起こり得るので、
--   ランキングに載っていること自体はセーブが無事な証拠にはならない。
select
  b.user_id,
  b.username,
  b.best_odds,
  b.updated_at    as score_updated_at,
  u.email,
  u.created_at    as account_created_at,
  u.last_sign_in_at
from public.bet_scores b
join auth.users u on u.id = b.user_id
where b.username = 'ぎっつま';

-- ▼ STEP 2: 本体セーブの中身（↑で出た user_id を入れる）
--   horses が 0 → 中身が消えている（上書きされたか、最初から空）
--   行が無い     → そもそも一度もクラウド保存していない（＝端末ローカルのみで遊んでいた）
--   updated_by / updated_at で「いつ・どの端末から」書かれたかが分かる。
select
  s.user_id,
  jsonb_array_length(coalesce(s.data->'horses', '[]'::jsonb))   as horses,
  coalesce((s.data->>'coins')::numeric, 0)                       as coins,
  jsonb_array_length(coalesce(s.data->'trophies', '[]'::jsonb)) as trophies,
  jsonb_array_length(coalesce(s.data->'badges',   '[]'::jsonb)) as badges,
  (select count(*) from jsonb_object_keys(coalesce(s.data->'owned', '{}'::jsonb))) as owned_parts,
  s.rev,
  s.save_version,
  s.updated_by,
  s.updated_at
from public.saves s
where s.user_id = '<USER_ID>';

-- ▼ STEP 3: バックアップ（上書きの直前に退避された7日ぶん）
--   horses が入っている行があれば、それが消える前のデータ。
select
  b.id,
  jsonb_array_length(coalesce(b.data->'horses', '[]'::jsonb))   as horses,
  coalesce((b.data->>'coins')::numeric, 0)                       as coins,
  jsonb_array_length(coalesce(b.data->'trophies', '[]'::jsonb)) as trophies,
  b.rev,
  b.backed_up_at
from public.saves_backup b
where b.user_id = '<USER_ID>'
order by b.backed_up_at desc;

-- ▼ STEP 3b: 「別アカウントを作ってしまった」パターンの確認
--   メールの綴り違いなどで新規アカウントになると、本人のデータは元の user_id に
--   無事に残っている。中身のあるアカウントが他にないかを探す。
select
  u.id,
  u.email,
  u.created_at,
  u.last_sign_in_at,
  coalesce(jsonb_array_length(s.data->'horses'), 0) as horses,
  s.updated_at
from auth.users u
left join public.saves s on s.user_id = u.id
order by coalesce(jsonb_array_length(s.data->'horses'), 0) desc, u.created_at desc
limit 50;

-- ---------------------------------------------------------------------------
-- ▼ STEP 4: 復旧（実行前に必ず STEP 3 の結果を確認すること）
--
--   STEP 3 で「馬が入っている一番良い行」の id を <BACKUP_ID> に入れて実行する。
--   本体セーブをそのバックアップで上書きし、rev を1つ進める（クラウドが最新になる）。
--
--   ※ 実行前に、本人に「アプリを開かない・レースやガチャをしない」と伝えること。
--     端末側の変更がクラウドへ上がると、せっかく戻したデータを上書きしてしまう。
--   ※ 念のため、戻す前に「いまの本体」も saves_backup に退避しておくと安全
--     （下の 4a → 4b の順で実行）。
--
-- -- 4a: いまの本体を退避（やり直せるように）
-- insert into public.saves_backup (user_id, data, rev)
-- select user_id, data, rev from public.saves where user_id = '<USER_ID>';
--
-- -- 4b: バックアップで本体を上書き
-- --     ★ data の savedAt を「いま」に進める。復旧データは消える前のものなので
-- --       savedAt が古く、そのまま戻すと端末に残っている空セーブのほうが新しいと
-- --       判定され、次の同期でまた上書きされてしまう（last-write-wins）。
-- update public.saves s
--    set data       = jsonb_set(b.data, '{savedAt}',
--                       to_jsonb((extract(epoch from now()) * 1000)::bigint)),
--        rev        = s.rev + 1,
--        updated_at = now(),
--        updated_by = 'recover'
--   from public.saves_backup b
--  where b.id = <BACKUP_ID>
--    and b.user_id = s.user_id;

-- ▼ STEP 4c: クラウドに復旧元が無かった場合
--   saves に行が無い／horses が 0 で、saves_backup にも中身が無いなら、
--   サーバ側には戻せるデータがありません。その場合の唯一の望みは本人の端末：
--     ・最後に遊んだ端末・ブラウザで「サイトデータを消さずに」アプリを開く
--     ・ログインすると、ローカルに残っていればクラウドへ復元される
--       （空データでクラウドを上書きしない安全網は実装済み）
--   iPhone の Safari は、ホーム画面に追加していないサイトの保存領域を
--   「7日間アクセスが無いと自動削除」します。これに当たっていると復旧不能です。
