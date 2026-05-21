/**
 * ========================================================
 * 清酒試飲會訂單接收系統 - Google Apps Script Web App
 * ========================================================
 *
 * 功能：
 *   1. doPost(e) - 接收前端 POST 訂單，寫入三個 Sheet tabs
 *   2. doGet(e)  - 提供管理頁 HTML（也可從自訂選單開啟）
 *   3. onOpen()  - 試算表開啟時加入自訂選單
 *   4. exportCsv() - 匯出 CSV
 *
 * 部署：Deploy → New deployment → Web app → Execute as: Me, Access: Anyone
 *
 * 三個 tabs：
 *   - Orders        每筆訂單一列（含 raw JSON）
 *   - Evaluations   每筆評鑑一列（最多 7 列 / 店家）
 *   - Cart          每店每酒一列（7 列 / 店家）
 */

// ---------- 常數設定 ----------
const SHEET_ORDERS = 'Orders';
const SHEET_EVALUATIONS = 'Evaluations';
const SHEET_CART = 'Cart';

// 預期店家總數（用來算進度）
const TOTAL_VENUES = 8;

// Orders tab 欄位
const ORDERS_HEADERS = [
  'orderId', 'venue', 'completedAt', 'receivedAt',
  'totalBottles', 'motivations', 'strategies', 'ranking', 'rawJson'
];

// Evaluations tab 欄位
const EVAL_HEADERS = [
  'orderId', 'venue', 'completedAt',
  'sakeId', 'sakeName',
  'body', 'alcohol', 'intentScore',
  'aromas', 'otherAroma',
  'pairings', 'otherPairing',
  'comment'
];

// Cart tab 欄位
const CART_HEADERS = [
  'orderId', 'venue', 'completedAt',
  'sakeId', 'sakeName', 'quantity'
];

// ========================================================
// 1. POST 端點：接收前端訂單
// ========================================================
/**
 * 接收前端 POST 進來的訂單 JSON，寫入三個 tabs。
 * 回傳 JSON: { status: "ok", orderId: "..." }
 *
 * 注意：Apps Script Web App 對 CORS 的處理較特殊：
 *   - 不支援自訂 response header（無法設 Access-Control-Allow-Origin）
 *   - 但 ContentService 回傳的內容會自帶 CORS-allow，所以 fetch POST 仍可成功
 *   - 前端請用 fetch + mode: 'cors' + Content-Type: 'text/plain' (避開 preflight)
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // 取得 lock 避免並發寫入衝突（最多等 10 秒）
    lock.waitLock(10000);

    // ---- 解析 JSON ----
    if (!e || !e.postData || !e.postData.contents) {
      return _jsonResponse({ status: 'error', error: 'No postData' });
    }

    let payload;
    try {
      payload = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return _jsonResponse({
        status: 'error',
        error: 'JSON parse failed: ' + parseErr.message
      });
    }

    // ---- 欄位驗證 ----
    if (!payload.venue) {
      return _jsonResponse({ status: 'error', error: 'Missing venue' });
    }
    if (!Array.isArray(payload.evaluations)) payload.evaluations = [];
    if (!Array.isArray(payload.cart)) payload.cart = [];
    if (!Array.isArray(payload.motivations)) payload.motivations = [];
    if (!Array.isArray(payload.recommendStrategies)) payload.recommendStrategies = [];
    if (!Array.isArray(payload.ranking)) payload.ranking = [];

    // ---- 產生 orderId（時間戳 + venue hash 前 4 碼）----
    const orderId = _genOrderId(payload.venue);
    const receivedAt = new Date().toISOString();
    const completedAt = payload.completedAt || receivedAt;

    // ---- 計算總瓶數 ----
    const totalBottles = payload.cart.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0), 0
    );

    // ---- 取得三個 sheet（若不存在則建立並寫 header）----
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const ordersSheet = _getOrCreateSheet(ss, SHEET_ORDERS, ORDERS_HEADERS);
    const evalSheet = _getOrCreateSheet(ss, SHEET_EVALUATIONS, EVAL_HEADERS);
    const cartSheet = _getOrCreateSheet(ss, SHEET_CART, CART_HEADERS);

    // ---- 寫入 Orders tab（每筆訂單一列，允許同店家多筆 = 累加而非覆蓋）----
    ordersSheet.appendRow([
      orderId,
      payload.venue,
      completedAt,
      receivedAt,
      totalBottles,
      payload.motivations.join(' | '),
      payload.recommendStrategies.join(' | '),
      payload.ranking.join(' > '),
      JSON.stringify(payload)
    ]);

    // ---- 寫入 Evaluations tab（每個評鑑一列）----
    payload.evaluations.forEach(ev => {
      evalSheet.appendRow([
        orderId,
        payload.venue,
        completedAt,
        ev.sakeId || '',
        ev.sakeName || '',
        ev.body || '',
        ev.alcohol || '',
        ev.intentScore || '',
        Array.isArray(ev.aromas) ? ev.aromas.join(' / ') : '',
        ev.otherAroma || '',
        Array.isArray(ev.pairings) ? ev.pairings.join(' / ') : '',
        ev.otherPairing || '',
        ev.comment || ''
      ]);
    });

    // ---- 寫入 Cart tab（每店每酒一列，包含 quantity=0 也記錄）----
    payload.cart.forEach(item => {
      // 從 evaluations 中找 sakeName（cart 通常只給 sakeId+quantity）
      const matched = payload.evaluations.find(ev => ev.sakeId === item.sakeId);
      cartSheet.appendRow([
        orderId,
        payload.venue,
        completedAt,
        item.sakeId || '',
        matched ? matched.sakeName : (item.sakeName || ''),
        Number(item.quantity) || 0
      ]);
    });

    return _jsonResponse({ status: 'ok', orderId: orderId });

  } catch (err) {
    // 任何寫入失敗都回 error，方便前端 retry
    return _jsonResponse({
      status: 'error',
      error: String(err && err.message ? err.message : err)
    });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ========================================================
// 2. GET 端點：管理頁（也可從選單開）
// ========================================================
function doGet(e) {
  return HtmlService.createHtmlOutput(_renderDashboardHtml())
    .setTitle('🍶 清酒試飲會 - 主辦人儀表板')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ========================================================
// 3. 試算表自訂選單
// ========================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🍶 清酒試飲會')
    .addItem('📊 查看儀表板', 'showDashboard')
    .addItem('📥 匯出 Cart CSV', 'exportCartCsv')
    .addItem('📥 匯出 Evaluations CSV', 'exportEvalCsv')
    .addSeparator()
    .addItem('🧪 測試 doPost (假資料)', 'testDoPost')
    .addToUi();
}

/**
 * 從選單點開儀表板：跳出 modal
 */
