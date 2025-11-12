/**
 * タスク管理ポータル - Google Apps Script
 * 
 * バージョン: v67
 * 変更内容: コード全体のリファクタリング（共通処理の抽出、エラーハンドリングの統一、日付処理の共通化、日報操作の共通化）
 * 
 * 機能:
 * - タスクの一覧表示
 * - タスクの追加・編集・削除
 * - タスクのステータス変更
 * - Googleカレンダーからの会議予定取得
 * - 週40時間に対するタスク時間の可視化
 * - 体調スコアの記録と可視化
 */

// ============================================================================
// 定数定義
// ============================================================================

// スプレッドシートの設定
const SHEET_NAME_TASKS = 'タスク';
const SHEET_NAME_CALENDAR = 'カレンダー';
const SHEET_NAME_REPORT = '日報';

// タスクシートの列インデックス（0始まり）
const TASK_COL_ID = 0;
const TASK_COL_TITLE = 1;
const TASK_COL_DESCRIPTION = 2;
const TASK_COL_ESTIMATED_HOURS = 3;
const TASK_COL_PRIORITY = 4;
const TASK_COL_IMPORTANCE = 5;
const TASK_COL_DELIVERABLE = 6;
const TASK_COL_DEADLINE = 7;
const TASK_COL_STATUS = 8;
const TASK_COL_CREATED_AT = 9;
const TASK_COL_UPDATED_AT = 10;
const TASK_COLUMN_COUNT = 11;

// 日報シートの列インデックス（0始まり）
const REPORT_COL_DATE = 0;
const REPORT_COL_GOAL = 1;
const REPORT_COL_ARRIVAL_HEALTH = 2;
const REPORT_COL_DEPARTURE_HEALTH = 3;
const REPORT_COL_COMPLETED_TASK_COUNT = 4;
const REPORT_COL_COMPLETED_TASK_HOURS = 5;
const REPORT_COL_REFLECTION = 6;
const REPORT_COL_TOMORROW_PLAN = 7;
const REPORT_COL_RECORDED_AT = 8;
const REPORT_COLUMN_COUNT = 9;

// ============================================================================
// ユーティリティ関数
// ============================================================================

/**
 * スプレッドシートIDを取得
 * スクリプトプロパティから取得し、設定されていない場合はエラーを返す
 */
function getSpreadsheetId() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  
  if (!spreadsheetId) {
    Logger.log('Error: SPREADSHEET_ID is not set in script properties.');
    throw new Error('スプレッドシートIDがスクリプトプロパティに設定されていません。GASエディタの「プロジェクトの設定」→「スクリプト プロパティ」で設定してください。');
  }
  
  return spreadsheetId;
}

/**
 * アクティブなスプレッドシートを取得
 * Webアプリとして実行される場合は、常にIDで取得します
 */
function getSpreadsheet() {
  try {
    const SPREADSHEET_ID = getSpreadsheetId();
    
    // まず、アクティブなスプレッドシートを試す（開発時のみ有効）
    let ss = null;
    try {
      const activeSs = SpreadsheetApp.getActiveSpreadsheet();
      if (activeSs && activeSs.getId() === SPREADSHEET_ID) {
        ss = activeSs;
        Logger.log('Using active spreadsheet');
      }
    } catch (e) {
      // アクティブなスプレッドシートがない（Webアプリ実行時など）
      Logger.log('No active spreadsheet, will use ID: ' + e.toString());
    }
    
    // アクティブなスプレッドシートが取得できない場合は、IDで取得
    if (!ss) {
      Logger.log('Opening spreadsheet by ID: ' + SPREADSHEET_ID);
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    
    if (!ss) {
      throw new Error('スプレッドシートを開けませんでした（nullが返されました）');
    }
    
    // スプレッドシートが正しく取得できたか確認
    const testId = ss.getId();
    if (testId !== SPREADSHEET_ID) {
      Logger.log('Warning: Spreadsheet ID mismatch. Expected: ' + SPREADSHEET_ID + ', Got: ' + testId);
    }
    
    Logger.log('Spreadsheet opened successfully. ID: ' + testId);
    return ss;
  } catch (e) {
    const SPREADSHEET_ID = getSpreadsheetId();
    const errorMsg = 'スプレッドシートの取得に失敗しました。ID: ' + SPREADSHEET_ID + ', エラー: ' + e.toString();
    Logger.log(errorMsg);
    Logger.log('Error stack: ' + (e.stack || 'No stack trace'));
    throw new Error(errorMsg);
  }
}

/**
 * シートを安全に取得（存在しない場合は初期化）
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} sheetName - シート名
 * @param {boolean} autoInit - 存在しない場合に自動初期化するか
 * @return {Sheet} シートオブジェクト
 */
function getSheetSafely(ss, sheetName, autoInit = true) {
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet && autoInit) {
    initializeSpreadsheet();
    sheet = ss.getSheetByName(sheetName);
  }
  
  return sheet;
}

