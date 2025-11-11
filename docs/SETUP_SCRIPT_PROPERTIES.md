# スクリプトプロパティの設定方法

GASでは、機密情報（スプレッドシートIDなど）をスクリプトプロパティに保存することを推奨します。

## スクリプトプロパティの設定手順

### 方法1: GASエディタから設定（推奨）

1. [GASエディタ](https://script.google.com/d/YOUR_SCRIPT_ID/edit) を開く
2. 左側のメニューから「プロジェクトの設定」（歯車アイコン）をクリック
3. 「スクリプト プロパティ」セクションまでスクロール
4. 「スクリプト プロパティを追加」をクリック
5. 以下のプロパティを追加：
   - **プロパティ**: `SPREADSHEET_ID`
   - **値**: スプレッドシートのID（例: `YOUR_SPREADSHEET_ID_HERE`）
6. 「保存」をクリック

### 方法2: コードから設定（初回のみ）

GASエディタで以下の関数を実行すると、スクリプトプロパティを設定できます：

```javascript
function setSpreadsheetId() {
  const scriptProperties = PropertiesService.getScriptProperties();
  scriptProperties.setProperty('SPREADSHEET_ID', 'YOUR_SPREADSHEET_ID_HERE');
  Logger.log('SPREADSHEET_ID has been set');
}
```

1. GASエディタで上記の関数を追加
2. 「実行」→「setSpreadsheetId」を選択
3. 「実行」ボタンをクリック
4. 実行後、関数を削除することを推奨（セキュリティのため）

## スプレッドシートIDの取得方法

スプレッドシートのURLからIDを取得できます：

```
https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
                                    ↑ この部分がID
```

例：
- URL: `https://docs.google.com/spreadsheets/d/YOUR_SPREADSHEET_ID_HERE/edit`
- ID: `YOUR_SPREADSHEET_ID_HERE`

## メリット

- コードに機密情報を直接書く必要がない
- GitHubなどに公開しても安全
- 複数の環境（開発/本番）で異なるIDを使い分けられる
- コードを変更せずに設定を変更できる

