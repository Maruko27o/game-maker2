#!/bin/bash
# 復旧SQLの検証スイート。各ケースを独立したDBで実行し、期待どおりか確かめる。
export PGHOST=/tmp PGPORT=5434 PGUSER=postgres
SQL=/workspace/game-maker2/supabase/recover_one_shot.sql
UID_T=afbc7ae5-fc25-42e1-b8f1-2332af5c6fb9
pass=0; fail=0

mk() { # $1=dbname
  psql -q -d postgres -c "drop database if exists $1" -c "create database $1" >/dev/null
  psql -q -d $1 -f /var/tmp/pgverify2/schema.sql
}
save() { # $1=db $2=uid $3=horses $4=coins $5=rev $6=savedAt_ms
  psql -q -d $1 -c "insert into public.saves (user_id,data,rev,save_version,updated_by) values ('$2',
    jsonb_build_object('version',6,'owned','{}'::jsonb,'horses',
      coalesce((select jsonb_agg('h'||i) from generate_series(1,$3) i),'[]'::jsonb),
      'coins',$4,'trophies','[]'::jsonb,'badges','[]'::jsonb,'savedAt',$6::bigint), $5, 6, 'web')"
}
bak() { # $1=db $2=uid $3=horses $4=coins $5=rev $6=hours_ago
  psql -q -d $1 -c "insert into public.saves_backup (user_id,data,rev,backed_up_at) values ('$2',
    jsonb_build_object('version',6,'owned',jsonb_build_object('body_bay',1),'horses',
      coalesce((select jsonb_agg('h'||i) from generate_series(1,$3) i),'[]'::jsonb),
      'coins',$4,'trophies','[]'::jsonb,'badges','[]'::jsonb,'savedAt',1785400000000::bigint), $5, now() - interval '$6 hours')"
}
run() { psql -At -d $1 -f $SQL 2>&1; }
check() { # $1=label $2=actual $3=expected
  if [ "$2" == "$3" ]; then pass=$((pass+1)); echo "  OK   $1"
  else fail=$((fail+1)); echo "  FAIL $1 : expected [$3] got [$2]"; fi
}

echo "== 1. 通常の復旧（27頭のバックアップが2件） =="
mk c1; save c1 $UID_T 0 40 57 1785450000000
bak c1 $UID_T 6 81804 40 100; bak c1 $UID_T 27 616696 55 2; bak c1 $UID_T 27 616696 56 1
out=$(run c1); check "1行返る" "$(echo "$out" | wc -l)" "1"
check "ウマ27頭" "$(echo "$out" | cut -d'|' -f4)" "27"
check "コイン616696" "$(echo "$out" | cut -d'|' -f5)" "616696"
check "退避1件" "$(echo "$out" | cut -d'|' -f3)" "1"
check "本体が27頭" "$(psql -At -d c1 -c "select jsonb_array_length(data->'horses') from public.saves")" "27"
check "revが+1" "$(psql -At -d c1 -c "select rev from public.saves")" "58"
check "savedAtが5分以内" "$(psql -At -d c1 -c "select abs(extract(epoch from now()) - (data->>'savedAt')::bigint/1000.0) < 300 from public.saves")" "t"

echo "== 2. 2回目の実行（冪等） =="
out=$(run c1); check "0行" "$(echo -n "$out" | wc -l)" "0"
check "本体は無傷" "$(psql -At -d c1 -c "select jsonb_array_length(data->'horses') from public.saves")" "27"
check "退避行が増えない" "$(psql -At -d c1 -c "select count(*) from public.saves_backup")" "4"

echo "== 3. バックアップが1件も無い =="
mk c2; save c2 $UID_T 0 40 57 1785450000000
out=$(run c2); check "0行" "$(echo -n "$out" | wc -l)" "0"
check "本体そのまま" "$(psql -At -d c2 -c "select rev||'/'||jsonb_array_length(data->'horses') from public.saves")" "57/0"

echo "== 4. 本体の行がそもそも無い =="
mk c3; bak c3 $UID_T 27 616696 55 2
out=$(run c3); check "ウマ27頭" "$(echo "$out" | cut -d'|' -f4)" "27"
check "退避0件" "$(echo "$out" | cut -d'|' -f3)" "0"
check "行が作られる rev=1" "$(psql -At -d c3 -c "select rev from public.saves")" "1"
check "save_version=6" "$(psql -At -d c3 -c "select save_version from public.saves")" "6"