/**
 * 日付をYYYY-MM-DD形式の文字列に変換
 * @param {Date|string} date - 日付（Dateオブジェクトまたは文字列）
 * @return {string} YYYY-MM-DD形式の日付文字列
 */
function formatDateToString(date) {
  if (date instanceof Date) {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } else if (typeof date === 'string') {
    // 文字列の場合は、日付部分のみ取得（時刻が含まれている場合がある）
    return date.split(' ')[0].split('T')[0];
  }
  return '';
}

/**
 * 日付が一致するかチェック
 * @param {Date|string} date1 - 比較する日付1
 * @param {string} date2Str - 比較する日付2（YYYY-MM-DD形式）
 * @return {boolean} 一致する場合true
 */
function isDateMatch(date1, date2Str) {
  const date1Str = formatDateToString(date1);
  return date1Str === date2Str;
}

/**
 * エラーレスポンスを作成
 * @param {string} message - エラーメッセージ
 * @param {Object} additionalData - 追加データ
 * @return {Object} エラーレスポンスオブジェクト
 */
function createErrorResponse(message, additionalData = {}) {
  return {
    error: true,
    message: message,
    ...additionalData
  };
}

/**
 * 成功レスポンスを作成
 * @param {string} message - 成功メッセージ
 * @param {Object} additionalData - 追加データ
 * @return {Object} 成功レスポンスオブジェクト
 */
function createSuccessResponse(message, additionalData = {}) {
  return {
    success: true,
    message: message,
    ...additionalData
  };
}

/**
 * タスクデータをパース（getTasks()の結果から）
 * @param {string|Object} tasksResult - getTasks()の結果
 * @return {Object} パースされたタスクデータ {success, tasks, count, message?}
 */
function parseTasksResult(tasksResult) {
  // JSON文字列の場合はパース
  if (typeof tasksResult === 'string') {
    try {
      return JSON.parse(tasksResult);
    } catch (parseError) {
      Logger.log('parseTasksResult: JSONパースエラー - ' + parseError.toString());
      return {
        success: false,
        error: true,
        message: 'タスクデータの解析に失敗しました',
        tasks: [],
        count: 0
      };
    }
  }
  
  // 既にオブジェクトの場合はそのまま返す
  return tasksResult || { success: false, tasks: [], count: 0 };
}

/**
 * 日報行を検索
 * @param {Sheet} reportSheet - 日報シート
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @return {number} 行インデックス（見つからない場合は-1、1始まり）
 */
function findReportRow(reportSheet, date) {
  const data = reportSheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (isDateMatch(data[i][REPORT_COL_DATE], date)) {
      return i + 1; // スプレッドシートの行番号は1から始まる
    }
  }
  
  return -1;
}

/**
 * 新しい日報行を作成
 * @param {string} date - 日付
 * @param {Object} data - 日報データ
 * @return {Array} 日報行の配列
 */
function createReportRow(date, data = {}) {
  const row = new Array(REPORT_COLUMN_COUNT);
  row[REPORT_COL_DATE] = date;
  row[REPORT_COL_GOAL] = data.goal || '';
  row[REPORT_COL_ARRIVAL_HEALTH] = data.arrivalHealthScore || '';
  row[REPORT_COL_DEPARTURE_HEALTH] = data.departureHealthScore || '';
  row[REPORT_COL_COMPLETED_TASK_COUNT] = data.completedTaskCount || 0;
  row[REPORT_COL_COMPLETED_TASK_HOURS] = data.completedTaskHours || 0;
  row[REPORT_COL_REFLECTION] = data.reflection || '';
  row[REPORT_COL_TOMORROW_PLAN] = data.tomorrowPlan || '';
  row[REPORT_COL_RECORDED_AT] = data.recordedAt || new Date();
  return row;
}

