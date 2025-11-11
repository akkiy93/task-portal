# タスク管理ポータル

就職活動用のタスク管理と体調管理を可視化するポータルサイト（Google Apps Script版）

## 機能

- ✅ タスクの一覧表示
- ✅ タスクの追加
- ✅ Googleカレンダーからの会議予定取得
- ✅ 週40時間に対するタスク時間の可視化（余力表示）

## セットアップ手順

### 1. Google Apps Scriptプロジェクトの作成

1. [Google Apps Script](https://script.google.com/) にアクセス
2. 「新しいプロジェクト」をクリック
3. プロジェクト名を「タスク管理ポータル」に変更

### 2. ファイルの追加

1. 左側の「ファイル」メニューから「+」をクリック
2. 以下のファイルを作成・編集：

#### `Code.gs`
プロジェクトルートの `Code.gs` の内容をコピー＆ペースト

**重要**: `Code.gs` の `SPREADSHEET_ID` を実際のスプレッドシートIDに置き換えてください。

```javascript
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
```

#### `index.html`
1. 「ファイル」→「+」→「HTML」を選択
2. ファイル名を `index` に設定
3. プロジェクトルートの `index.html` の内容をコピー＆ペースト

#### `appsscript.json`
1. 「表示」→「マニフェスト ファイルを表示」を有効化
2. `appsscript.json` ファイルが表示されるので、プロジェクトルートの内容をコピー＆ペースト

### 3. スプレッドシートの作成とGASの紐付け

**方法1: スプレッドシートからGASを開く（推奨）**

1. [Google スプレッドシート](https://sheets.google.com/) で新しいスプレッドシートを作成
2. スプレッドシート名を「タスク管理ポータル」などに変更
3. スプレッドシートのメニューから「拡張機能」→「Apps Script」を選択
4. これで、そのスプレッドシートに紐付けられたGASプロジェクトが開きます
5. 上記で作成した `Code.gs` と `index.html` の内容をコピー＆ペースト
6. `Code.gs` の `SPREADSHEET_ID` をスプレッドシートのIDに設定

**方法2: 既存のGASプロジェクトからスプレッドシートを指定**

1. [Google スプレッドシート](https://sheets.google.com/) で新しいスプレッドシートを作成
2. スプレッドシートのURLからIDを取得（`https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit` の `[SPREADSHEET_ID]` 部分）
3. GASエディタで `Code.gs` を開き、`SPREADSHEET_ID` を設定

### 4. 初期化の実行

1. GASエディタで「実行」→「initializeSpreadsheet」を選択
2. 初回実行時は承認が必要です：
   - 「権限を確認」をクリック
   - Googleアカウントを選択
   - 「詳細」→「タスク管理ポータル（安全ではないページ）に移動」をクリック
   - 「許可」をクリック

### 5. Webアプリとして公開

1. GASエディタで「デプロイ」→「新しいデプロイ」をクリック
2. 種類の選択で「ウェブアプリ」を選択
3. 以下の設定：
   - **説明**: 任意（例: "初回デプロイ"）
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 全員（または自分）
4. 「デプロイ」をクリック
5. 表示されたURLをコピーしてブラウザで開く

## Claspを使用したデプロイ（オプション）

### Claspのセットアップ

```bash
# Claspのインストール
npm install -g @google/clasp

# ログイン
clasp login

# プロジェクトの作成（既存の場合は不要）
clasp create --type standalone --title "タスク管理ポータル"
```

### コードのプッシュとデプロイ

```bash
# コードをプッシュ
clasp push

# 初回デプロイ
clasp deploy --description "初回デプロイ"

# 既存デプロイの更新
clasp deploy --deploymentId YOUR_DEPLOYMENT_ID --description "更新内容"
```

詳細は [docs/WEBAPP_DEPLOY.md](./docs/WEBAPP_DEPLOY.md) を参照してください。

## 使い方

### タスクの追加

1. 「タスクを追加」セクションで以下を入力：
   - タイトル（必須）
   - 説明（任意）
   - 見積もり時間（必須、時間単位）
   - 優先度（高/中/低）
2. 「タスクを追加」ボタンをクリック

### 労働負荷の確認

- 「今週の労働負荷」セクションで以下を確認：
  - タスク時間の合計
  - 会議時間の合計
  - 合計時間（週40時間に対する使用率）
  - 余力（残り時間）

### カレンダー連携

- Googleカレンダーのデフォルトカレンダーから今週の会議予定を自動取得
- 会議時間は労働負荷の計算に含まれます

## 今後の拡張予定

- [ ] 体調スコアの記録（良い/普通/良くない）
- [ ] タスクの編集・削除機能
- [ ] タスクのステータス変更（未着手→進行中→完了）
- [ ] Slack通知機能
- [ ] 週次レポートの自動送信（上司への共有）

## トラブルシューティング

詳細は [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) を参照してください。

## プロジェクト構成

```
task-portal/
├── Code.gs              # GASバックエンドコード
├── index.html           # フロントエンドUI
├── appsscript.json      # GASマニフェスト
├── README.md            # プロジェクト概要
├── docs/                # ドキュメント
│   ├── README.md        # ドキュメント一覧
│   ├── SETUP_GUIDE.md   # セットアップ手順
│   ├── DEPLOYMENT.md    # デプロイ手順
│   └── ...              # その他のドキュメント
└── issues/              # イシュー関連ファイル
    ├── issue4_ja.md     # Issue #4: UI改善
    ├── issue5_ja.md     # Issue #5: 機能追加
    └── issue6_ja.md     # Issue #6: バグ修正
```

## ライセンス

このプロジェクトは個人利用を目的としています。
