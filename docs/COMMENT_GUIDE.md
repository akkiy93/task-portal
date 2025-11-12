# GitHub Issuesへのコメント投稿ガイド

## 概要

Issueにコメントを投稿する際は、ファイルを作成してそのファイルをアップロードする方法を使用します。これにより、日本語のコメントが正常に表示されます。

## 手順

### 1. コメントファイルを作成

プロジェクトルートに一時ファイルとして作成します。

**ファイル名の規則:**
- `issue{番号}_comment{番号}.md`
- 例: `issue8_comment1.md`, `issue8_comment2.md`

**エンコーディング:**
- UTF-8で保存してください
- PowerShellで作成する場合:
  ```powershell
  $content = "コメント内容"; [System.IO.File]::WriteAllText("$PWD\issue8_comment1.md", $content, [System.Text.Encoding]::UTF8)
  ```

### 2. コメント内容を記述

Markdown形式で記述します。

**例:**
```markdown
## コードリファクタリングとデータ読み込み順序の改善を実装しました

### 実装内容

#### 1. コード全体のリファクタリング
- **共通のエラーハンドリング関数を作成**
  - `createErrorResponse()`: エラーレスポンスを統一
  - `createSuccessResponse()`: 成功レスポンスを統一
...
```

### 3. GitHub CLIで投稿

```bash
gh issue comment {イシュー番号} --body-file {ファイル名}.md
```

**例:**
```bash
gh issue comment 8 --body-file issue8_comment1.md
```

### 4. 一時ファイルの削除

投稿後、一時ファイルは削除してください。

- `.gitignore`に設定されているため、Gitにはコミットされません
- 手動で削除するか、スクリプトで自動削除してください

## 注意事項

- ファイルはUTF-8エンコーディングで保存してください
- ファイル名は一時的なものなので、投稿後は削除してください
- 複数のコメントを投稿する場合は、ファイル名の番号を増やしてください（`comment1`, `comment2`, ...）

## トラブルシューティング

### 文字化けが発生する場合

1. ファイルがUTF-8で保存されているか確認
2. PowerShellで作成する場合は、`[System.Text.Encoding]::UTF8`を使用
3. ファイルの内容を確認:
   ```powershell
   Get-Content issue8_comment1.md -Encoding UTF8
   ```

### GitHub CLIでエラーが発生する場合

1. GitHub CLIが正しくインストールされているか確認: `gh --version`
2. 認証が完了しているか確認: `gh auth status`
3. ファイルパスが正しいか確認（相対パスまたは絶対パス）