function showDashboard() {
  const html = HtmlService.createHtmlOutput(_renderDashboardHtml())
    .setWidth(1100)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, '🍶 清酒試飲會儀表板');
}

// ========================================================
// 4. 儀表板資料聚合
// ========================================================
/**
 * 聚合三張表，回傳所有儀表板需要的數字。
 * 由 HTML 中的 google.script.run 呼叫。
 */
function getDashboardData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const orders = _readSheet(ss, SHEET_ORDERS, ORDERS_HEADERS);
  const evals = _readSheet(ss, SHEET_EVALUATIONS, EVAL_HEADERS);
  const carts = _readSheet(ss, SHEET_CART, CART_HEADERS);

  // 已下單店家（去重）
  const venueSet = {};
  orders.forEach(o => { if (o.venue) venueSet[o.venue] = true; });
  const venuesSubmitted = Object.keys(venueSet);

  // 各酒款累積瓶數 + 平均意願分
  const sakeAgg = {};
  carts.forEach(c => {
    const id = c.sakeId;
    if (!id) return;
    if (!sakeAgg[id]) {
      sakeAgg[id] = {
        sakeId: id, sakeName: c.sakeName,
        totalBottles: 0, intentSum: 0, intentCount: 0, avgIntent: 0
      };
    }
    sakeAgg[id].totalBottles += Number(c.quantity) || 0;
  });
  evals.forEach(ev => {
    const id = ev.sakeId;
    if (!id) return;
    if (!sakeAgg[id]) {
      sakeAgg[id] = {
        sakeId: id, sakeName: ev.sakeName,
        totalBottles: 0, intentSum: 0, intentCount: 0, avgIntent: 0
      };
    }
    const score = Number(ev.intentScore);
    if (!isNaN(score) && score > 0) {
      sakeAgg[id].intentSum += score;
      sakeAgg[id].intentCount += 1;
    }
  });
  // 計算 avg
  Object.values(sakeAgg).forEach(s => {
    s.avgIntent = s.intentCount > 0
      ? Math.round((s.intentSum / s.intentCount) * 10) / 10
      : 0;
  });
  const sakeRanking = Object.values(sakeAgg).sort(
    (a, b) => b.totalBottles - a.totalBottles
  );

  // 各店家清單（venue, totalBottles, completedAt）
  const venueAgg = {};
  carts.forEach(c => {
    if (!c.venue) return;
    if (!venueAgg[c.venue]) {
      venueAgg[c.venue] = {
        venue: c.venue, totalBottles: 0,
        completedAt: c.completedAt, items: []
      };
    }
    venueAgg[c.venue].totalBottles += Number(c.quantity) || 0;
    if (Number(c.quantity) > 0) {
      venueAgg[c.venue].items.push({
        sakeName: c.sakeName, quantity: Number(c.quantity)
      });
    }
  });
  const venueList = Object.values(venueAgg).sort(
    (a, b) => b.totalBottles - a.totalBottles
  );

  // 評語牆（過濾掉空評語）
  const comments = evals
    .filter(ev => ev.comment && String(ev.comment).trim())
    .map(ev => ({
      venue: ev.venue,
      sakeName: ev.sakeName,
      intentScore: ev.intentScore,
      comment: ev.comment
    }));

  return {
    summary: {
      venuesSubmitted: venuesSubmitted.length,
      totalVenues: TOTAL_VENUES,
      totalOrders: orders.length,
      totalBottles: carts.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    },
    sakeRanking: sakeRanking,
    venueList: venueList,
    comments: comments
  };
}

