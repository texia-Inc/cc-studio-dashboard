# cc-studio-dashboard

Web dashboard for [cc-studio](https://github.com/texia-Inc/cc-studio) — the indie-dev virtual studio plugin for Claude Code.

ブラウザで自分のスタジオを俯瞰したり、GitHubやローカルのリポジトリを**捜索して一括インポート**できます。

## できること

### Portfolio タブ
- 登録されているすべてのアプリを一覧表示
- 状態（developing / operating / maintenance / sunset）、最終更新日
- issue / idea / feedback の未対応カウント
- 最新リリース
- リポジトリ・本番URLへのリンク
- スタジオマネージャーのTODO状況

### Scan & Import タブ
- **GitHubから取得**: `gh repo list` を実行して全リポジトリを一覧
- **ローカルフォルダをスキャン**: 指定パス配下の `.git` を持つディレクトリを発見
- 候補をテーブル表示、チェックボックスで多選択
- 状態とアプリタイプをその場で編集
- 「選択中をインポート」で `.studio/[app-name]/` を一括生成

スキャン結果から、最終commitに基づいてアプリ状態を自動推測します。

## インストール

```bash
npx cc-studio-dashboard
```

または:

```bash
npm install -g cc-studio-dashboard
cc-studio-dashboard
```

## 使い方

`.studio/` が存在するディレクトリ（または上位ディレクトリ）で実行:

```bash
cd ~/my-project   # .studio/ がある場所
npx cc-studio-dashboard
```

ブラウザが自動で `http://localhost:3940` を開きます。

`.studio/` がまだない場合は、Scan & Import タブで既存リポジトリをスキャンして取り込めます（ただしインポートには `.studio/` が必要なので、先に Claude Code で `/studio` を実行してください）。

### オプション

```
cc-studio-dashboard [options]

  -p, --port <number>  ポート番号（デフォルト: 3940）
  -d, --dir <path>     .studio/ を探すディレクトリ（デフォルト: cwd）
  --no-open            ブラウザを自動で開かない
  -h, --help           ヘルプ
  -v, --version        バージョン
```

## 必要なもの

- Node.js 18+
- `gh` CLI（GitHubスキャン機能を使う場合のみ。認証済みであること）
- Claude Code で `cc-studio` プラグインで `.studio/` を作成済み

## アーキテクチャ

- **CLI** (`bin/cli.js`) — Express サーバを起動、ブラウザを開く
- **Server** (`server/`)
  - `server.js` — Express ルーティング、SSE による即時反映
  - `scanner.js` — `.studio/` を走査して構造化データに
  - `parser.js` — Markdown + フロントマター解析
  - `repo-scanner.js` — `gh repo list` & ローカルファイルシステム捜索
  - `importer.js` — 選択リポジトリから `.studio/[app]/` を生成
  - `watcher.js` — chokidar によるファイル変化監視
- **Frontend** (`src/`)
  - React 19 + Vite ビルド
  - Portfolio タブ + Scan & Import タブ

## 関連プロジェクト

- [cc-studio](https://github.com/texia-Inc/cc-studio) — このダッシュボードと組になる Claude Code プラグイン
- [cc-concierge](https://github.com/texia-Inc/cc-concierge) — 中小企業社長向けの姉妹プラグイン
- [cc-company](https://github.com/Shin-sibainu/cc-company) — 元祖となった汎用プラグイン

## ライセンス

MIT