// ============================================================================
// 初期化・デバッグ関数
// ============================================================================

/**
 * Webアプリとして公開する際のエントリーポイント
 */
function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('タスク管理ポータル')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTMLファイルにCSSやJSをインクルードするためのヘルパー関数
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * スプレッドシートを初期化（初回実行時のみ）
 */
function initializeSpreadsheet() {
  const ss = getSpreadsheet();
  
  // タスクシートの作成（存在しない場合のみ）
  let tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
  const TASK_HEADERS = [
    'ID', 'タイトル', '説明', '見積もり時間（時間）', '優先度', 
    '重要度', '提出先', '締切日', 'ステータス', '作成日時', '更新日時'
  ];
  
  if (!tasksSheet) {
    tasksSheet = ss.insertSheet(SHEET_NAME_TASKS);
    const headerRange = tasksSheet.getRange(1, 1, 1, TASK_COLUMN_COUNT);
    headerRange.setValues([TASK_HEADERS]);
    headerRange.setFontWeight('bold');
    tasksSheet.setFrozenRows(1);
  }
  
  // 日報シートの作成（存在しない場合のみ）
  let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
  const REPORT_HEADERS = [
    '日付', '目標', '出社時体調', '退社時体調', 
    '完了タスク数合計', '完了タスク時間合計', '振り返り', '明日の予定', '記録日時'
  ];
  
  if (!reportSheet) {
    reportSheet = ss.insertSheet(SHEET_NAME_REPORT);
    const headerRange = reportSheet.getRange(1, 1, 1, REPORT_COLUMN_COUNT);
    headerRange.setValues([REPORT_HEADERS]);
    headerRange.setFontWeight('bold');
    reportSheet.setFrozenRows(1);
  }
  
  return createSuccessResponse('スプレッドシートが初期化されました');
}

/**
 * デバッグ用: スプレッドシートの状態を確認
 */
function debugSpreadsheetStatus() {
  try {
    const ss = getSpreadsheet();
    if (!ss) {
      return createErrorResponse('スプレッドシートが取得できませんでした（null）', {
        spreadsheetExists: false
      });
    }
    
    Logger.log('DEBUG: スプレッドシートID: ' + ss.getId());
    Logger.log('DEBUG: スプレッドシート名: ' + ss.getName());
    
    // タスクシートの確認
    const tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
    const tasksSheetInfo = tasksSheet ? {
      exists: true,
      lastRow: tasksSheet.getLastRow(),
      lastColumn: tasksSheet.getLastColumn(),
      dataRowCount: tasksSheet.getDataRange() ? tasksSheet.getDataRange().getValues().length : 0,
      headers: tasksSheet.getDataRange() ? tasksSheet.getDataRange().getValues()[0] : null,
      firstDataRow: tasksSheet.getDataRange() && tasksSheet.getDataRange().getValues().length > 1 
        ? tasksSheet.getDataRange().getValues()[1] : null
    } : { exists: false };
    
    // 日報シートの確認
    const reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    const reportSheetInfo = reportSheet ? {
      exists: true,
      lastRow: reportSheet.getLastRow(),
      lastColumn: reportSheet.getLastColumn(),
      dataRowCount: reportSheet.getDataRange() ? reportSheet.getDataRange().getValues().length : 0,
      headers: reportSheet.getDataRange() ? reportSheet.getDataRange().getValues()[0] : null,
      firstDataRow: reportSheet.getDataRange() && reportSheet.getDataRange().getValues().length > 1 
        ? reportSheet.getDataRange().getValues()[1] : null
    } : { exists: false };
    
    return {
      error: false,
      spreadsheetId: ss.getId(),
      spreadsheetName: ss.getName(),
      tasksSheet: tasksSheetInfo,
      reportSheet: reportSheetInfo
    };
  } catch (error) {
    Logger.log('DEBUG ERROR: ' + error.toString());
    return createErrorResponse(error.toString(), { stack: error.stack });
  }
}

/**
 * デバッグ用: getTasks()の動作を詳細にログ出力
 */
