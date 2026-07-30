# 復旧SQLの検証

`supabase/recover_one_shot.sql` は本番のセーブを直接書き換えるので、変更したら
必ずローカルの PostgreSQL で通してから使うこと。

```bash
# 1. ローカルに空のクラスタを作って起動（root では initdb が動かないので postgres ユーザーで）
D=/var/tmp/pgverify
mkdir -p $D && chown postgres:postgres $D && chmod 700 $D
su postgres -c "/usr/lib/postgresql/16/bin/initdb -D $D -A trust -U postgres"
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D $D -o '-k /tmp -p 5434 -c listen_addresses=' -l $D/log start"

# 2. スイートを実行（schema.sql のパスは suite 内で参照している）
cp supabase/test/schema.sql /var/tmp/pgverify2/schema.sql
bash supabase/test/recover_one_shot.suite.sh
```

11ケース30アサーション（通常の復旧／冪等／バックアップ無し／本体行なし／
いまのほうが多い／他人のデータを巻き込まない／壊れた行があっても落ちない／
savedAt が無い古い行／存在しない user_id）。すべて PASS で使用可。
