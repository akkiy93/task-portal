/**
 * タスク管理ポータル - Google Apps Script
 * 
 * バージョン: v79
 * 変更内容: タスクの領域分け機能の実装（優先度・重要度の廃止、3領域での管理）
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
const SHEET_NAME_TASKS_OLD = 'タスク（旧）';
const SHEET_NAME_CALENDAR = 'カレンダー';
const SHEET_NAME_REPORT = '日報';
const SHEET_NAME_REPORT_OLD = '日報（旧）';

// タスクシートの列インデックス（0始まり）
const TASK_COL_ID = 0;
const TASK_COL_TITLE = 1;
const TASK_COL_DESCRIPTION = 2;
const TASK_COL_ESTIMATED_HOURS = 3;
const TASK_COL_AREA = 4;
const TASK_COL_DELIVERABLE = 5;
const TASK_COL_DEADLINE = 6;
const TASK_COL_STATUS = 7;
const TASK_COL_CREATED_AT = 8;
const TASK_COL_UPDATED_AT = 9;
const TASK_COLUMN_COUNT = 10;

// 日報シートの列インデックス（0始まり）
const REPORT_COL_DATE = 0;
const REPORT_COL_GOAL = 1;
const REPORT_COL_ARRIVAL_HEALTH = 2;
const REPORT_COL_ARRIVAL_HEALTH_MEMO = 3;
const REPORT_COL_DEPARTURE_HEALTH = 4;
const REPORT_COL_DEPARTURE_HEALTH_MEMO = 5;
const REPORT_COL_COMPLETED_TASK_COUNT = 6;
const REPORT_COL_COMPLETED_TASK_HOURS = 7;
const REPORT_COL_PROGRESS = 8;
const REPORT_COL_CHALLENGES = 9;
const REPORT_COL_ACTIONS = 10;
const REPORT_COL_REQUESTS = 11;
const REPORT_COL_LEARNINGS = 12;
const REPORT_COL_TOMORROW_PLAN = 13;
const REPORT_COL_RECORDED_AT = 14;
const REPORT_COLUMN_COUNT = 15;

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
  row[REPORT_COL_ARRIVAL_HEALTH_MEMO] = data.arrivalHealthMemo || '';
  row[REPORT_COL_DEPARTURE_HEALTH] = data.departureHealthScore || '';
  row[REPORT_COL_DEPARTURE_HEALTH_MEMO] = data.departureHealthMemo || '';
  row[REPORT_COL_COMPLETED_TASK_COUNT] = data.completedTaskCount || 0;
  row[REPORT_COL_COMPLETED_TASK_HOURS] = data.completedTaskHours || 0;
  row[REPORT_COL_PROGRESS] = data.progress || '';
  row[REPORT_COL_CHALLENGES] = data.challenges || '';
  row[REPORT_COL_ACTIONS] = data.actions || '';
  row[REPORT_COL_REQUESTS] = data.requests || '';
  row[REPORT_COL_LEARNINGS] = data.learnings || '';
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
 * 既存シートを旧シートに名称変更（タイムスタンプ付きで競合回避）
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} sheetName - シート名
 * @param {string} oldSheetName - 旧シート名
 */
function renameSheetToOld(ss, sheetName, oldSheetName) {
  const oldSheet = ss.getSheetByName(sheetName);
  if (!oldSheet) {
    return;
  }
  
  const alreadyRenamed = ss.getSheetByName(oldSheetName);
  if (!alreadyRenamed) {
    oldSheet.setName(oldSheetName);
    Logger.log(`既存のシート「${sheetName}」を「${oldSheetName}」に名称変更しました。`);
  } else {
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd_HHmmss');
    const oldSheetNameWithTimestamp = `${oldSheetName}_${timestamp}`;
    oldSheet.setName(oldSheetNameWithTimestamp);
    Logger.log(`既存のシート「${sheetName}」を「${oldSheetNameWithTimestamp}」に名称変更しました（「${oldSheetName}」は既に存在します）。`);
  }
}

/**
 * シートを作成または更新（ヘッダーを最新に保つ）
 * @param {Spreadsheet} ss - スプレッドシートオブジェクト
 * @param {string} sheetName - シート名
 * @param {Array<string>} headers - ヘッダー配列
 * @param {number} columnCount - 列数
 */