function debugGetTasks() {
  try {
    Logger.log('=== DEBUG: getTasks() 開始 ===');
    
    const ss = getSpreadsheet();
    Logger.log('DEBUG: スプレッドシート取得: 成功');
    
    const tasksSheet = getSheetSafely(ss, SHEET_NAME_TASKS);
    if (!tasksSheet) {
      Logger.log('DEBUG: タスクシートの作成に失敗しました');
      return createErrorResponse('タスクシートの作成に失敗しました');
    }
    
    const dataRange = tasksSheet.getDataRange();
    if (!dataRange) {
      Logger.log('DEBUG: getDataRange()がnullを返しました');
      return [];
    }
    
    const data = dataRange.getValues();
    Logger.log('DEBUG: getValues()結果: ' + (data ? '成功' : 'null'));
    Logger.log('DEBUG: getValues()型: ' + typeof data);
    Logger.log('DEBUG: getValues()が配列か: ' + Array.isArray(data));
    Logger.log('DEBUG: データ行数: ' + (data ? data.length : 0));
    
    if (!data || !Array.isArray(data) || data.length <= 1) {
      Logger.log('DEBUG: データがヘッダーのみ（データ行なし）');
      return [];
    }
    
    Logger.log('DEBUG: ヘッダー行: ' + JSON.stringify(data[0]));
    
    const tasks = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) {
        Logger.log('DEBUG: 行' + i + 'は無効（スキップ）');
        continue;
      }
      
      const taskId = row[TASK_COL_ID];
      Logger.log('DEBUG: 行' + i + 'のID: ' + taskId + ' (型: ' + typeof taskId + ')');
      
      if (taskId !== null && taskId !== undefined && taskId !== '') {
        const task = {
          id: taskId,
          title: row[TASK_COL_TITLE] || '',
          description: row[TASK_COL_DESCRIPTION] || '',
          estimatedHours: row[TASK_COL_ESTIMATED_HOURS] || 0,
          priority: row[TASK_COL_PRIORITY] || '中',
          importance: row[TASK_COL_IMPORTANCE] || '中',
          deliverable: row[TASK_COL_DELIVERABLE] || '',
          deadline: row[TASK_COL_DEADLINE] || '',
          status: row[TASK_COL_STATUS] || '未着手',
          createdAt: row[TASK_COL_CREATED_AT] || '',
          updatedAt: row[TASK_COL_UPDATED_AT] || ''
        };
        Logger.log('DEBUG: タスク作成: ' + JSON.stringify(task));
        tasks.push(task);
      }
    }
    
    Logger.log('=== DEBUG: getTasks() 完了 ===');
    Logger.log('DEBUG: 取得したタスク数: ' + tasks.length);
    Logger.log('DEBUG: 取得したタスク: ' + JSON.stringify(tasks));
    
    return tasks;
  } catch (error) {
    Logger.log('=== DEBUG: getTasks() エラー ===');
    Logger.log('DEBUG ERROR: ' + error.toString());
    Logger.log('DEBUG ERROR STACK: ' + (error.stack || 'No stack trace'));
    return [];
  }
}

// ============================================================================
// タスク管理関数
// ============================================================================

/**
 * タスク一覧を取得
 */
function getTasks() {
  try {
    const ss = getSpreadsheet();
    const tasksSheet = getSheetSafely(ss, SHEET_NAME_TASKS);
    
    if (!tasksSheet) {
      return JSON.stringify(createErrorResponse('タスクシートの作成に失敗しました', {
        tasks: [],
        count: 0
      }));
    }
    
    const dataRange = tasksSheet.getDataRange();
    if (!dataRange) {
      return JSON.stringify(createSuccessResponse('', { tasks: [], count: 0 }));
    }
    
    const data = dataRange.getValues();
    if (!data || !Array.isArray(data) || data.length <= 1) {
      return JSON.stringify(createSuccessResponse('', { tasks: [], count: 0 }));
    }
    
    const tasks = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) {
        continue;
      }
      
      const taskId = row[TASK_COL_ID];
      if (taskId !== null && taskId !== undefined && taskId !== '') {
        tasks.push({
          id: taskId,
          title: row[TASK_COL_TITLE] || '',
          description: row[TASK_COL_DESCRIPTION] || '',
          estimatedHours: row[TASK_COL_ESTIMATED_HOURS] || 0,
          priority: row[TASK_COL_PRIORITY] || '中',
          importance: row[TASK_COL_IMPORTANCE] || '中',
          deliverable: row[TASK_COL_DELIVERABLE] || '',
          deadline: row[TASK_COL_DEADLINE] || '',
          status: row[TASK_COL_STATUS] || '未着手',
          createdAt: row[TASK_COL_CREATED_AT] || '',
          updatedAt: row[TASK_COL_UPDATED_AT] || ''
        });
      }
    }
    
    // フロントエンドでnullになる問題を回避するため、JSON文字列化して返す
    return JSON.stringify(createSuccessResponse('', { tasks: tasks, count: tasks.length }));
  } catch (error) {
    Logger.log('Error in getTasks: ' + error.toString());
    return JSON.stringify(createErrorResponse('タスクの取得中にエラーが発生しました: ' + error.toString(), {
      tasks: [],
      count: 0
    }));
  }
}

