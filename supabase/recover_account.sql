-- ===========================================================================
--  アカウントのデータ復旧（RACE_V4 後の消失対応）
-- ===========================================================================
-- Supabase ダッシュボード → SQL Editor に貼り付け、上から順に実行してください。
-- （SQL Editor は service_role 権限で動くので RLS を越えて確認・復旧できます）
--
-- 対象アカウントのメール:  sirousagi0911@icloud.com
-- ---------------------------------------------------------------------------

-- ▼ STEP 1: user_id を確認
select id as user_id, email, created_at
from auth.users
where email = 'sirousagi0911@icloud.com';

-- ▼ STEP 2: いまの本体セーブの中身を確認（馬の数・最終更新・rev）
--   horses が 0 なら「上書きで消えた」状態。1以上なら本体は無事（＝表示側の問題）。
select
  s.user_id,
  jsonb_array_length(coalesce(s.data->'horses', '[]'::jsonb)) as horses,
  (select count(*) from jsonb_object_keys(coalesce(s.data->'owned', '{}'::jsonb))) as owned_parts,
  s.rev,
  s.updated_at,
  s.updated_by
from public.saves s
join auth.users u on u.id = s.user_id
where u.email = 'sirousagi0911@icloud.com';

-- ▼ STEP 3: バックアップ（衝突時に退避された7日分）を確認
--   ここに horses が多い行があれば、それが消える前のデータです。
select
  b.id,
  jsonb_array_length(coalesce(b.data->'horses', '[]'::jsonb)) as horses,
  b.rev,
  b.backed_up_at
from public.saves_backup b
join auth.users u on u.id = b.user_id
where u.email = 'sirousagi0911@icloud.com'
order by b.backed_up_at desc;

-- ---------------------------------------------------------------------------
-- ▼ STEP 4: 復旧
--   STEP 3 で「馬が入っている一番良い行」の id を見つけ、下の <BACKUP_ID> を
--   その数字に置き換えて実行してください。本体セーブをそのバックアップで上書きし、
--   rev を1つ進めます（クラウド側が最新になります）。
--
--   ※ 実行前に、いま遊んでいる端末で新しいデータを保存しない（レースやガチャを
--     しない）でください。端末側の変更がクラウドに上がると上書きされます。
--
-- update public.saves s
--   set data = b.data,
--       rev  = s.rev + 1,
--       updated_at = now(),
--       updated_by = 'recover'
--   from public.saves_backup b
--   where b.id = <BACKUP_ID>
--     and b.user_id = s.user_id;

-- ▼ STEP 4b（バックアップが無く、本体 saves にも馬が無い場合）
--   クラウドには復旧元がありません。ただし、最後に遊んだ端末のブラウザに
--   ローカル保存が残っていることがあります。その端末で「ブラウザのデータを消さずに」
--   最新版アプリを開き、ログインし直すと、修正後のロジックにより
--   ローカルのデータがクラウドへ復元されます（空データでの上書きは新ロジックで防止済み）。
