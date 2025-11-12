/**
 * タスク管理ポータル - Google Apps Script
 * 
 * 機能:
 * - タスクの一覧表示
 * - タスクの追加・編集・削除
 * - タスクのステータス変更
 * - Googleカレンダーからの会議予定取得
 * - 週40時間に対するタスク時間の可視化
 * - 体調スコアの記録と可視化
 */

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

/**
 * スプレッドシートIDを取得
 * スクリプトプロパティから取得し、設定されていない場合はデフォルト値を使用
 */
function getSpreadsheetId() {
  const scriptProperties = PropertiesService.getScriptProperties();
  let spreadsheetId = scriptProperties.getProperty('SPREADSHEET_ID');
  
  // スクリプトプロパティに設定されていない場合は、エラーを返す
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
      if (activeSs) {
        const activeId = activeSs.getId();
        if (activeId === SPREADSHEET_ID) {
          ss = activeSs;
          Logger.log('Using active spreadsheet');
        }
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
  
  return {
    success: true,
    message: 'スプレッドシートが初期化されました'
  };
}

/**
 * タスク一覧を取得
 */
function getTasks() {
  try {
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (spreadsheetError) {
      Logger.log('Failed to get spreadsheet: ' + spreadsheetError.toString());
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした: ' + spreadsheetError.toString()
      };
    }
    
    if (!ss) {
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした（null）'
      };
    }
    
    let tasksSheet;
    try {
      tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
    } catch (sheetError) {
      Logger.log('Failed to get sheet by name: ' + sheetError.toString());
      return {
        error: true,
        message: 'タスクシートの取得に失敗しました: ' + sheetError.toString()
      };
    }
    
    // シートが存在しない場合は初期化
    if (!tasksSheet) {
      try {
        initializeSpreadsheet();
        tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
        if (!tasksSheet) {
          return {
            error: true,
            message: 'タスクシートの作成に失敗しました'
          };
        }
      } catch (initError) {
        return {
          error: true,
          message: 'スプレッドシートの初期化に失敗しました: ' + initError.toString()
        };
      }
    }
    
    const dataRange = tasksSheet.getDataRange();
    if (!dataRange) {
      Logger.log('getDataRange returned null');
      return [];
    }
    
    const data = dataRange.getValues();
    if (!data || !Array.isArray(data)) {
      Logger.log('getValues returned null or not an array');
      return [];
    }
    
    // ヘッダー行をスキップ
    if (data.length <= 1) {
      return [];
    }
    
    const tasks = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || !Array.isArray(row)) {
        continue; // 無効な行はスキップ
      }
      
      // IDが存在し、有効な値の場合のみ処理
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
    
    return tasks;
  } catch (error) {
    Logger.log('Error in getTasks: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    // エラーが発生した場合でも空の配列を返す（フロントエンドでnullチェックを回避）
    return [];
  }
}

/**
 * タスクを追加
 */