// ========================================================
// 5. CSV 匯出
// ========================================================
function exportCartCsv() { _exportCsv(SHEET_CART); }
function exportEvalCsv() { _exportCsv(SHEET_EVALUATIONS); }

function _exportCsv(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('找不到 sheet: ' + sheetName);
    return;
  }
  const data = sheet.getDataRange().getValues();
  const csv = data.map(row =>
    row.map(cell => {
      const s = String(cell == null ? '' : cell);
      // CSV escape: 含逗號/雙引號/換行 → 用 " 包起來
      if (/[",\n]/.test(s)) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',')
  ).join('\n');

  const blob = Utilities.newBlob(csv, 'text/csv',
    sheetName + '_' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd_HHmm') + '.csv'
  );
  // 存到 Drive 根目錄，並彈視窗給連結
  const file = DriveApp.createFile(blob);
  const ui = SpreadsheetApp.getUi();
  ui.alert('CSV 已匯出',
    '檔案：' + file.getName() + '\n\n下載連結：\n' + file.getUrl(),
    ui.ButtonSet.OK);
}

// ========================================================
// 6. 測試輔助
// ========================================================
/**
 * 從選單點「測試 doPost」可送一筆假資料進來，驗證寫入正常。
 */
function testDoPost() {
  const fake = {
    postData: {
      contents: JSON.stringify({
        venue: '【測試】鮨一田',
        completedAt: new Date().toISOString(),
        evaluations: [
          {
            sakeId: 1, sakeName: '加佐一陽 CASARECCIO',
            aromas: ['🍎 蘋果', '🍋 柑橘'], otherAroma: '玉米鬚',
            body: 3, alcohol: 2,
            pairings: ['生食海鮮/壽司'], otherPairing: '',
            comment: '酸度很漂亮（測試）', intentScore: 8
          }
        ],
        cart: [
          { sakeId: 1, quantity: 3 },
          { sakeId: 2, quantity: 0 }
        ],
        motivations: ['完美契合本店招牌菜'],
        recommendStrategies: ['推薦自己(主理人)私心喜歡的'],
        ranking: ['料理搭配性', '主理人偏好', '價格設定']
      })
    }
  };
  const result = doPost(fake);
  SpreadsheetApp.getUi().alert('測試結果', result.getContent(),
    SpreadsheetApp.getUi().ButtonSet.OK);
}

// ========================================================
// 7. Helper functions
// ========================================================
function _jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _genOrderId(venue) {
  const ts = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMddHHmmss');
  const hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, venue + ts
  ).slice(0, 2).map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
  return ts + '-' + hash;
}

function _getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#f3f3f3');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _readSheet(ss, name, headers) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const rows = data.slice(1);
  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });
}

