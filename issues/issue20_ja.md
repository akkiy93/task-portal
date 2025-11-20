# Gemini連携による子タスク自動生成機能

## 概要

Gemini 2.5 Flash APIを使用して、親タスクから子タスクを自動生成する機能を実装します。生成された子タスクは下書きとして表示され、ユーザーが微調整してから登録します。

## 変更内容

### 1. Gemini API連携
- Google Apps ScriptからGemini 2.5 Flash APIを呼び出し
- 親タスクのタイトルと説明から子タスクを生成
- 各子タスクの見積もり時間も推測

### 2. 子タスク生成UI
- 親タスクに「子タスクを生成」ボタンを追加
- ボタンクリックでGemini APIを呼び出し
- ローディング表示

### 3. 下書き表示と編集
- 生成された子タスクを親タスクの下に一時的に表示
- インライン編集可能
- 個別削除ボタン
- 「すべて削除」ボタン

### 4. 下書きの登録
- 「すべて登録」ボタンで一括登録
- 登録時に領域を「スタックする」、ステータスを「未着手」に設定

## 技術的な実装

### バックエンド（Code.gs）

#### Gemini API呼び出し関数
```javascript
function generateSubtasksWithGemini(parentTaskTitle, parentTaskDescription) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `親タスクのタイトル: ${parentTaskTitle}
親タスクの説明: ${parentTaskDescription}

この親タスクを適切な子タスクに分解し、各子タスクの見積もり時間（時間単位）を推測してください。
JSON形式で出力してください。

出力形式:
{
  "subtasks": [
    {
      "title": "子タスクのタイトル",
      "description": "子タスクの説明",
      "estimatedHours": 見積もり時間（数値）
    }
  ]
}`;

  const payload = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    const text = result.candidates[0].content.parts[0].text;
    
    // JSONを抽出（コードブロックから）
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
    const subtasks = JSON.parse(jsonText);
    
    return createSuccessResponse('子タスクを生成しました', subtasks);
  } catch (error) {
    Logger.log('Error in generateSubtasksWithGemini: ' + error.toString());
    return createErrorResponse('子タスクの生成に失敗しました: ' + error.toString());
  }
}
```

#### APIキー管理
- Script Propertiesで`GEMINI_API_KEY`を管理
- 設定用の関数を追加（必要に応じて）

### フロントエンド（index.html）

#### 子タスク生成ボタン
- 親タスクに「子タスクを生成」ボタンを追加
- クリックでGemini APIを呼び出し
- ローディング表示

#### 下書き表示
- 親タスクの下に一時的に表示
- 下書きであることを視覚的に区別（背景色など）
- インライン編集可能

#### 下書きの操作
- タイトル、説明、見積もり時間を編集可能
- 個別削除ボタン
- 「すべて削除」ボタン
- 「すべて登録」ボタン

## データ構造

### Gemini APIの出力形式

```json
{
  "subtasks": [
    {
      "title": "領域分け機能の実装",
      "description": "タスクを3つの領域（今すぐやる、スタックする、計画的にする）に分類する機能を実装",
      "estimatedHours": 5
    },
    {
      "title": "親子タスク機能の実装",
      "description": "親タスクと子タスクの階層構造を実装",
      "estimatedHours": 8
    }
  ]
}
```

### 下書きデータの管理
- フロントエンドで一時的に保持（メモリ上）
- 登録時にバックエンドに送信
- 登録前にページを離れた場合は失われる（意図的な設計）

## UI/UXの詳細

### 生成フロー
```
1. 親タスクを表示
2. 「子タスクを生成」ボタンをクリック
3. ローディング表示
4. Gemini APIを呼び出し
5. 下書きとして親タスクの下に表示
   - 編集可能なフィールド
   - 個別削除ボタン
   - 「すべて削除」ボタン
6. ユーザーが微調整
7. 「すべて登録」ボタンで確定
```

### 下書き表示の例
```
┌─ 今すぐやる ─────────────────────────┐
│                                        │
│  ▼ [親タスク] タスク管理ポータルの改修 │
│    [子タスクを生成]                    │
│                                        │
│    ┌─ 下書き（編集可能）────────────┐ │
│    │ [子タスク] 領域分け機能の実装  │ │
│    │ 見積: [5]時間 [削除]          │ │
│    │ [子タスク] 親子タスク機能の実装│ │
│    │ 見積: [8]時間 [削除]          │ │
│    │                                │ │
│    │ [すべて削除] [すべて登録]      │ │
│    └────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

## エラーハンドリング

### API呼び出し失敗時
- エラーメッセージを表示
- リトライボタンを表示
- 手動で子タスクを追加可能

### 生成結果が不適切な場合
- ユーザーが手動で編集可能
- 削除して再生成可能

### APIキー未設定時
- エラーメッセージを表示
- APIキー設定方法を案内

## 注意事項

- Gemini APIの無料枠の制限に注意
- APIキーはScript Propertiesで安全に管理
- 生成された子タスクは必ずユーザーが確認・編集してから登録
- 下書きは一時的なもの（ページを離れると失われる）

## 関連イシュー

- Issue #17: タスクの領域分け機能の実装（前提）
- Issue #18: タスク一覧UIの改善（前提）
- Issue #19: 親子タスク機能の実装（前提）

