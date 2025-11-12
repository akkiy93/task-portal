# UI改善: カレンダー予定の表示改善と非表示機能

## 概要
カレンダー予定をより見やすく、使いやすくするため、以下の改善を実施します。

## 改善内容

### 1. 今日の予定をわかりやすく表示（色と大きさで強調）
- **目的**: 今日の予定を視覚的に強調して、優先的に確認できるようにする
- **実装内容**:
  - **今日の予定（強調）**:
    - 背景: グラデーション（紫系）
    - 文字色: 白
    - フォントサイズ: 1.1rem（大きめ）
    - パディング: 15px（大きめ）
    - ボーダー: 左側5px、白色
    - 影: `box-shadow`で強調
    - スケール: `transform: scale(1.02)`
  - **今週の予定（通常）**:
    - 背景: 薄い青（`#f0f4ff`）
    - フォントサイズ: 0.95rem
    - パディング: 12px
    - ボーダー: 左側3px、紫
  - **来週以降の予定（弱）**:
    - 背景: 薄いグレー（`#f8f9fa`）
    - フォントサイズ: 0.85rem（小さめ）
    - パディング: 10px
    - ボーダー: 左側2px、グレー
    - 透明度: `opacity: 0.7`

### 2. 不要な予定を非表示にして、計算からも除外
- **目的**: 不要な予定（「お米」「白菜」など）を非表示にし、労働負荷計算からも除外する
- **実装内容**:
  - 各予定に「非表示」ボタンを追加
  - ボタンクリックで非表示リストに追加
  - イベントIDで識別（タイトルではなく、カレンダーイベントの固有IDを使用）
  - スクリプトプロパティにJSON配列として保存
  - 非表示リストに含まれる予定は表示から除外
  - 労働負荷計算（`getWeeklyWorkload()`）からも除外

## 技術的な実装

### バックエンド（Code.gs）

#### 1. イベントIDを取得して返す
```javascript
const eventsData = events.map(event => {
  return {
    id: event.getId(),  // イベントIDを追加
    title: event.getTitle(),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    duration: duration,
    location: event.getLocation() || ''
  };
});
```

#### 2. 非表示リストの管理
- `hideCalendarEvent(eventId)`: 非表示リストにイベントIDを追加
- `getHiddenCalendarEvents()`: 非表示リスト（IDの配列）を取得
- スクリプトプロパティ `HIDDEN_CALENDAR_EVENTS` にJSON配列として保存

#### 3. フィルタリング
- `getCalendarEvents()`: 非表示リストに含まれるイベントIDを除外
- `getWeeklyWorkload()`: 非表示予定を労働時間計算から除外

### フロントエンド（index.html）

#### 1. 日付判定ロジック
```javascript
const today = new Date();
today.setHours(0, 0, 0, 0);

const endOfWeek = new Date(today);
endOfWeek.setDate(today.getDate() + (7 - today.getDay()));

const eventDate = new Date(event.startTime);
eventDate.setHours(0, 0, 0, 0);

let dateClass = '';
if (eventDate.getTime() === today.getTime()) {
  dateClass = 'today';
} else if (eventDate <= endOfWeek) {
  dateClass = 'this-week';
} else {
  dateClass = 'future-week';
}
```

#### 2. CSSスタイルの追加
- `.calendar-event.today`: 今日の予定用スタイル
- `.calendar-event.this-week`: 今週の予定用スタイル
- `.calendar-event.future-week`: 来週以降の予定用スタイル
- `.calendar-event-hide-btn`: 非表示ボタン用スタイル

#### 3. 非表示ボタンの実装
- 各予定に「✕ 非表示」ボタンを追加
- クリックで`hideCalendarEvent(eventId)`を呼び出し
- 非表示後、予定一覧を再読み込み

## データ構造

### スクリプトプロパティ
- **キー**: `HIDDEN_CALENDAR_EVENTS`
- **値**: JSON配列の文字列（例: `["event_id_1", "event_id_2"]`）
- **管理**: 一度作成すれば、後は更新のみ（毎回新規作成しない）

### イベントデータ
```javascript
{
  id: "カレンダーイベントの固有ID",
  title: "予定タイトル",
  startTime: "開始時刻（ISO形式）",
  endTime: "終了時刻（ISO形式）",
  duration: 時間数,
  location: "場所"
}
```

## UI/UXの考慮事項

### デザイン
- 今日の予定は目立つように強調
- 来週以降の予定は控えめに表示
- 非表示ボタンは小さめで、ホバー時に強調

### 操作性
- 非表示ボタンは各予定の右側に配置
- クリック後、即座に表示から削除
- エラーハンドリングを適切に実装

## 実装の優先順位
1. **高**: イベントIDの取得と返却
2. **高**: 非表示機能の実装（スクリプトプロパティ、フィルタリング）
3. **高**: 今日の予定の強調表示
4. **中**: 今週/来週以降のスタイル分け
5. **中**: 労働負荷計算からの除外

## メリット
- **イベントIDで識別**: タイトルが変更されても正しく識別できる
- **一意性**: 同名の予定でも区別できる
- **視覚的な優先順位**: 今日の予定が一目でわかる
- **不要な予定の除外**: 労働負荷計算が正確になる

