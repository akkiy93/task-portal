# セットアップガイド

## ✅ 完了した作業

- ✅ Claspのインストールとログイン
- ✅ GASプロジェクトの作成
- ✅ コードのプッシュ
- ✅ スプレッドシートIDの設定（`1mB9nhSma1jiUOhjQpN2Ae9Ib8unc_Ixq6WAEY3geydU`）

## 📋 次のステップ（手動で実行）

### 1. スプレッドシートの初期化

1. [GASエディタ](https://script.google.com/d/1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_/edit) を開く
2. 上部の関数選択ドロップダウンから「initializeSpreadsheet」を選択
3. 「実行」ボタン（▶）をクリック
4. 初回実行時は承認が必要です：
   - 「権限を確認」をクリック
   - Googleアカウントを選択（`ariibu03@gmail.com`）
   - 「詳細」→「タスク管理ポータル（安全ではないページ）に移動」をクリック
   - 「許可」をクリック
5. 実行が成功すると、スプレッドシートに「タスク」シートが作成されます

### 2. Webアプリとして公開

1. GASエディタで「デプロイ」→「新しいデプロイ」をクリック
2. 歯車アイコン（⚙️）をクリックして「種類の選択」を開く
3. 「ウェブアプリ」を選択
4. 以下の設定を行います：
   - **説明**: 任意（例: "タスク管理ポータル - Webアプリ"）
   - **次のユーザーとして実行**: 自分
   - **アクセスできるユーザー**: 
     - 自分だけが使用する場合: 「自分」を選択
     - 他の人にも共有する場合: 「全員」を選択
5. 「デプロイ」をクリック
6. 表示されたURLをコピー（例: `https://script.google.com/macros/s/.../exec`）
7. ブラウザでURLを開いて動作確認

## 🔗 リンク

- **GASエディタ**: https://script.google.com/d/1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_/edit
- **スプレッドシート**: https://docs.google.com/spreadsheets/d/1mB9nhSma1jiUOhjQpN2Ae9Ib8unc_Ixq6WAEY3geydU/edit
- **デプロイID**: `AKfycbw8M8_lsspP-TgogdSNZoeZaxnBR2tdlg6taDckEkN46m9hfWQ6q60UVDhD88SaPzsb`

## 🧪 動作確認

Webアプリを開いたら、以下を確認してください：

1. **タスク一覧**: 空の状態で表示される（まだタスクがないため）
2. **労働負荷**: タスク時間0時間、会議時間はGoogleカレンダーから取得
3. **タスク追加**: フォームからタスクを追加できる
4. **カレンダー**: 今週の会議予定が表示される（Googleカレンダーに予定がある場合）

## 🔄 今後の更新方法

コードを更新したら、以下のコマンドで再デプロイできます：

```bash
# コードをプッシュ
clasp push

# 新しいバージョンとしてデプロイ
clasp deploy --description "更新内容の説明"
```

WebアプリのURLは変更されませんが、新しいバージョンが反映されます。

## ⚠️ 注意事項

- スプレッドシートへの書き込み権限があることを確認してください
- Googleカレンダーのデフォルトカレンダーが設定されている必要があります
- Webアプリとして公開する際は、「アクセスできるユーザー」を適切に設定してください
- 初回実行時は、スプレッドシートとカレンダーへのアクセス権限を許可する必要があります

