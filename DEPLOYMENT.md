# デプロイ完了！

## ✅ 完了した作業

1. Claspのインストールとログイン
2. GASプロジェクトの作成
3. コードのプッシュ
4. デプロイ

## 📋 次のステップ

### 1. スプレッドシートの作成と紐付け

**重要**: このアプリはスプレッドシートと連携する必要があります。

1. [Google スプレッドシート](https://sheets.google.com/) で新しいスプレッドシートを作成
2. スプレッドシート名を「タスク管理ポータル」などに変更
3. スプレッドシートのURLからIDを取得（`https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit` の `[SPREADSHEET_ID]` 部分）

### 2. スプレッドシートIDの設定

GASエディタで `Code.gs` を開き、`getSpreadsheet()` 関数を以下のように修正：

```javascript
function getSpreadsheet() {
  const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'; // ここにスプレッドシートIDを設定
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}
```

または、スプレッドシートから直接GASを開く方法：
1. スプレッドシートのメニューから「拡張機能」→「Apps Script」を選択
2. 既存のGASプロジェクト（scriptId: `1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_`）にコードをコピー

### 3. 初期化の実行

1. [GASエディタ](https://script.google.com/d/1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_/edit) を開く
2. 「実行」→「initializeSpreadsheet」を選択
3. 初回実行時は承認が必要です：
   - 「権限を確認」をクリック
   - Googleアカウントを選択
   - 「詳細」→「タスク管理ポータル（安全ではないページ）に移動」をクリック
   - 「許可」をクリック

### 4. Webアプリとして公開

1. GASエディタで「デプロイ」→「新しいデプロイ」をクリック
2. 種類の選択で「ウェブアプリ」を選択
3. 以下の設定：
   - **説明**: 任意（例: "Webアプリ公開"）
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 全員（または自分）
4. 「デプロイ」をクリック
5. 表示されたURLをコピーしてブラウザで開く

## 🔗 リンク

- **GASエディタ**: https://script.google.com/d/1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_/edit
- **デプロイID**: `AKfycbw8M8_lsspP-TgogdSNZoeZaxnBR2tdlg6taDckEkN46m9hfWQ6q60UVDhD88SaPzsb`

## 📝 注意事項

- スプレッドシートとの紐付けが完了するまで、アプリは正常に動作しません
- カレンダー機能を使用するには、Googleカレンダーのデフォルトカレンダーが設定されている必要があります
- Webアプリとして公開する際は、「アクセスできるユーザー」を適切に設定してください

## 🔄 今後の更新方法

コードを更新したら、以下のコマンドで再デプロイできます：

```bash
clasp push
clasp deploy
```

または、新しいバージョンとしてデプロイ：

```bash
clasp deploy --description "更新内容の説明"
```

