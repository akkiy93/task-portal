# イシュー作成ガイド

## 概要

このガイドでは、GitHub Issuesを作成する手順を説明します。日本語のイシューを作成する際は、Markdownファイルを作成してからGitHub CLIでアップロードする方法を使用します。

## 手順

### 1. イシュー内容のMarkdownファイルを作成

`issues/`フォルダ内に、イシュー番号に対応するMarkdownファイルを作成します。

**ファイル名の規則:**
- `issue{番号}_ja.md`
- 例: `issue10_ja.md`, `issue11_ja.md`, `issue12_ja.md`

**エンコーディング:**
- UTF-8で保存してください

**ファイル構造の例:**
```markdown
# イシューのタイトル

## 概要

イシューの概要を記述します。

## 変更内容

### 1. 変更点1
- 詳細1
- 詳細2

## 技術的な実装

### バックエンド（Code.gs）
- 実装内容1
- 実装内容2

### フロントエンド（index.html）
- 実装内容1
- 実装内容2

## 注意事項

- 注意事項1
- 注意事項2
```

### 2. GitHub CLIでイシューを作成

PowerShellで以下のコマンドを実行します：

```powershell
# 方法1: タイトルと本文をファイルから読み込む（推奨・文字化け対策）
$filePath = "issues/issue10_ja.md"
$title = (Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1) -replace '^#\s+', ''
$body = Get-Content -Path $filePath -Encoding UTF8 -Raw
gh issue create --title $title --body $body --label enhancement

# 方法2: --body-fileオプションを使用（タイトルは手動指定）
gh issue create --title "イシューのタイトル" --body-file issues/issue10_ja.md --label enhancement
```

**注意**: 方法1を使用することで、Markdownファイルの最初の行（`# タイトル`）から自動的にタイトルを抽出し、文字化けを防ぐことができます。

**ラベルの種類:**
- `bug` - バグ修正
- `enhancement` - 機能追加・改善
- `documentation` - ドキュメント関連
- `question` - 質問

### 3. イシューの確認

作成されたイシューを確認します：

```powershell
# 最新のイシュー一覧を表示
gh issue list --limit 5

# 特定のイシューを表示
gh issue view {イシュー番号}
```

## 実践例

### 例1: 機能追加イシューの作成

1. `issues/issue13_ja.md`を作成（最初の行に`# 新機能: 〇〇機能の追加`を記述）
2. イシュー内容を記述
3. 以下のコマンドで作成：
   ```powershell
   $filePath = "issues/issue13_ja.md"
   $title = (Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1) -replace '^#\s+', ''
   $body = Get-Content -Path $filePath -Encoding UTF8 -Raw
   gh issue create --title $title --body $body --label enhancement
   ```

### 例2: バグ修正イシューの作成

1. `issues/issue14_ja.md`を作成（最初の行に`# バグ修正: 〇〇の問題`を記述）
2. バグの詳細を記述
3. 以下のコマンドで作成：
   ```powershell
   $filePath = "issues/issue14_ja.md"
   $title = (Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1) -replace '^#\s+', ''
   $body = Get-Content -Path $filePath -Encoding UTF8 -Raw
   gh issue create --title $title --body $body --label bug
   ```

## トラブルシューティング

### 文字化けが発生する場合

PowerShellの文字エンコーディングの問題で文字化けが発生する場合は、以下の方法を試してください：

1. **ファイルを直接読み込む方法:**
   ```powershell
   $body = Get-Content -Path "issues/issue10_ja.md" -Encoding UTF8 -Raw
   gh issue create --title "タイトル" --body $body --label enhancement
   ```

2. **GitHub Web UIを使用:**
   - Markdownファイルの内容をコピー
   - https://github.com/akkiy93/task-portal/issues/new を開く
   - タイトルと本文を貼り付け
   - ラベルを選択して作成

### イシューの編集

既存のイシューを編集する場合：

```powershell
# タイトルと本文を更新
gh issue edit {イシュー番号} --title "新しいタイトル" --body-file issues/issue10_ja.md

# ラベルを追加
gh issue edit {イシュー番号} --add-label "enhancement"

# ラベルを削除
gh issue edit {イシュー番号} --remove-label "bug"
```

## ベストプラクティス

1. **イシューを小さく分割する**
   - 1つのイシューに複数の変更を含めすぎない
   - 関連する変更は別のイシューに分ける

2. **明確なタイトル**
   - イシューの内容が一目で分かるタイトルにする
   - 例: 「機能追加: 〇〇機能」, 「バグ修正: 〇〇の問題」

3. **詳細な説明**
   - 変更内容、技術的な実装、注意事項を明確に記述
   - 関連するイシューへの参照を追加

4. **適切なラベル**
   - イシューの種類に応じて適切なラベルを付ける

## 関連ドキュメント

- **COMMENT_GUIDE.md** - GitHub Issuesへのコメント投稿ガイド
- **WORKFLOW_GUIDE.md** - 開発ワークフローガイド

