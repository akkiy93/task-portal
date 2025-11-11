# イシュー作成ガイド

フィードバックに基づいて、以下の3つのイシューを作成する必要があります。

## 作成済みのイシュー

- ✅ Issue #2: Feature: Convert health record section to daily report entry

## 作成待ちのイシュー

### Issue #1: バグ修正 - タスク追加・編集ボタンの二重送信問題

**タイトル**: `Bug: Double submission issue with task add/edit buttons`

**本文**: `issue1_body.md` を参照

**ラベル**: `bug`

**作成方法**:
```bash
gh issue create --title "Bug: Double submission issue with task add/edit buttons" --body-file issue1_body.md --label bug
```

または、GitHubのWeb UIから:
1. https://github.com/akkiy93/task-portal/issues/new を開く
2. タイトルと本文を `issue1_body.md` からコピー
3. ラベル `bug` を追加

---

### Issue #3: UI改善 - ヘッダー部分の機能追加

**タイトル**: `Enhancement: Improve header section with real-time clock and daily goals`

**本文**: `issue2_body.md` を参照

**ラベル**: `enhancement`

**作成方法**:
```bash
gh issue create --title "Enhancement: Improve header section with real-time clock and daily goals" --body-file issue2_body.md --label enhancement
```

または、GitHubのWeb UIから:
1. https://github.com/akkiy93/task-portal/issues/new を開く
2. タイトルと本文を `issue2_body.md` からコピー
3. ラベル `enhancement` を追加

---

## イシュー一覧

詳細は `ISSUES.md` を参照してください。

