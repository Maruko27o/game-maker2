# ウマあつめ 🐴

草むらをタップしてウマからパーツを集め、自分だけのウマを作ってコレクションする、
スマホ縦画面ファーストのブラウザ着せ替えゲーム。

仕様の詳細は [`CLAUDE.md`](./CLAUDE.md) を参照。

## 特徴

- 🌿 **草むら** … 1日2回（0:00 / 12:00）ウマが出現。タップしてパーツを抽選で入手
- 🎨 **つくる** … 集めた色（からだ・たてがみ・ひづめ）と装飾（頭・顔・背中・しっぽ）でウマを作成（最大10体）
- 📖 **図鑑** … 全48パーツのコレクション。未所持はシルエット表示、達成率つき
- 🐴 **マイウマ** … 作ったウマの一覧・名前変更・削除
- ⚡ サーバー不要・ローカル保存のみ。ウマの見た目は **SVGレイヤー合成** でリアルタイム描画

## 技術構成

React 18 + TypeScript / Vite / Zustand / React Router / CSS Modules / Vitest

## 開発

```bash
npm install       # 依存インストール
npm run dev       # 開発サーバー
npm test          # 抽選ロジック・リセット判定のテスト
npm run build     # 型チェック + 本番ビルド（dist/）
npm run preview   # ビルド結果のプレビュー
```

## 公開（GitHub Pages）

`main` に push すると `.github/workflows/deploy.yml` が自動でビルドし、GitHub Pages へ公開します。

初回のみ設定が必要です:

1. GitHub リポジトリの **Settings → Pages** を開く
2. **Build and deployment → Source** を **GitHub Actions** に設定

以後、公開URL（`https://<user>.github.io/game-maker2/`）を開くだけで遊べます。

## アカウント連携（メールログイン・全端末で同期）

既定では **この端末だけ**（localStorage）に保存されます。メールでログインして
**どの端末でも同じデータ**を使えるようにするには、無料の [Supabase](https://supabase.com)
を接続します（設定は初回のみ）。

1. **プロジェクト作成** … Supabase で新規プロジェクトを作成
2. **テーブル作成** … ダッシュボードの **SQL Editor** で
   [`supabase/setup.sql`](./supabase/setup.sql) を貼り付けて Run
3. **メール認証を有効化** … **Authentication → Providers → Email** を ON。
   すぐログインできるようにするには **「Confirm email」を OFF** にする
   （メール確認をスキップ。確認メールを使いたい場合は ON のままでもOK）
4. **キーを設定** … **Project Settings → API** の
   - **Project URL** を `src/supabaseConfig.ts` の `SUPABASE_URL` に
   - **anon public** キーを `SUPABASE_ANON_KEY` に貼り付け
   （どちらも公開して安全な値。データは行レベルセキュリティ(RLS)で保護されます）
5. **コミット** … `main` に反映すると自動でデプロイされ、アプリ右上の
   ☁️ ボタンからログイン／新規登録できるようになります
6. **プレイヤーID（連番 id0000001〜）を使う場合**（任意）…
   `supabase/profiles.sql` の内容を Supabase の SQL Editor に貼り付けて一度だけ実行。
   登録済み・新規どちらのアカウントも、初回ログイン時に自動で番号が振られます。
   未実行でもアプリは通常どおり動作します（ID表示だけ出ません）。

> 同期方式：**ログインしたら常にアカウントのクラウドデータを優先**して読み込みます
> （その端末のローカルでクラウドを上書きしません）。同じアカウントの複数端末どうしの
> 変更は last-write-wins（最後に保存した方が優先）で同期されます。

## ディレクトリ

```
assets/horse_base.svg   ベースのウマ（CSS変数で色制御）
src/data/parts.json     全48パーツの定義（唯一の正）
src/components/         HorseView（SVG合成の心臓部）ほか
src/logic/              gacha.ts（抽選）/ reset.ts（出現枠のリセット判定）+ テスト
src/pages/              草むら・図鑑・つくる・マイウマ・プレースホルダー
src/store.ts            localStorage 永続化 + Zustand ストア
```