echo "== 5. いまのほうが中身が多い（誤爆しないか） =="
mk c4; save c4 $UID_T 30 999999 57 1785450000000; bak c4 $UID_T 27 616696 55 2
out=$(run c4); check "0行" "$(echo -n "$out" | wc -l)" "0"
check "本体そのまま30頭" "$(psql -At -d c4 -c "select jsonb_array_length(data->'horses')||'/'||rev from public.saves")" "30/57"

echo "== 6. 他人のデータを巻き込まない =="
mk c5
psql -q -d c5 -c "insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','o@x')"
save c5 $UID_T 0 40 57 1785450000000; bak c5 $UID_T 27 616696 55 2
save c5 11111111-1111-1111-1111-111111111111 5 5000 9 1785450000000
bak c5 11111111-1111-1111-1111-111111111111 99 999999 8 3
out=$(run c5); check "対象は27頭" "$(echo "$out" | cut -d'|' -f4)" "27"
check "他人は5頭のまま" "$(psql -At -d c5 -c "select jsonb_array_length(data->'horses') from public.saves where user_id='11111111-1111-1111-1111-111111111111'")" "5"
check "他人のrevも据え置き" "$(psql -At -d c5 -c "select rev from public.saves where user_id='11111111-1111-1111-1111-111111111111'")" "9"
check "他人の退避は増えない" "$(psql -At -d c5 -c "select count(*) from public.saves_backup where user_id='11111111-1111-1111-1111-111111111111'")" "1"

echo "== 7. 他人の壊れた行があっても落ちない =="
mk c6
psql -q -d c6 -c "insert into auth.users (id,email) values ('11111111-1111-1111-1111-111111111111','o@x')"
save c6 $UID_T 0 40 57 1785450000000; bak c6 $UID_T 27 616696 55 2
psql -q -d c6 -c "insert into public.saves_backup (user_id,data,rev) values ('11111111-1111-1111-1111-111111111111', jsonb_build_object('version',6,'horses','こわれた','coins','abc'), 3)"
out=$(run c6); check "エラーにならず27頭" "$(echo "$out" | cut -d'|' -f4)" "27"

echo "== 8. 対象本人の壊れた行は除外して、まともな行から戻す =="
mk c7; save c7 $UID_T 0 40 57 1785450000000
psql -q -d c7 -c "insert into public.saves_backup (user_id,data,rev) values ('$UID_T', jsonb_build_object('version',6,'horses','こわれた','coins','abc'), 51)"
bak c7 $UID_T 27 616696 55 2
out=$(run c7); check "27頭に復旧" "$(echo "$out" | cut -d'|' -f4)" "27"

echo "== 9. 壊れた行しか無い → 何もしない（0行・本体無傷） =="
mk c8; save c8 $UID_T 0 40 57 1785450000000
psql -q -d c8 -c "insert into public.saves_backup (user_id,data,rev) values ('$UID_T', jsonb_build_object('version',6,'horses','こわれた'), 51)"
out=$(run c8); check "0行" "$(echo -n "$out" | wc -l)" "0"
check "本体そのまま" "$(psql -At -d c8 -c "select rev||'/'||jsonb_array_length(data->'horses') from public.saves")" "57/0"

echo "== 10. savedAt キーが無い古いバックアップ =="
mk c9; save c9 $UID_T 0 40 57 1785450000000
psql -q -d c9 -c "insert into public.saves_backup (user_id,data,rev) values ('$UID_T', jsonb_build_object('version',6,'owned','{}'::jsonb,'horses',jsonb_build_array('a','b'),'coins',777), 50)"
out=$(run c9); check "2頭に復旧" "$(echo "$out" | cut -d'|' -f4)" "2"
check "savedAtが補われる" "$(psql -At -d c9 -c "select (data->>'savedAt') is not null from public.saves")" "t"

echo "== 11. 存在しない user_id =="
mk c10; save c10 $UID_T 0 40 57 1785450000000; bak c10 $UID_T 27 616696 55 2
sed "s/$UID_T/99999999-9999-9999-9999-999999999999/" $SQL > /var/tmp/pgverify2/nouser.sql
out=$(psql -At -d c10 -f /var/tmp/pgverify2/nouser.sql 2>&1)
check "0行・エラーなし" "$(echo -n "$out" | wc -l)" "0"
check "対象外の本体は無傷" "$(psql -At -d c10 -c "select rev from public.saves")" "57"

echo
echo "===== 合計: PASS=$pass FAIL=$fail ====="
[ $fail -eq 0 ]