function createOrUpdateSheet(ss, sheetName, headers, columnCount) {
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    const headerRange = sheet.getRange(1, 1, 1, columnCount);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    sheet.setFrozenRows(1);
    Logger.log(`新しいシート「${sheetName}」を作成しました。`);
  } else {
    const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (JSON.stringify(currentHeaders) !== JSON.stringify(headers)) {
      sheet.getRange(1, 1, 1, columnCount).setValues([headers]);
      sheet.getRange(1, 1, 1, columnCount).setFontWeight('bold');
      sheet.setFrozenRows(1);
      Logger.log(`既存のシート「${sheetName}」のヘッダーを更新しました。`);
    }
  }
  
  return sheet;
}

/**
 * スプレッドシートを初期化（初回実行時のみ）
 */
function initializeSpreadsheet() {
  const ss = getSpreadsheet();
  
  // タスクシートの初期化
  renameSheetToOld(ss, SHEET_NAME_TASKS, SHEET_NAME_TASKS_OLD);
  const TASK_HEADERS = [
    'ID', 'タイトル', '説明', '見積もり時間（時間）', '領域', 
    '提出先', '締切日', 'ステータス', '作成日時', '更新日時'
  ];
  createOrUpdateSheet(ss, SHEET_NAME_TASKS, TASK_HEADERS, TASK_COLUMN_COUNT);
  
  // 日報シートの初期化
  renameSheetToOld(ss, SHEET_NAME_REPORT, SHEET_NAME_REPORT_OLD);
  const REPORT_HEADERS = [
    '日付', '目標', '出社時体調', '出社時体調備考', '退社時体調', '退社時体調備考',
    '完了タスク数合計', '完了タスク時間合計',
    '目標に対する進捗・成果', '課題・ボトルネック', '対策・改善アクション',
    '他者への依頼・連携事項', '業務上の気づき・学び', '明日の予定', '記録日時'
  ];
  createOrUpdateSheet(ss, SHEET_NAME_REPORT, REPORT_HEADERS, REPORT_COLUMN_COUNT);
  
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
          area: row[TASK_COL_AREA] || '今すぐやる',
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
          area: row[TASK_COL_AREA] || '今すぐやる',
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
    newRow[TASK_COL_AREA] = taskData.area || '今すぐやる';
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
    updatedRow[TASK_COL_AREA] = taskData.area !== undefined ? taskData.area : (existingRow[TASK_COL_AREA] || '今すぐやる');
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
 * Googleカレンダーから指定された週の会議予定を取得
 * @param {string} weekStartISO - 週の開始日（ISO形式、オプション）
 * @param {string} weekEndISO - 週の終了日（ISO形式、オプション）
 */
function getCalendarEvents(weekStartISO, weekEndISO) {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    if (!calendar) {
      return createErrorResponse('デフォルトカレンダーが見つかりません');
    }
    
    // 週の範囲を決定（パラメータが指定されていない場合は今週）
    let startOfWeek, endOfWeek;
    if (weekStartISO && weekEndISO) {
      startOfWeek = new Date(weekStartISO);
      endOfWeek = new Date(weekEndISO);
    } else {
      const now = new Date();
      startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
    }
    
    const events = calendar.getEvents(startOfWeek, endOfWeek);
    
    // すべてのイベントを表示（労働負荷計算除外リストは参照しない）
    const eventsData = events.map(event => {
        const startTime = event.getStartTime();
        const endTime = event.getEndTime();
        const duration = (endTime - startTime) / (1000 * 60 * 60);
        
        return {
          id: event.getId(),  // イベントIDを追加
          title: event.getTitle(),
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          duration: duration,
          location: event.getLocation() || '',
          description: event.getDescription() || ''  // 説明も追加
        };
      });
    
    const totalMeetingHours = eventsData.reduce((sum, event) => sum + event.duration, 0);
    
    // 労働負荷計算除外リストを取得（フロントエンドでボタン状態を表示するため）
    const excludedEventIds = getExcludedFromWorkloadEvents();
    
    return {
      events: eventsData,
      totalMeetingHours: totalMeetingHours,
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString(),
      excludedEventIds: excludedEventIds  // 除外リストを返す
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
    
    // カレンダーイベントを取得（労働負荷計算用）
    const calendar = CalendarApp.getDefaultCalendar();
    let meetingHours = 0;
    
    if (calendar) {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);
      
      const events = calendar.getEvents(startOfWeek, endOfWeek);
      
      // 労働負荷計算除外リストを取得
      const excludedEventIds = getExcludedFromWorkloadEvents();
      
      const includedEvents = events.filter(event => {
        // 除外リストに含まれていないイベントのみを計算に含める
        const eventId = event.getId();
        return !excludedEventIds.includes(eventId);
      });
      
      meetingHours = includedEvents.reduce((sum, event) => {
        const startTime = event.getStartTime();
        const endTime = event.getEndTime();
        const duration = (endTime - startTime) / (1000 * 60 * 60);
        return sum + duration;
      }, 0);
    }
    
    // 未完了のタスクの見積もり時間の合計
    const activeTasks = tasks.filter(task => 
      task && task.status !== '完了' && task.status !== 'キャンセル'
    );
    const totalTaskHours = activeTasks.reduce((sum, task) => 
      sum + (parseFloat(task.estimatedHours) || 0), 0
    );
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
// カレンダー労働負荷計算除外管理関数
// ============================================================================

/**
 * 労働負荷計算から除外するカレンダーイベントリストを取得
 * @return {Array<string>} 除外イベントIDの配列
 */
function getExcludedFromWorkloadEvents() {
  try {
    const properties = PropertiesService.getScriptProperties();
    const excludedEventsJson = properties.getProperty('EXCLUDED_FROM_WORKLOAD_EVENTS');
    
    if (!excludedEventsJson) {
      return [];
    }
    
    const excludedEvents = JSON.parse(excludedEventsJson);
    return Array.isArray(excludedEvents) ? excludedEvents : [];
  } catch (error) {
    Logger.log('Error in getExcludedFromWorkloadEvents: ' + error.toString());
    return [];
  }
}

/**
 * カレンダーイベントを労働負荷計算から除外するリストに追加
 * @param {string} eventId - 除外するイベントID
 * @return {Object} 成功/エラーレスポンス
 */
function excludeEventFromWorkload(eventId) {
  try {
    if (!eventId || typeof eventId !== 'string') {
      return createErrorResponse('イベントIDが無効です');
    }
    
    const properties = PropertiesService.getScriptProperties();
    const excludedEvents = getExcludedFromWorkloadEvents();
    
    // 既に除外リストに含まれている場合は何もしない
    if (excludedEvents.includes(eventId)) {
      return createSuccessResponse('イベントは既に労働負荷計算から除外されています', { eventId: eventId });
    }
    
    // 除外リストに追加
    excludedEvents.push(eventId);
    const excludedEventsJson = JSON.stringify(excludedEvents);
    properties.setProperty('EXCLUDED_FROM_WORKLOAD_EVENTS', excludedEventsJson);
    
    return createSuccessResponse('イベントを労働負荷計算から除外しました', { eventId: eventId });
  } catch (error) {
    Logger.log('Error in excludeEventFromWorkload: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * カレンダーイベントを労働負荷計算から除外するリストから削除（再計算に含める）
 * @param {string} eventId - 再計算に含めるイベントID
 * @return {Object} 成功/エラーレスポンス
 */
function includeEventInWorkload(eventId) {
  try {
    if (!eventId || typeof eventId !== 'string') {
      return createErrorResponse('イベントIDが無効です');
    }
    
    const properties = PropertiesService.getScriptProperties();
    const excludedEvents = getExcludedFromWorkloadEvents();
    
    // 除外リストから削除
    const filteredEvents = excludedEvents.filter(id => id !== eventId);
    
    if (filteredEvents.length === excludedEvents.length) {
      // 変更がない場合（既に計算に含まれている）
      return createSuccessResponse('イベントは既に労働負荷計算に含まれています', { eventId: eventId });
    }
    
    // 更新されたリストを保存
    const excludedEventsJson = JSON.stringify(filteredEvents);
    properties.setProperty('EXCLUDED_FROM_WORKLOAD_EVENTS', excludedEventsJson);
    
    return createSuccessResponse('イベントを労働負荷計算に含めました', { eventId: eventId });
  } catch (error) {
    Logger.log('Error in includeEventInWorkload: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

// ============================================================================
// 日報管理関数
// ============================================================================

/**
 * 体調スコアを記録（出社時）
 * ヘッダーの体調ステータスボタンから呼び出される
 * @param {Object} healthData - 体調データ
 * @param {string} healthData.date - 日付
 * @param {string} healthData.score - 体調スコア（「良い」「不調あり」）
 * @param {string} healthData.memo - 体調備考
 */
function recordHealthScore(healthData) {
  try {
    const ss = getSpreadsheet();
    const reportSheet = getSheetSafely(ss, SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return createErrorResponse('日報シートの取得に失敗しました');
    }
    
    const date = healthData.date || new Date().toISOString().split('T')[0];
    // 体調スコアは「良い」「不調あり」の2項目のみ
    const score = healthData.score || '良い';
    const memo = healthData.memo || '';
    
    // 体調スコアの値検証
    if (score !== '良い' && score !== '不調あり') {
      return createErrorResponse('体調スコアは「良い」または「不調あり」のみ有効です');
    }
    
    const rowIndex = findReportRow(reportSheet, date);
    
    if (rowIndex > 0) {
      // 既存の行を更新
      reportSheet.getRange(rowIndex, REPORT_COL_ARRIVAL_HEALTH + 1).setValue(score);
      reportSheet.getRange(rowIndex, REPORT_COL_ARRIVAL_HEALTH_MEMO + 1).setValue(memo);
    } else {
      // 新規追加
      const newRow = createReportRow(date, {
        arrivalHealthScore: score,
        arrivalHealthMemo: memo
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
      // 退社時体調と備考を更新
      reportSheet.getRange(rowIndex, REPORT_COL_DEPARTURE_HEALTH + 1).setValue(reportData.healthScore || '');
      reportSheet.getRange(rowIndex, REPORT_COL_DEPARTURE_HEALTH_MEMO + 1).setValue(reportData.healthMemo || '');
      reportSheet.getRange(rowIndex, REPORT_COL_COMPLETED_TASK_COUNT + 1).setValue(completedTasks.count || 0);
      reportSheet.getRange(rowIndex, REPORT_COL_COMPLETED_TASK_HOURS + 1).setValue(completedTasks.totalHours || 0);
      reportSheet.getRange(rowIndex, REPORT_COL_PROGRESS + 1).setValue(reportData.progress || '');
      reportSheet.getRange(rowIndex, REPORT_COL_CHALLENGES + 1).setValue(reportData.challenges || '');
      reportSheet.getRange(rowIndex, REPORT_COL_ACTIONS + 1).setValue(reportData.actions || '');
      reportSheet.getRange(rowIndex, REPORT_COL_REQUESTS + 1).setValue(reportData.requests || '');
      reportSheet.getRange(rowIndex, REPORT_COL_LEARNINGS + 1).setValue(reportData.learnings || '');
      reportSheet.getRange(rowIndex, REPORT_COL_TOMORROW_PLAN + 1).setValue(reportData.tomorrowPlan || '');
      reportSheet.getRange(rowIndex, REPORT_COL_RECORDED_AT + 1).setValue(new Date());
    } else {
      // 新規追加
      const newRow = createReportRow(reportData.date, {
        goal: reportData.goal || '',
        arrivalHealthScore: reportData.arrivalHealthScore || '',
        arrivalHealthMemo: reportData.arrivalHealthMemo || '',
        departureHealthScore: reportData.healthScore || '',
        departureHealthMemo: reportData.healthMemo || '',
        completedTaskCount: completedTasks.count || 0,
        completedTaskHours: completedTasks.totalHours || 0,
        progress: reportData.progress || '',
        challenges: reportData.challenges || '',
        actions: reportData.actions || '',
        requests: reportData.requests || '',
        learnings: reportData.learnings || '',
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
        arrivalHealthMemo: '',
        healthScore: '',
        healthMemo: '',
        completedTaskCount: 0,
        completedTaskHours: 0,
        progress: '',
        challenges: '',
        actions: '',
        requests: '',
        learnings: '',
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
        arrivalHealthMemo: row[REPORT_COL_ARRIVAL_HEALTH_MEMO] || '',
        healthScore: row[REPORT_COL_DEPARTURE_HEALTH] || '',
        healthMemo: row[REPORT_COL_DEPARTURE_HEALTH_MEMO] || '',
        completedTaskCount: row[REPORT_COL_COMPLETED_TASK_COUNT] || 0,
        completedTaskHours: row[REPORT_COL_COMPLETED_TASK_HOURS] || 0,
        progress: row[REPORT_COL_PROGRESS] || '',
        challenges: row[REPORT_COL_CHALLENGES] || '',
        actions: row[REPORT_COL_ACTIONS] || '',
        requests: row[REPORT_COL_REQUESTS] || '',
        learnings: row[REPORT_COL_LEARNINGS] || '',
        tomorrowPlan: row[REPORT_COL_TOMORROW_PLAN] || ''
      };
    }
    
    // 見つからない場合は空のデータを返す
    return {
      error: false,
      date: date,
      goal: '',
      arrivalHealthScore: '',
      arrivalHealthMemo: '',
      healthScore: '',
      healthMemo: '',
      completedTaskCount: 0,
      completedTaskHours: 0,
      progress: '',
      challenges: '',
      actions: '',
      requests: '',
      learnings: '',
      tomorrowPlan: ''
    };
  } catch (error) {
    Logger.log('Error in getDailyReport: ' + error.toString());
    return createErrorResponse(error.toString());
  }
}

/**
 * 既存のタスクデータを優先度・重要度から領域に移行
 * 既存の「優先度」「重要度」列がある場合、領域に変換する
 */
function migrateTasksToArea() {
  try {
    const ss = getSpreadsheet();
    const tasksSheet = getSheetSafely(ss, SHEET_NAME_TASKS);
    
    if (!tasksSheet) {
      return createErrorResponse('タスクシートが見つかりません');
    }
    
    const dataRange = tasksSheet.getDataRange();
    if (!dataRange) {
      return createSuccessResponse('移行するデータがありません');
    }
    
    const data = dataRange.getValues();
    if (data.length <= 1) {
      return createSuccessResponse('移行するデータがありません');
    }
    
    // ヘッダー行を確認
    const headers = data[0];
    const priorityColIndex = headers.indexOf('優先度');
    const importanceColIndex = headers.indexOf('重要度');
    const areaColIndex = headers.indexOf('領域');
    
    // 既に領域列がある場合は移行不要
    if (areaColIndex >= 0 && priorityColIndex < 0 && importanceColIndex < 0) {
      return createSuccessResponse('既に移行済みです');
    }
    
    // 優先度・重要度列がない場合は移行不要
    if (priorityColIndex < 0 || importanceColIndex < 0) {
      return createSuccessResponse('移行するデータがありません（優先度・重要度列が存在しません）');
    }
    
    let migratedCount = 0;
    
    // データ行を処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const priority = row[priorityColIndex] || '中';
      const importance = row[importanceColIndex] || '中';
      
      // 優先度・重要度から領域を決定
      let area = '今すぐやる'; // デフォルト
      
      if (priority === '高' && importance === '高') {
        area = '今すぐやる';
      } else if (priority === '高' && importance === '低') {
        area = '今すぐやる'; // 緊急なので
      } else if (priority === '低' && importance === '高') {
        area = '計画的にする';
      } else if (priority === '低' && importance === '低') {
        area = '計画的にする';
      } else {
        // その他の組み合わせは「今すぐやる」をデフォルト
        area = '今すぐやる';
      }
      
      // 領域列が存在する場合は更新、存在しない場合は追加
      if (areaColIndex >= 0) {
        tasksSheet.getRange(i + 1, areaColIndex + 1).setValue(area);
      } else {
        // 領域列を追加（優先度列の位置に挿入）
        tasksSheet.insertColumnAfter(priorityColIndex + 1);
        tasksSheet.getRange(1, priorityColIndex + 2).setValue('領域');
        tasksSheet.getRange(1, priorityColIndex + 2).setFontWeight('bold');
        tasksSheet.getRange(i + 1, priorityColIndex + 2).setValue(area);
        migratedCount++;
      }
      
      if (areaColIndex >= 0) {
        migratedCount++;
      }
    }
    
    // 優先度・重要度列を削除（オプション：コメントアウトしてデータを保持することも可能）
    // tasksSheet.deleteColumn(priorityColIndex + 1);
    // if (importanceColIndex > priorityColIndex) {
    //   tasksSheet.deleteColumn(importanceColIndex);
    // }
    
    return createSuccessResponse(`${migratedCount}件のタスクを移行しました`, { migratedCount: migratedCount });
  } catch (error) {
    Logger.log('Error in migrateTasksToArea: ' + error.toString());
    return createErrorResponse('移行中にエラーが発生しました: ' + error.toString());
  }
}