// ========================================================
// 8. 儀表板 HTML
// ========================================================
function _renderDashboardHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <base target="_top">
  <style>
    body { font-family: -apple-system, "PingFang TC", "Helvetica Neue", sans-serif; margin: 0; padding: 20px; background: #fafafa; color: #222; }
    h1 { font-size: 20px; margin: 0 0 16px; }
    h2 { font-size: 15px; margin: 24px 0 8px; color: #555; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    .card { background: white; padding: 14px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .card .num { font-size: 28px; font-weight: 700; color: #c9302c; }
    .card .label { font-size: 12px; color: #888; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.08); font-size: 13px; }
    th { background: #f3f3f3; padding: 8px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-top: 1px solid #eee; }
    .qty-bar { display: inline-block; height: 14px; background: #c9302c; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
    .badge { display: inline-block; padding: 2px 8px; background: #eef; border-radius: 12px; font-size: 11px; margin-right: 4px; }
    .comment-row { padding: 10px 12px; border-top: 1px solid #eee; background: white; }
    .comment-row .venue-tag { display: inline-block; padding: 2px 8px; background: #fef3c7; color: #92400e; border-radius: 12px; font-size: 11px; margin-right: 8px; }
    .comment-row .sake-tag { display: inline-block; padding: 2px 8px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; margin-right: 8px; }
    .comment-row .score { color: #c9302c; font-weight: 600; font-size: 12px; }
    .empty { color: #aaa; padding: 12px; }
    .loading { text-align: center; padding: 40px; color: #888; }
    button { background: #c9302c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; margin-right: 8px; }
    button:hover { background: #ac2925; }
  </style>
</head>
<body>
  <h1>🍶 清酒試飲會 - 主辦人儀表板</h1>
  <div>
    <button onclick="loadData()">🔄 重新整理</button>
    <button onclick="google.script.run.exportCartCsv()">📥 匯出 Cart CSV</button>
    <button onclick="google.script.run.exportEvalCsv()">📥 匯出 Evaluations CSV</button>
  </div>

  <div id="loading" class="loading">載入中...</div>
  <div id="content" style="display:none;">
    <h2>📊 總覽</h2>
    <div class="cards" id="summary-cards"></div>

    <h2>🍶 各酒款累積瓶數 / 平均意願</h2>
    <table>
      <thead><tr><th>#</th><th>酒款</th><th>累積瓶數</th><th>平均意願分</th><th>評鑑人數</th></tr></thead>
      <tbody id="sake-rank"></tbody>
    </table>

    <h2>🏪 店家下單列表</h2>
    <table>
      <thead><tr><th>店家</th><th>總瓶數</th><th>下單內容</th><th>完成時間</th></tr></thead>
      <tbody id="venue-list"></tbody>
    </table>

    <h2>💬 評語牆 (<span id="comment-count">0</span>)</h2>
    <div id="comments"></div>
  </div>

  <script>
    function loadData() {
      document.getElementById('loading').style.display = 'block';
      document.getElementById('content').style.display = 'none';
      google.script.run
        .withSuccessHandler(render)
        .withFailureHandler(err => {
          document.getElementById('loading').innerHTML = '載入失敗: ' + err.message;
        })
        .getDashboardData();
    }

    function render(data) {
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';

      // 總覽卡片
      const s = data.summary;
      document.getElementById('summary-cards').innerHTML = [
        ['已下單店家', s.venuesSubmitted + ' / ' + s.totalVenues],
        ['訂單筆數', s.totalOrders],
        ['累積總瓶數', s.totalBottles],
        ['酒款數', data.sakeRanking.length]
      ].map(([label, num]) =>
        '<div class="card"><div class="num">' + num + '</div><div class="label">' + label + '</div></div>'
      ).join('');

      // 酒款排名
      const maxBottles = Math.max(1, ...data.sakeRanking.map(s => s.totalBottles));
      document.getElementById('sake-rank').innerHTML = data.sakeRanking.length
        ? data.sakeRanking.map((s, i) =>
            '<tr>' +
              '<td>' + (i + 1) + '</td>' +
              '<td>' + escapeHtml(s.sakeName) + '</td>' +
              '<td><span class="qty-bar" style="width:' + (s.totalBottles / maxBottles * 100) + 'px"></span> <strong>' + s.totalBottles + '</strong> 瓶</td>' +
              '<td>' + (s.avgIntent || '-') + ' / 10</td>' +
              '<td>' + s.intentCount + ' 人</td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="5" class="empty">尚無資料</td></tr>';

      // 店家列表
      document.getElementById('venue-list').innerHTML = data.venueList.length
        ? data.venueList.map(v =>
            '<tr>' +
              '<td><strong>' + escapeHtml(v.venue) + '</strong></td>' +
              '<td>' + v.totalBottles + ' 瓶</td>' +
              '<td>' + (v.items.length
                ? v.items.map(it => '<span class="badge">' + escapeHtml(it.sakeName) + ' ×' + it.quantity + '</span>').join('')
                : '<span class="empty">無下單</span>') + '</td>' +
              '<td>' + formatTime(v.completedAt) + '</td>' +
            '</tr>'
          ).join('')
        : '<tr><td colspan="4" class="empty">尚無店家下單</td></tr>';

      // 評語牆
      document.getElementById('comment-count').textContent = data.comments.length;
      document.getElementById('comments').innerHTML = data.comments.length
        ? data.comments.map(c =>
            '<div class="comment-row">' +
              '<span class="venue-tag">' + escapeHtml(c.venue) + '</span>' +
              '<span class="sake-tag">' + escapeHtml(c.sakeName) + '</span>' +
              '<span class="score">意願 ' + c.intentScore + '/10</span>' +
              '<div style="margin-top:6px;">' + escapeHtml(c.comment) + '</div>' +
            '</div>'
          ).join('')
        : '<div class="empty">尚無評語</div>';
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function formatTime(s) {
      if (!s) return '-';
      try {
        const d = new Date(s);
        return d.toLocaleString('zh-TW', { hour12: false });
      } catch (e) { return String(s); }
    }

    loadData();
  </script>
</body>
</html>
  `;
}
