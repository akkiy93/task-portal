# Gitコミットメッセージの文字化け対策ガイド

## 問題

Windows環境でgitのコミットメッセージが文字化けする問題が発生しています。

## 原因

- PowerShellのコードページが932（Shift-JIS）になっている
- gitのエンコーディング設定が不適切

## 対策

### 1. Git設定の確認・設定

以下のコマンドで設定を確認・設定してください：

```powershell
# 既に設定済み
git config --global core.quotepath false
git config --global i18n.commitencoding utf-8
git config --global i18n.logoutputencoding utf-8
```

### 2. コミットメッセージをファイルから読み込む方法（推奨）

文字化けを防ぐため、コミットメッセージをUTF-8エンコードされたファイルから読み込む方法を使用してください。

#### 手順

1. **コミットメッセージファイルを作成**
   - ファイル名：`commit_msg.txt`（任意の名前でOK）
   - エンコーディング：**UTF-8**（重要！）
   - 内容：コミットメッセージ

2. **コミット時にファイルを指定**
   ```powershell
   git commit -F commit_msg.txt
   ```

#### 例

```powershell
# 1. コミットメッセージファイルを作成（UTF-8で保存）
@"
Fix: 締切日の警告スタイル（枠線）を削除
"@ | Out-File -FilePath commit_msg.txt -Encoding UTF8

# 2. コミット
git add .
git commit -F commit_msg.txt

# 3. ファイルを削除（任意）
Remove-Item commit_msg.txt
```

### 3. PowerShellのエンコーディングを一時的に変更

PowerShellセッションごとにUTF-8に変更：

```powershell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001
```

### 4. 永続的な設定（PowerShellプロファイル）

PowerShellプロファイルに以下を追加すると、毎回自動的にUTF-8に設定されます：

```powershell
# プロファイルのパスを確認
$PROFILE

# プロファイルを編集
notepad $PROFILE

# 以下を追加
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
```

## 確認方法

設定が正しく適用されているか確認：

```powershell
# Git設定の確認
git config --global --get i18n.commitencoding
git config --global --get i18n.logoutputencoding
git config --global --get core.quotepath

# コードページの確認
chcp
```

## 注意事項

- コミットメッセージファイルは必ず**UTF-8**で保存してください
- VS Codeやメモ帳++など、UTF-8を明示的に指定できるエディタを使用することを推奨します
- `.gitignore`に`commit_msg*.txt`を追加して、コミットメッセージファイルをリポジトリに含めないようにしてください

