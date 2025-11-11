# 文字化け問題の解決方法

## 問題
PowerShellで日本語を含むコマンドを実行する際に文字化けが発生しています。

## 原因
Windows PowerShellのデフォルト文字コードが932（Shift-JIS）になっているため。

## 解決方法

### 一時的な解決（現在のセッションのみ）
```powershell
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001
```

### 永続的な解決（推奨）

#### 方法1: PowerShellプロファイルに設定を追加

1. PowerShellで以下を実行してプロファイルのパスを確認：
```powershell
$PROFILE
```

2. プロファイルファイルを開く（存在しない場合は作成）：
```powershell
notepad $PROFILE
```

3. 以下を追加：
```powershell
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null
```

4. プロファイルを保存して、PowerShellを再起動

#### 方法2: システムのロケール設定を変更

1. Windowsの設定 → 時刻と言語 → 言語と地域
2. 管理用の言語設定 → システムロケールの変更
3. 「Beta: 世界言語サポートにUnicode UTF-8を使用する」にチェック
4. 再起動

## ファイルの文字エンコーディング確認

VS Codeやエディタでファイルを開き、右下の文字エンコーディング表示を確認してください。
必要に応じて「UTF-8」に変更してください。

