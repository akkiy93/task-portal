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
const SHEET_NAME_HEALTH = '体調';
const SHEET_NAME_REPORT = '日報';

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
  
  // タスクシートの作成
  let tasksSheet = ss.getSheetByName(SHEET_NAME_TASKS);
  if (!tasksSheet) {
    tasksSheet = ss.insertSheet(SHEET_NAME_TASKS);
    // ヘッダー行を設定
    tasksSheet.getRange(1, 1, 1, 8).setValues([[
      'ID', 'タイトル', '説明', '見積もり時間（時間）', '優先度', 'ステータス', '作成日時', '更新日時'
    ]]);
    tasksSheet.getRange(1, 1, 1, 8).setFontWeight('bold');
    tasksSheet.setFrozenRows(1);
  }
  
  // 体調シートの作成
  let healthSheet = ss.getSheetByName(SHEET_NAME_HEALTH);
  if (!healthSheet) {
    healthSheet = ss.insertSheet(SHEET_NAME_HEALTH);
    // ヘッダー行を設定
    healthSheet.getRange(1, 1, 1, 4).setValues([[
      '日付', '体調スコア', 'メモ', '記録日時'
    ]]);
    healthSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    healthSheet.setFrozenRows(1);
  }
  
  // 日報シートの作成
  let reportSheet = ss.getSheetByName(SHEET_NAME_REPORT);
  if (!reportSheet) {
    reportSheet = ss.insertSheet(SHEET_NAME_REPORT);
    // ヘッダー行を設定
    reportSheet.getRange(1, 1, 1, 9).setValues([[
      '日付', '目標', '出社時体調', '退社時体調', '完了タスク数', '完了タスク時間合計', '振り返り', '明日の予定', '記録日時'
    ]]);
    reportSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    reportSheet.setFrozenRows(1);
  } else {
    // 既存のシートがある場合、列数を確認して必要に応じて更新
    const headers = reportSheet.getRange(1, 1, 1, reportSheet.getLastColumn()).getValues()[0];
    if (headers.length < 9 || headers[2] !== '出社時体調' || headers[3] !== '退社時体調') {
      // 古い形式の場合は列を追加
      if (headers.length === 8 && headers[2] === '体調スコア') {
        // 体調スコア列を出社時体調と退社時体調に分割
        reportSheet.insertColumnAfter(3); // 3列目の後に列を挿入
        reportSheet.getRange(1, 3).setValue('出社時体調');
        reportSheet.getRange(1, 4).setValue('退社時体調');
        // 既存の体調スコアデータを出社時体調に移動（退社時体調は空）
        const lastRow = reportSheet.getLastRow();
        if (lastRow > 1) {
          const oldHealthData = reportSheet.getRange(2, 3, lastRow - 1, 1).getValues();
          reportSheet.getRange(2, 3, lastRow - 1, 1).setValues(oldHealthData);
          reportSheet.getRange(2, 4, lastRow - 1, 1).setValue(''); // 退社時体調は空
        }
      }
    }
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
    
    const data = tasksSheet.getDataRange().getValues();
    
    // ヘッダー行をスキップ
    if (data.length <= 1) {
      return [];
    }
    
    const tasks = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) { // IDが存在する場合のみ
        tasks.push({
          id: row[0],
          title: row[1] || '',
          description: row[2] || '',
          estimatedHours: row[3] || 0,
          priority: row[4] || '中',
          status: row[5] || '未着手',
          createdAt: row[6] || '',
          updatedAt: row[7] || ''
        });
      }
    }
    
    return tasks;
  } catch (error) {
    Logger.log('Error in getTasks: ' + error.toString());
    Logger.log('Error stack: ' + (error.stack || 'No stack trace'));
    return {
      error: true,
      message: 'タスクの取得中にエラーが発生しました: ' + error.toString()
    };
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
      const ids = data.slice(1).map(row => parseInt(row[0]) || 0);
      newId = Math.max(...ids, 0) + 1;
    }
    
    const now = new Date();
    const newRow = [
      newId,
      taskData.title || '',
      taskData.description || '',
      parseFloat(taskData.estimatedHours) || 0,
      taskData.priority || '中',
      taskData.status || '未着手',
      now.toISOString(),
      now.toISOString()
    ];
    
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
      if (parseInt(data[i][0]) === parseInt(taskId)) {
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
    const updatedRow = [
      existingRow[0], // IDは変更しない
      taskData.title !== undefined ? taskData.title : existingRow[1],
      taskData.description !== undefined ? taskData.description : existingRow[2],
      taskData.estimatedHours !== undefined ? parseFloat(taskData.estimatedHours) : existingRow[3],
      taskData.priority !== undefined ? taskData.priority : existingRow[4],
      taskData.status !== undefined ? taskData.status : existingRow[5],
      existingRow[6], // 作成日時は変更しない
      now.toISOString() // 更新日時を更新
    ];
    
    // 行を更新
    tasksSheet.getRange(rowIndex, 1, 1, 8).setValues([updatedRow]);
    
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
      if (parseInt(data[i][0]) === parseInt(taskId)) {
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
        const rowDate = data[i][0];
        let rowDateStr = '';
        
        if (rowDate instanceof Date) {
          rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof rowDate === 'string') {
          rowDateStr = rowDate.split(' ')[0];
        }
        
        if (rowDateStr === date) {
          // 出社時体調を更新（3列目）
          reportSheet.getRange(i + 1, 3).setValue(score);
          found = true;
          break;
        }
      }
      
      // 見つからない場合は新規追加
      if (!found) {
        const newRow = [
          date,
          '', // 目標
          score, // 出社時体調
          '', // 退社時体調
          0,  // 完了タスク数
          0,  // 完了タスク時間合計
          '', // 振り返り
          '', // 明日の予定
          new Date() // 記録日時
        ];
        reportSheet.appendRow(newRow);
      }
    }
    
    // 体調シートにも記録（後方互換性のため）
    let healthSheet;
    try {
      healthSheet = ss.getSheetByName(SHEET_NAME_HEALTH);
    } catch (sheetError) {
      Logger.log('Failed to get sheet by name in recordHealthScore: ' + sheetError.toString());
    }
    
    if (healthSheet) {
      const memo = healthData.memo || '';
      const now = new Date();
      
      // 同じ日付の記録があるか確認
      const data = healthSheet.getDataRange().getValues();
      let rowIndex = -1;
      for (let i = 1; i < data.length; i++) {
        const recordDate = data[i][0];
        if (recordDate && recordDate.toString() === date) {
          rowIndex = i + 1;
          break;
        }
      }
      
      const newRow = [
        date,
        score,
        memo,
        now.toISOString()
      ];
      
      if (rowIndex > 0) {
        // 既存の記録を更新
        healthSheet.getRange(rowIndex, 1, 1, 4).setValues([newRow]);
      } else {
        // 新しい記録を追加
        healthSheet.appendRow(newRow);
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
 * 体調スコアを取得
 */
function getHealthScores(startDate, endDate) {
  try {
    let ss;
    try {
      ss = getSpreadsheet();
    } catch (spreadsheetError) {
      Logger.log('Failed to get spreadsheet in getHealthScores: ' + spreadsheetError.toString());
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
    
    let healthSheet;
    try {
      healthSheet = ss.getSheetByName(SHEET_NAME_HEALTH);
    } catch (sheetError) {
      Logger.log('Failed to get sheet by name in getHealthScores: ' + sheetError.toString());
      return {
        error: true,
        message: '体調シートの取得に失敗しました: ' + sheetError.toString()
      };
    }
    
    if (!healthSheet) {
      return [];
    }
    
    const data = healthSheet.getDataRange().getValues();
    const healthScores = [];
    
    // ヘッダー行をスキップ
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[0]) {
        const recordDate = new Date(row[0]);
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        
        // 日付範囲のフィルタリング
        if (start && recordDate < start) continue;
        if (end && recordDate > end) continue;
        
        healthScores.push({
          date: row[0],
          score: row[1] || '普通',
          memo: row[2] || '',
          recordedAt: row[3] || ''
        });
      }
    }
    
    return healthScores;
  } catch (error) {
    Logger.log('Error in getHealthScores: ' + error.toString());
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
    
    // 既存の行を検索（日付列は1列目、インデックス0）
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][0];
      if (rowDate instanceof Date) {
        const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (rowDateStr === date) {
          // 既存の行を更新（目標列は2列目、インデックス1）
          reportSheet.getRange(i + 1, 2).setValue(goal);
          found = true;
          break;
        }
      } else if (rowDate === date) {
        reportSheet.getRange(i + 1, 2).setValue(goal);
        found = true;
        break;
      }
    }
    
    // 見つからない場合は新規追加
    if (!found) {
      const newRow = [
        date,
        goal,
        '', // 体調スコア
        0,  // 完了タスク数
        0,  // 完了タスク時間合計
        '', // 振り返り
        '', // 明日の予定
        new Date() // 記録日時
      ];
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
      const rowDate = data[i][0];
      if (rowDate instanceof Date) {
        const rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        if (rowDateStr === date) {
          return data[i][1] || ''; // 目標列（2列目、インデックス1）
        }
      } else if (rowDate === date) {
        return data[i][1] || '';
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
    
    // 既存の行を検索（日付列は1列目、インデックス0）
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][0];
      let rowDateStr = '';
      
      if (rowDate instanceof Date) {
        rowDateStr = Utilities.formatDate(rowDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof rowDate === 'string') {
        rowDateStr = rowDate.split(' ')[0]; // 日付部分のみ取得
      }
      
      if (rowDateStr === reportData.date) {
        // 既存の行を更新
        reportSheet.getRange(i + 1, 2).setValue(reportData.goal || ''); // 目標
        // 出社時体調は既存の値を保持（更新しない）
        // reportSheet.getRange(i + 1, 3).setValue(reportData.arrivalHealthScore || ''); // 出社時体調
        reportSheet.getRange(i + 1, 4).setValue(reportData.healthScore || ''); // 退社時体調
        reportSheet.getRange(i + 1, 5).setValue(completedTasks.count || 0); // 完了タスク数
        reportSheet.getRange(i + 1, 6).setValue(completedTasks.totalHours || 0); // 完了タスク時間合計
        reportSheet.getRange(i + 1, 7).setValue(reportData.reflection || ''); // 振り返り
        reportSheet.getRange(i + 1, 8).setValue(reportData.tomorrowPlan || ''); // 明日の予定
        reportSheet.getRange(i + 1, 9).setValue(new Date()); // 記録日時
        found = true;
        break;
      }
    }
    
    // 見つからない場合は新規追加
    if (!found) {
      const newRow = [
        reportData.date,
        reportData.goal || '',
        reportData.arrivalHealthScore || '', // 出社時体調
        reportData.healthScore || '', // 退社時体調
        completedTasks.count || 0,
        completedTasks.totalHours || 0,
        reportData.reflection || '',
        reportData.tomorrowPlan || '',
        new Date() // 記録日時
      ];
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
        healthScore: '',
        completedTaskCount: 0,
        completedTaskHours: 0,
        reflection: '',
        tomorrowPlan: ''
      };
    }
    
    const data = reportSheet.getDataRange().getValues();
    
    // 日付に一致する行を検索
    for (let i = 1; i < data.length; i++) {
      const rowDate = data[i][0];
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
          goal: data[i][1] || '',
          healthScore: data[i][2] || '',
          completedTaskCount: data[i][3] || 0,
          completedTaskHours: data[i][4] || 0,
          reflection: data[i][5] || '',
          tomorrowPlan: data[i][6] || ''
        };
      }
    }
    
    // 見つからない場合は空のデータを返す
    return {
      error: false,
      date: date,
      goal: '',
      healthScore: '',
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