function addTask(taskData) {
  try {
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (spreadsheetError) {
      Logger.log('Failed to get spreadsheet in addTask: ' + spreadsheetError.toString());
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした: ' + spreadsheetError.toString()
      };
    }
    
    if (!ss) {
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした（null）'
      };
    }
    
    let tasksSheet;
    try {
      tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
    } catch (sheetError) {
      Logger.log('Failed to get sheet by name in addTask: ' + sheetError.toString());
      return {
        error: true,
        message: 'タスクシートの取得に失敗しました: ' + sheetError.toString()
      };
    }
    
    // シートが存在しない場合は初期化
    if (!tasksSheet) {
      initializeSpreadsheet();
      tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
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
    
    return {
      success: true,
      id: newId,
      message: 'タスクが追加されました'
    };
  } catch (error) {
    Logger.log('Error in addTask: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * タスクを更新
 */
function updateTask(taskId, taskData) {
  try {
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (spreadsheetError) {
      Logger.log('Failed to get spreadsheet in updateTask: ' + spreadsheetError.toString());
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした: ' + spreadsheetError.toString()
      };
    }
    
    if (!ss) {
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした（null）'
      };
    }
    
    let tasksSheet;
    try {
      tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
    } catch (sheetError) {
      Logger.log('Failed to get sheet by name in updateTask: ' + sheetError.toString());
      return {
        error: true,
        message: 'タスクシートの取得に失敗しました: ' + sheetError.toString()
      };
    }
    
    if (!tasksSheet) {
      return {
        error: true,
        message: 'タスクシートが見つかりません'
      };
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
      return {
        error: true,
        message: 'タスクが見つかりませんでした'
      };
    }
    
    // 既存のデータを取得
    const existingRow = data[rowIndex - 1];
    const now = new Date();
    
    // 更新するデータを準備（指定されていない場合は既存の値を使用）
    const updatedRow = new Array(TASK_COLUMN_COUNT);
    updatedRow[TASK_COL_ID] = existingRow[TASK_COL_ID]; // IDは変更しない
    updatedRow[TASK_COL_TITLE] = taskData.title !== undefined ? taskData.title : existingRow[TASK_COL_TITLE];
    updatedRow[TASK_COL_DESCRIPTION] = taskData.description !== undefined ? taskData.description : existingRow[TASK_COL_DESCRIPTION];
    updatedRow[TASK_COL_ESTIMATED_HOURS] = taskData.estimatedHours !== undefined ? parseFloat(taskData.estimatedHours) : existingRow[TASK_COL_ESTIMATED_HOURS];
    updatedRow[TASK_COL_PRIORITY] = taskData.priority !== undefined ? taskData.priority : existingRow[TASK_COL_PRIORITY];
    updatedRow[TASK_COL_IMPORTANCE] = taskData.importance !== undefined ? taskData.importance : (existingRow[TASK_COL_IMPORTANCE] || '中');
    updatedRow[TASK_COL_DELIVERABLE] = taskData.deliverable !== undefined ? taskData.deliverable : (existingRow[TASK_COL_DELIVERABLE] || '');
    updatedRow[TASK_COL_DEADLINE] = taskData.deadline !== undefined ? taskData.deadline : (existingRow[TASK_COL_DEADLINE] || '');
    updatedRow[TASK_COL_STATUS] = taskData.status !== undefined ? taskData.status : (existingRow[TASK_COL_STATUS] || '未着手');
    updatedRow[TASK_COL_CREATED_AT] = existingRow[TASK_COL_CREATED_AT] || ''; // 作成日時は変更しない
    updatedRow[TASK_COL_UPDATED_AT] = now.toISOString(); // 更新日時を更新
    
    // 行を更新
    tasksSheet.getRange(rowIndex, 1, 1, TASK_COLUMN_COUNT).setValues([updatedRow]);
    
    return {
      success: true,
      id: taskId,
      message: 'タスクが更新されました'
    };
  } catch (error) {
    Logger.log('Error in updateTask: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * タスクを削除
 */
function deleteTask(taskId) {
  try {
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (spreadsheetError) {
      Logger.log('Failed to get spreadsheet in deleteTask: ' + spreadsheetError.toString());
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした: ' + spreadsheetError.toString()
      };
    }
    
    if (!ss) {
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした（null）'
      };
    }
    
    let tasksSheet;
    try {
      tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
    } catch (sheetError) {
      Logger.log('Failed to get sheet by name in deleteTask: ' + sheetError.toString());
      return {
        error: true,
        message: 'タスクシートの取得に失敗しました: ' + sheetError.toString()
      };
    }
    
    if (!tasksSheet) {
      return {
        error: true,
        message: 'タスクシートが見つかりません'
      };
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
      return {
        error: true,
        message: 'タスクが見つかりませんでした'
      };
    }
    
    // 行を削除
    tasksSheet.deleteRow(rowIndex);
    
    return {
      success: true,
      id: taskId,
      message: 'タスクが削除されました'
    };
  } catch (error) {
    Logger.log('Error in deleteTask: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * タスクのステータスを更新
 */
function updateTaskStatus(taskId, status) {
  return updateTask(taskId, { status: status });
}

/**
 * Googleカレンダーから今週の会議予定を取得
 */
function getCalendarEvents() {
  try {
    const calendar = CalendarApp.getDefaultCalendar();
    if (!calendar) {
      return {
        error: true,
        message: 'デフォルトカレンダーが見つかりません'
      };
    }
    
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // 日曜日に設定
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);
    
    const events = calendar.getEvents(startOfWeek, endOfWeek);
    
    const eventsData = events.map(event => {
      const startTime = event.getStartTime();
      const endTime = event.getEndTime();
      const duration = (endTime - startTime) / (1000 * 60 * 60); // 時間単位
      
      return {
        title: event.getTitle(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        duration: duration,
        location: event.getLocation() || ''
      };
    });
    
    // 今週の会議時間の合計を計算
    const totalMeetingHours = eventsData.reduce((sum, event) => sum + event.duration, 0);
    
    return {
      events: eventsData,
      totalMeetingHours: totalMeetingHours,
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString()
    };
  } catch (error) {
    Logger.log('Error in getCalendarEvents: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * 体調スコアを記録（出社時）
 * ヘッダーの体調ステータスボタンから呼び出される
 */
function recordHealthScore(healthData) {
  try {
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (spreadsheetError) {
      Logger.log('Failed to get spreadsheet in recordHealthScore: ' + spreadsheetError.toString());
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした: ' + spreadsheetError.toString()
      };
    }
    
    if (!ss) {
      return {
        error: true,
        message: 'スプレッドシートを取得できませんでした（null）'
      };
    }
    
    const date = healthData.date || new Date().toISOString().split('T')[0];
    const score = healthData.score || '普通'; // 良い/普通/良くない
    
    // 日報シートに出社時体調を保存
    let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    if (!reportSheet) {
      initializeSpreadsheet();
      reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    }
    
    if (reportSheet) {
      const data = reportSheet.getDataRange().getValues();
      let found = false;
      
      // 既存の行を検索
      for (let i = 1; i < data.length; i++) {
        const rowDate = data[i][REPORT_COL_DATE];
        let rowDateStr = '';
        
        if (rowDate instanceof Date) {
          rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof rowDate === 'string') {
          rowDateStr = rowDate.split(' ')[0];
        }
        
        if (rowDateStr === date) {
          // 出社時体調を更新
          reportSheet.getRange(i + 1, REPORT_COL_ARRIVAL_HEALTH + 1).setValue(score);
          found = true;
          break;
        }
      }
      
      // 見つからない場合は新規追加
      if (!found) {
        const newRow = new Array(REPORT_COLUMN_COUNT);
        newRow[REPORT_COL_DATE] = date;
        newRow[REPORT_COL_GOAL] = '';
        newRow[REPORT_COL_ARRIVAL_HEALTH] = score;
        newRow[REPORT_COL_DEPARTURE_HEALTH] = '';
        newRow[REPORT_COL_COMPLETED_TASK_COUNT] = 0;
        newRow[REPORT_COL_COMPLETED_TASK_HOURS] = 0;
        newRow[REPORT_COL_REFLECTION] = '';
        newRow[REPORT_COL_TOMORROW_PLAN] = '';
        newRow[REPORT_COL_RECORDED_AT] = new Date();
        reportSheet.appendRow(newRow);
      }
    }
    
    
    return {
      success: true,
      date: date,
      message: '出社時体調が記録されました'
    };
  } catch (error) {
    Logger.log('Error in recordHealthScore: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * 週のタスク負荷を計算
 */
function getWeeklyWorkload() {
  try {
    const tasks = getTasks();
    
    // エラーチェック
    if (tasks.error) {
      return {
        error: true,
        message: 'タスクの取得に失敗しました: ' + tasks.message
      };
    }
    
    // tasksが配列でない場合の処理
    if (!Array.isArray(tasks)) {
      return {
        error: true,
        message: 'タスクデータの形式が正しくありません'
      };
    }
    
    const calendarData = getCalendarEvents();
    
    // カレンダーデータのエラーチェック
    if (calendarData.error) {
      // カレンダーエラーは警告として扱い、会議時間を0として続行
      Logger.log('カレンダー取得エラー: ' + calendarData.message);
    }
    
    // 未完了のタスクの見積もり時間の合計
    const activeTasks = tasks.filter(task => 
      task && task.status !== '完了' && task.status !== 'キャンセル'
    );
    const totalTaskHours = activeTasks.reduce((sum, task) => 
      sum + (parseFloat(task.estimatedHours) || 0), 0
    );
    
    // 会議時間
    const meetingHours = (calendarData.error ? 0 : (calendarData.totalMeetingHours || 0));
    
    // 合計時間
    const totalHours = totalTaskHours + meetingHours;
    
    // 余力
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
    return {
      error: true,
      message: error.toString()
    };
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
    let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      // 日報シートが存在しない場合は初期化を実行
      initializeSpreadsheet();
      reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
      if (!reportSheet) {
        return {
          error: true,
          message: '日報シートが見つかりません。初期化を実行してください。'
        };
      }
    }
    
    const data = reportSheet.getDataRange().getValues();
    let found = false;
    
    // 既存の行を検索
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][REPORT_COL_DATE];
      if (rowDate instanceof Date) {
        const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (rowDateStr === date) {
          // 既存の行を更新
          reportSheet.getRange(i + 1, REPORT_COL_GOAL + 1).setValue(goal);
          found = true;
          break;
        }
      } else if (rowDate === date) {
        reportSheet.getRange(i + 1, REPORT_COL_GOAL + 1).setValue(goal);
        found = true;
        break;
      }
    }
    
    // 見つからない場合は新規追加
    if (!found) {
      const newRow = new Array(REPORT_COLUMN_COUNT);
      newRow[REPORT_COL_DATE] = date;
      newRow[REPORT_COL_GOAL] = goal;
      newRow[REPORT_COL_ARRIVAL_HEALTH] = '';
      newRow[REPORT_COL_DEPARTURE_HEALTH] = '';
      newRow[REPORT_COL_COMPLETED_TASK_COUNT] = 0;
      newRow[REPORT_COL_COMPLETED_TASK_HOURS] = 0;
      newRow[REPORT_COL_REFLECTION] = '';
      newRow[REPORT_COL_TOMORROW_PLAN] = '';
      newRow[REPORT_COL_RECORDED_AT] = new Date();
      reportSheet.appendRow(newRow);
    }
    
    return {
      success: true,
      message: '目標が保存されました'
    };
  } catch (error) {
    Logger.log('Error in saveDailyGoal: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * 今日の目標を取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 */
function getDailyGoal(date) {
  try {
    const ss = getSpreadsheet();
    let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return ''; // シートが存在しない場合は空文字を返す
    }
    
    const data = reportSheet.getDataRange().getValues();
    
    // 日付に一致する行を検索
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][REPORT_COL_DATE];
      if (rowDate instanceof Date) {
        const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (rowDateStr === date) {
          return data[i][REPORT_COL_GOAL] || '';
        }
      } else if (rowDate === date) {
        return data[i][REPORT_COL_GOAL] || '';
      }
    }
    
    return ''; // 見つからない場合は空文字
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
    const tasks = getTasks();
    
    if (tasks.error || !Array.isArray(tasks)) {
      return {
        count: 0,
        totalHours: 0,
        tasks: []
      };
    }
    
    const today = new Date(date);
    const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // 今日完了したタスクをフィルタリング
    const completedTasks = tasks.filter(task => {
      if (task.status !== '完了') {
        return false;
      }
      
      // 更新日時が今日かどうかを確認
      if (task.updatedAt) {
        const updatedDate = new Date(task.updatedAt);
        const updatedDateStr = Utilities.formatDate(updatedDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
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
 * @param {string} reportData.healthScore - 体調スコア
 * @param {string} reportData.reflection - 振り返り
 * @param {string} reportData.tomorrowPlan - 明日の予定
 */
function recordDailyReport(reportData) {
  try {
    const ss = getSpreadsheet();
    let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      // 日報シートが存在しない場合は初期化を実行
      initializeSpreadsheet();
      reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
      if (!reportSheet) {
        return {
          error: true,
          message: '日報シートが見つかりません。初期化を実行してください。'
        };
      }
    }
    
    // 今日完了したタスクを取得
    const completedTasks = getCompletedTasksToday(reportData.date);
    
    const data = reportSheet.getDataRange().getValues();
    let found = false;
    
    // 既存の行を検索
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][REPORT_COL_DATE];
      let rowDateStr = '';
      
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string') {
        rowDateStr = rowDate.split(' ')[0]; // 日付部分のみ取得
      }
      
      if (rowDateStr === reportData.date) {
        // 既存の行を更新
        reportSheet.getRange(i + 1, REPORT_COL_GOAL + 1).setValue(reportData.goal || '');
        // 出社時体調は既存の値を保持（更新しない）
        reportSheet.getRange(i + 1, REPORT_COL_DEPARTURE_HEALTH + 1).setValue(reportData.healthScore || '');
        reportSheet.getRange(i + 1, REPORT_COL_COMPLETED_TASK_COUNT + 1).setValue(completedTasks.count || 0);
        reportSheet.getRange(i + 1, REPORT_COL_COMPLETED_TASK_HOURS + 1).setValue(completedTasks.totalHours || 0);
        reportSheet.getRange(i + 1, REPORT_COL_REFLECTION + 1).setValue(reportData.reflection || '');
        reportSheet.getRange(i + 1, REPORT_COL_TOMORROW_PLAN + 1).setValue(reportData.tomorrowPlan || '');
        reportSheet.getRange(i + 1, REPORT_COL_RECORDED_AT + 1).setValue(new Date());
        found = true;
        break;
      }
    }
    
    // 見つからない場合は新規追加
    if (!found) {
      const newRow = new Array(REPORT_COLUMN_COUNT);
      newRow[REPORT_COL_DATE] = reportData.date;
      newRow[REPORT_COL_GOAL] = reportData.goal || '';
      newRow[REPORT_COL_ARRIVAL_HEALTH] = reportData.arrivalHealthScore || '';
      newRow[REPORT_COL_DEPARTURE_HEALTH] = reportData.healthScore || '';
      newRow[REPORT_COL_COMPLETED_TASK_COUNT] = completedTasks.count || 0;
      newRow[REPORT_COL_COMPLETED_TASK_HOURS] = completedTasks.totalHours || 0;
      newRow[REPORT_COL_REFLECTION] = reportData.reflection || '';
      newRow[REPORT_COL_TOMORROW_PLAN] = reportData.tomorrowPlan || '';
      newRow[REPORT_COL_RECORDED_AT] = new Date();
      reportSheet.appendRow(newRow);
    }
    
    return {
      success: true,
      message: '日報が保存されました'
    };
  } catch (error) {
    Logger.log('Error in recordDailyReport: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

/**
 * 日報を取得
 * @param {string} date - 日付（YYYY-MM-DD形式）
 */
function getDailyReport(date) {
  try {
    const ss = getSpreadsheet();
    let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
    
    if (!reportSheet) {
      return {
        error: false,
        date: date,
        goal: '',
        arrivalHealthScore: '',
        healthScore: '', // 退社時体調
        completedTaskCount: 0,
        completedTaskHours: 0,
        reflection: '',
        tomorrowPlan: ''
      };
    }
    
    const data = reportSheet.getDataRange().getValues();
    
    // 日付に一致する行を検索
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][REPORT_COL_DATE];
      let rowDateStr = '';
      
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string') {
        rowDateStr = rowDate.split(' ')[0]; // 日付部分のみ取得
      }
      
      if (rowDateStr === date) {
        return {
          error: false,
          date: date,
          goal: data[i][REPORT_COL_GOAL] || '',
          arrivalHealthScore: data[i][REPORT_COL_ARRIVAL_HEALTH] || '',
          healthScore: data[i][REPORT_COL_DEPARTURE_HEALTH] || '',
          completedTaskCount: data[i][REPORT_COL_COMPLETED_TASK_COUNT] || 0,
          completedTaskHours: data[i][REPORT_COL_COMPLETED_TASK_HOURS] || 0,
          reflection: data[i][REPORT_COL_REFLECTION] || '',
          tomorrowPlan: data[i][REPORT_COL_TOMORROW_PLAN] || ''
        };
      }
    }
    
    // 見つからない場合は空のデータを返す
    return {
      error: false,
      date: date,
      goal: '',
      arrivalHealthScore: '',
      healthScore: '', // 退社時体調
      completedTaskCount: 0,
      completedTaskHours: 0,
      reflection: '',
      tomorrowPlan: ''
    };
  } catch (error) {
    Logger.log('Error in getDailyReport: ' + error.toString());
    return {
      error: true,
      message: error.toString()
    };
  }
}