/**
 * タスクを追加
 */
function addTask(taskData) {
  try {
    const ss = getSpreadsheet();
    const tasksSheet = getSheetSafely(ss, SHEET_NAME_TASKS);
    
    if (!tasksSheet) {
      return createErrorResponse('タスクシートの取得に失敗しました');
    }
    
    // 新しいIDを生成（現在の最大ID + 1、または1）
    const data = tasksSheet.getDataRange().getValues();
    let newId = 1;
    if (data.length > 1) {
      const ids = data.slice(1).map(row => parseInt(row[TASK_COL_ID]) || 0);
      newId = Math.max(...ids, 0) + 1;
    }
    
    const now = new Date();
    const newRow = new Array(TASK_COLUMN_COUNT);
    newRow[TASK_COL_ID] = newId;
    newRow[TASK_COL_TITLE] = taskData.title || '';
    newRow[TASK_COL_DESCRIPTION] = taskData.description || '';
    newRow[TASK_COL_ESTIMATED_HOURS] = parseFloat(taskData.estimatedHours) || 0;
    newRow[TASK_COL_PRIORITY] = taskData.priority || '中';
    newRow[TASK_COL_IMPORTANCE] = taskData.importance || '中';
    newRow[TASK_COL_DELIVERABLE] = taskData.deliverable || '';
    newRow[TASK_COL_DEADLINE] = taskData.deadline || '';
    newRow[TASK_COL_STATUS] = taskData.status || '未着手';
    newRow[TASK_COL_CREATED_AT] = now.toISOString();
    newRow[TASK_COL_UPDATED_AT] = now.toISOString();
    
    tasksSheet.appendRow(newRow);
    
    return createSuccessResponse('タスクが追加されました', { id: newId });
  } catch (error) {
    Logger.log('Error in addTask: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * タスクを更新
 */
function updateTask(taskId, taskData) {
  try {
    const ss = getSpreadsheet();
    const tasksSheet = getSheetSafely(ss, SHEET_NAME_TASKS, false);
    
    if (!tasksSheet) {
      return createErrorResponse('タスクシートが見つかりません');
    }
    
    const data = tasksSheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // タスクIDで行を検索
    for (let i = 1; i < data.length; i++) {
      if (parseInt(data[i][TASK_COL_ID]) === parseInt(taskId)) {
        rowIndex = i + 1; // スプレッドシートの行番号は1から始まる
        break;
      }
    }
    
    if (rowIndex === -1) {
      return createErrorResponse('タスクが見つかりませんでした');
    }
    
    // 既存のデータを取得
    const existingRow = data[rowIndex - 1];
    const now = new Date();
    
    // 更新するデータを準備（指定されていない場合は既存の値を使用）
    const updatedRow = new Array(TASK_COLUMN_COUNT);
    updatedRow[TASK_COL_ID] = existingRow[TASK_COL_ID];
    updatedRow[TASK_COL_TITLE] = taskData.title !== undefined ? taskData.title : existingRow[TASK_COL_TITLE];
    updatedRow[TASK_COL_DESCRIPTION] = taskData.description !== undefined ? taskData.description : existingRow[TASK_COL_DESCRIPTION];
    updatedRow[TASK_COL_ESTIMATED_HOURS] = taskData.estimatedHours !== undefined ? parseFloat(taskData.estimatedHours) : existingRow[TASK_COL_ESTIMATED_HOURS];
    updatedRow[TASK_COL_PRIORITY] = taskData.priority !== undefined ? taskData.priority : existingRow[TASK_COL_PRIORITY];
    updatedRow[TASK_COL_IMPORTANCE] = taskData.importance !== undefined ? taskData.importance : (existingRow[TASK_COL_IMPORTANCE] || '中');
    updatedRow[TASK_COL_DELIVERABLE] = taskData.deliverable !== undefined ? taskData.deliverable : (existingRow[TASK_COL_DELIVERABLE] || '');
    updatedRow[TASK_COL_DEADLINE] = taskData.deadline !== undefined ? taskData.deadline : (existingRow[TASK_COL_DEADLINE] || '');
    updatedRow[TASK_COL_STATUS] = taskData.status !== undefined ? taskData.status : (existingRow[TASK_COL_STATUS] || '未着手');
    updatedRow[TASK_COL_CREATED_AT] = existingRow[TASK_COL_CREATED_AT] || '';
    updatedRow[TASK_COL_UPDATED_AT] = now.toISOString();
    
    // 行を更新
    tasksSheet.getRange(rowIndex, 1, 1, TASK_COLUMN_COUNT).setValues([updatedRow]);
    
    return createSuccessResponse('タスクが更新されました', { id: taskId });
  } catch (error) {
    Logger.log('Error in updateTask: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * タスクを削除
 */
function deleteTask(taskId) {
  try {
    const ss = getSpreadsheet();
    const tasksSheet = getSheetSafely(ss, SHEET_NAME_TASKS, false);
    
    if (!tasksSheet) {
      return createErrorResponse('タスクシートが見つかりません');
    }
    
    const data = tasksSheet.getDataRange().getValues();
    let rowIndex = -1;
    
    // タスクIDで行を検索
    for (let i = 1; i < data.length; i++) {
      if (parseInt(data[i][TASK_COL_ID]) === parseInt(taskId)) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      return createErrorResponse('タスクが見つかりませんでした');
    }
    
    // 行を削除
    tasksSheet.deleteRow(rowIndex);
    
    return createSuccessResponse('タスクが削除されました', { id: taskId });
  } catch (error) {
    Logger.log('Error in deleteTask: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * タスクのステータスを更新
 */
function updateTaskStatus(taskId, status) {
  return updateTask(taskId, { status: status });
}

// ============================================================================
// カレンダー・負荷計算関数
// ============================================================================

/**
 * Googleカレンダーから今週の会議予定を取得
 */
function getCalendarEvents() {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    if (!calendar) {
      return createErrorResponse('デフォルトカレンダーが見つかりません');
    }
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    const events = calendar.getEvents(startOfWeek, endOfWeek);
    
    const eventsData = events.map(event => {
      const startTime = event.getStartTime();
      const endTime = event.getEndTime();
      const duration = (endTime - startTime) / (1000 * 60 * 60);
      
      return {
        title: event.getTitle(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        location: event.getLocation() || ''
      };
    });
    
    const totalMeetingHours = eventsData.reduce((sum, event) => sum + event.duration, 0);
    
    return {
      events: eventsData,
      totalMeetingHours: totalMeetingHours,
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString()
    };
  } catch (error) {
    Logger.log('Error in getCalendarEvents: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 週のタスク負荷を計算
 */
function getWeeklyWorkload() {
  try {
    const tasksResult = getTasks();
    const tasksData = parseTasksResult(tasksResult);
    
    if (tasksData.error || !tasksData.success) {
      return createErrorResponse('タスクの取得に失敗しました: ' + (tasksData.message || '不明なエラー'));
    }
    
    const tasks = tasksData.tasks || [];
    if (!Array.isArray(tasks)) {
      return createErrorResponse('タスクデータの形式が正しくありません');
    }
    
    const calendarData = getCalendarEvents();
    if (calendarData.error) {
      Logger.log('カレンダー取得エラー: ' + calendarData.message);
    }
    
    // 未完了のタスクの見積もり時間の合計
    const activeTasks = tasks.filter(task => 
      task && task.status !== '完了' && task.status !== 'キャンセル'
    );
    const totalTaskHours = activeTasks.reduce((sum, task) => 
      sum + (parseFloat(task.estimatedHours) || 0), 0
    );
    
    const meetingHours = (calendarData.error ? 0 : (calendarData.totalMeetingHours || 0));
    const totalHours = totalTaskHours + meetingHours;
    const availableHours = 40 - totalHours;
    const utilizationRate = (totalHours / 40) * 100;
    
    return {
      totalTaskHours: totalTaskHours,
      meetingHours: meetingHours,
      totalHours: totalHours,
      availableHours: availableHours,
      utilizationRate: utilizationRate,
      activeTaskCount: activeTasks.length
    };
  } catch (error) {
    Logger.log('Error in getWeeklyWorkload: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

// ============================================================================
// 日報管理関数
// ============================================================================

/**
 * 体調スコアを記録（出社時）
 * ヘッダーの体調ステータスボタンから呼び出される
 */
function recordHealthScore(healthData) {
  try {
    const ss = getSpreadsheet();
    const reportSheet = getSheetSafely(ss, SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return createErrorResponse('日報シートの取得に失敗しました');
    }
    
    const date = healthData.date || new Date().toISOString().split('T')[0];
    const score = healthData.score || '普通';
    
    const rowIndex = findReportRow(reportSheet, date);
    
    if (rowIndex > 0) {
      // 既存の行を更新
      reportSheet.getRange(rowIndex, REPORT_COL_ARRIVAL_HEALTH + 1).setValue(score);
    } else {
      // 新規追加
      const newRow = createReportRow(date, {
        arrivalHealthScore: score
      });
      reportSheet.appendRow(newRow);
    }
    
    return createSuccessResponse('出社時体調が記録されました', { date: date });
  } catch (error) {
    Logger.log('Error in recordHealthScore: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 今日の目標を保存
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @param {string} goal - 目標
 */
function saveDailyGoal(date, goal) {
  try {
    const ss = getSpreadsheet();
    const reportSheet = getSheetSafely(ss, SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return createErrorResponse('日報シートが見つかりません。初期化を実行してください。');
    }
    
    const rowIndex = findReportRow(reportSheet, date);
    
    if (rowIndex > 0) {
      // 既存の行を更新
      reportSheet.getRange(rowIndex, REPORT_COL_GOAL + 1).setValue(goal);
    } else {
      // 新規追加
      const newRow = createReportRow(date, { goal: goal });
      reportSheet.appendRow(newRow);
    }
    
    return createSuccessResponse('目標が保存されました');
  } catch (error) {
    Logger.log('Error in saveDailyGoal: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 今日の目標を取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 */
function getDailyGoal(date) {
  try {
    const ss = getSpreadsheet();
    const reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return '';
    }
    
    const rowIndex = findReportRow(reportSheet, date);
    
    if (rowIndex > 0) {
      const data = reportSheet.getDataRange().getValues();
      return data[rowIndex - 1][REPORT_COL_GOAL] || '';
    }
    
    return '';
  } catch (error) {
    Logger.log('Error in getDailyGoal: ' + error.toString());
    return '';
  }
}

/**
 * 今日完了したタスクを取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 */
function getCompletedTasksToday(date) {
  try {
    const tasksResult = getTasks();
    const tasksData = parseTasksResult(tasksResult);
    
    if (tasksData.error || !tasksData.success) {
      return { count: 0, totalHours: 0, tasks: [] };
    }
    
    const tasks = tasksData.tasks || [];
    if (!Array.isArray(tasks)) {
      return { count: 0, totalHours: 0, tasks: [] };
    }
    
    const todayStr = formatDateToString(new Date(date));
    
    // 今日完了したタスクをフィルタリング
    const completedTasks = tasks.filter(task => {
      if (task.status !== '完了') {
        return false;
      }
      
      if (task.updatedAt) {
        const updatedDateStr = formatDateToString(new Date(task.updatedAt));
        return updatedDateStr === todayStr;
      }
      
      return false;
    });
    
    const totalHours = completedTasks.reduce((sum, task) => {
      return sum + (parseFloat(task.estimatedHours) || 0);
    }, 0);
    
    return {
      count: completedTasks.length,
      totalHours: totalHours,
      tasks: completedTasks.map(task => ({
        id: task.id,
        title: task.title,
        estimatedHours: task.estimatedHours
      }))
    };
  } catch (error) {
    Logger.log('Error in getCompletedTasksToday: ' + error.toString());
    return {
      error: true,
      message: error.toString(),
      count: 0,
      totalHours: 0,
      tasks: []
    };
  }
}

/**
 * 日報を記録
 * @param {Object} reportData - 日報データ
 * @param {string} reportData.date - 日付（YYYY-MM-DD形式）
 * @param {string} reportData.goal - 目標
 * @param {string} reportData.healthScore - 退社時体調スコア
 * @param {string} reportData.reflection - 振り返り
 * @param {string} reportData.tomorrowPlan - 明日の予定
 */
function recordDailyReport(reportData) {
  try {
    const ss = getSpreadsheet();
    const reportSheet = getSheetSafely(ss, SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return createErrorResponse('日報シートが見つかりません。初期化を実行してください。');
    }
    
    // 今日完了したタスクを取得
    const completedTasks = getCompletedTasksToday(reportData.date);
    
    const rowIndex = findReportRow(reportSheet, reportData.date);
    
    if (rowIndex > 0) {
      // 既存の行を更新
      reportSheet.getRange(rowIndex, REPORT_COL_GOAL + 1).setValue(reportData.goal || '');
      // 出社時体調は既存の値を保持（更新しない）
      reportSheet.getRange(rowIndex, REPORT_COL_DEPARTURE_HEALTH + 1).setValue(reportData.healthScore || '');
      reportSheet.getRange(rowIndex, REPORT_COL_COMPLETED_TASK_COUNT + 1).setValue(completedTasks.count || 0);
      reportSheet.getRange(rowIndex, REPORT_COL_COMPLETED_TASK_HOURS + 1).setValue(completedTasks.totalHours || 0);
      reportSheet.getRange(rowIndex, REPORT_COL_REFLECTION + 1).setValue(reportData.reflection || '');
      reportSheet.getRange(rowIndex, REPORT_COL_TOMORROW_PLAN + 1).setValue(reportData.tomorrowPlan || '');
      reportSheet.getRange(rowIndex, REPORT_COL_RECORDED_AT + 1).setValue(new Date());
    } else {
      // 新規追加
      const newRow = createReportRow(reportData.date, {
        goal: reportData.goal || '',
        arrivalHealthScore: reportData.arrivalHealthScore || '',
        departureHealthScore: reportData.healthScore || '',
        completedTaskCount: completedTasks.count || 0,
        completedTaskHours: completedTasks.totalHours || 0,
        reflection: reportData.reflection || '',
        tomorrowPlan: reportData.tomorrowPlan || ''
      });
      reportSheet.appendRow(newRow);
    }
    
    return createSuccessResponse('日報が保存されました');
  } catch (error) {
    Logger.log('Error in recordDailyReport: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 日報を取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 */
function getDailyReport(date) {
  try {
    const ss = getSpreadsheet();
    const reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return {
        error: false,
        date: date,
        goal: '',
        arrivalHealthScore: '',
        healthScore: '',
        completedTaskCount: 0,
        completedTaskHours: 0,
        reflection: '',
        tomorrowPlan: ''
      };
    }
    
    const rowIndex = findReportRow(reportSheet, date);
    
    if (rowIndex > 0) {
      const data = reportSheet.getDataRange().getValues();
      const row = data[rowIndex - 1];
      
      return {
        error: false,
        date: date,
        goal: row[REPORT_COL_GOAL] || '',
        arrivalHealthScore: row[REPORT_COL_ARRIVAL_HEALTH] || '',
        healthScore: row[REPORT_COL_DEPARTURE_HEALTH] || '',
        completedTaskCount: row[REPORT_COL_COMPLETED_TASK_COUNT] || 0,
        completedTaskHours: row[REPORT_COL_COMPLETED_TASK_HOURS] || 0,
        reflection: row[REPORT_COL_REFLECTION] || '',
        tomorrowPlan: row[REPORT_COL_TOMORROW_PLAN] || ''
      };
    }
    
    // 見つからない場合は空のデータを返す
    return {
      error: false,
      date: date,
      goal: '',
      arrivalHealthScore: '',
      healthScore: '',
      completedTaskCount: 0,
      completedTaskHours: 0,
      reflection: '',
      tomorrowPlan: ''
    };
  } catch (error) {
    Logger.log('Error in getDailyReport: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}
