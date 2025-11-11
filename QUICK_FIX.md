# スプレッドシートIDの設定（緊急対応）

## 問題
エラー: `スプレッドシートの取得に失敗しました。ID: YOUR_SPREADSHEET_ID_HERE`

## 解決方法（2つの選択肢）

### 方法1: スクリプトプロパティで設定（推奨）

1. [GASエディタ](https://script.google.com/d/1OZNbk3v9kgRPDPvsLlaShtG1DhCfMCYdtpnXaRqbX1nqtKS_11ETpPQ_/edit) を開く
2. 左側のメニューから「プロジェクトの設定」（歯車アイコン）をクリック
3. 「スクリプト プロパティ」セクションまでスクロール
4. 「スクリプト プロパティを追加」をクリック
5. 以下のプロパティを追加：
   - **プロパティ**: `SPREADSHEET_ID`
   - **値**: `1mB9nhSma1jiUOhjQpN2Ae9Ib8unc_Ixq6WAEY3geydU`
6. 「保存」をクリック

### 方法2: コードに直接設定（一時的）

GASエディタで `Code.gs` を開き、`getSpreadsheetId()` 関数を以下のように一時的に変更：

```javascript
function getSpreadsheetId() {
  // 一時的に直接IDを返す（後でスクリプトプロパティに移行）
  return '1mB9nhSma1jiUOhjQpN2Ae9Ib8unc_Ixq6WAEY3geydU';
}
```

その後、`clasp push` と `clasp deploy` を実行。

## 推奨
方法1（スクリプトプロパティ）を推奨します。セキュリティ上安全で、コードを変更する必要がありません。

