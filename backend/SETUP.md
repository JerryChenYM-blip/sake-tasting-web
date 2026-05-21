# 清酒試飲會後端部署教學

零成本架構：**Google Sheets + Apps Script Web App**
無需伺服器、無需網域、Apps Script 每天 20K 次配額，16 人試飲完全綽綽有餘。

預計部署時間：**10 分鐘**

---

## 架構總覽

```
[ 前端靜態頁面 ]  ──POST JSON──►  [ Apps Script Web App (doPost) ]
                                            │
                                            ▼
                              [ Google Sheet (3 tabs) ]
                                  Orders / Evaluations / Cart
                                            │
                                            ▼
                                  [ 主辦人儀表板 HTML ]
                                  （自訂選單彈出 modal）
```

---

## 步驟 1：新建 Google Sheet

1. 開啟 https://sheets.google.com → 新增空白試算表
2. 命名為 **「清酒試飲會 2026」**（隨意，但要記得）
3. 不需要預先建 tabs — 第一次 POST 進來時 Apps Script 會自動建立 `Orders` / `Evaluations` / `Cart` 三個 tab 並寫入 header。

> [Screenshot placeholder: 新建空白試算表，命名]

---

## 步驟 2：貼上 Apps Script 程式碼

1. 在試算表選單列：**Extensions → Apps Script**
2. 會跳出 Apps Script 編輯器，預設有一個 `Code.gs` 檔案
3. **刪掉預設內容**，把 `code.gs` 整份內容貼進去
4. 左上專案名稱改成 **「清酒試飲會 - 訂單後端」**
5. 按 **💾 儲存（Ctrl+S / Cmd+S）**

> [Screenshot placeholder: Apps Script 編輯器，貼上 code.gs]

> [Screenshot placeholder: 儲存後左側檔案樹]

---

## 步驟 3：部署為 Web App

1. 右上角點 **「Deploy」→「New deployment」**
2. 點齒輪圖示，選 **「Web app」**
3. 設定如下：
   - **Description**: 清酒試飲會 v1
   - **Execute as**: **Me (你的 Google 帳號)** ← 必須是 Me，這樣才能寫入你的 Sheet
   - **Who has access**: **Anyone** ← 必須是 Anyone（含未登入），前端才能 POST
4. 點 **「Deploy」**
5. 第一次部署會跳「Authorization required」：
   - 點 **「Authorize access」**
   - 選你的 Google 帳號
   - 出現「Google hasn't verified this app」警告 → 點下方 **「Advanced」→「Go to 清酒試飲會 (unsafe)」**
   - 同意所有權限（Sheets / Drive / 顯示對話框等）
6. 部署成功 → 複製 **Web app URL**（長得像 `https://script.google.com/macros/s/AKfy.../exec`）

> [Screenshot placeholder: Deploy 設定畫面]

> [Screenshot placeholder: Authorization 警告畫面，點 Advanced]

> [Screenshot placeholder: 部署完成顯示 Web App URL]

**⚠️ 重要**：之後若改 code.gs，要 **「Manage deployments」→ 編輯現有 deployment → New version**，
**不要** 每次都 New deployment（URL 會變）。

---

## 步驟 4：把 URL 貼到前端

打開 `backend/frontend_integration.js`，找到：

```js
window.SAKE_ORDER_ENDPOINT = window.SAKE_ORDER_ENDPOINT || "PASTE_YOUR_WEB_APP_URL_HERE";
```

把 `PASTE_YOUR_WEB_APP_URL_HERE` 換成步驟 3 複製的 URL，例如：

```js
window.SAKE_ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfy.../exec";
```

> 也可以直接在 HTML 頁面 `<script>` 內覆寫 `window.SAKE_ORDER_ENDPOINT`，這樣不用動 helper 檔案。

---

## 步驟 5：測試

### 5a. 從 Apps Script 直接測試（最快）

1. 回到 **試算表頁面**（不是 Apps Script 編輯器）
2. **重新整理一次頁面**（讓 `onOpen()` 觸發、建立自訂選單）
3. 選單列應該多出 **「🍶 清酒試飲會」**
4. 點 **「🍶 清酒試飲會」→「🧪 測試 doPost (假資料)」**
5. 跳出 `{"status":"ok","orderId":"..."}` 視窗 → 成功！
6. 切換到 `Orders` / `Evaluations` / `Cart` tab，應該各有 1 / 1 / 2 列假資料

> [Screenshot placeholder: 自訂選單「🍶 清酒試飲會」]

> [Screenshot placeholder: 三個 tab 都有資料]

### 5b. 從前端測試

在前端頁面 console 跑：

```js
await submitOrder({
  venue: "前端測試店",
  evaluations: [{sakeId: 1, sakeName: "酒A", intentScore: 8, comment: "test"}],
  cart: [{sakeId: 1, quantity: 2}]
});
// 應該回傳 {status: "ok", orderId: "..."}
```

如果回 `error: "Failed to fetch"`：
- 確認 Web App URL 正確
- 確認 deployment 的 Access 是 **Anyone**

### 5c. 開啟儀表板

回試算表 → 選單列 **「🍶 清酒試飲會」→「📊 查看儀表板」**

會彈出 modal，顯示：
- 已下單店家數 / 8
- 各酒款累積瓶數（從高到低）
- 每款酒平均意願分
- 各店家下單清單
- 評語牆

> [Screenshot placeholder: 儀表板 modal]

---

## 步驟 6：匯出 CSV

選單 → **「📥 匯出 Cart CSV」** 或 **「📥 匯出 Evaluations CSV」**

CSV 會存到你 Google Drive 根目錄，跳視窗給連結。

---

## 常見問題

### Q: 前端 POST 卡在 CORS 錯誤？

A: 確認 `frontend_integration.js` 用 `Content-Type: text/plain`（不是 `application/json`）。
這樣會被瀏覽器視為 simple request，不會觸發 preflight OPTIONS。
Apps Script Web App 本身不支援 OPTIONS。

### Q: 想改 code.gs 怎麼辦？

A: 編輯後存檔 → **Deploy → Manage deployments** → 找到現有 deployment → 鉛筆編輯 →
**Version: New version** → Deploy。**URL 不會變**，前端不用改。

### Q: 同一店家下單兩次怎辦？

A: 系統會在 Orders tab 累加（不覆蓋）。每筆有獨立的 `orderId`，儀表板會把同店家的 cart 加總顯示。
若要刪除測試資料，直接在 Sheet 手動刪列即可。

### Q: 配額會爆嗎？

A: Apps Script 免費帳號每天 20,000 次呼叫。16 人 × 假設每人重送 3 次 = 48 次，遠低於上限。
Sheet 寫入也沒有單日上限（單格容量 50,000 字元也綽綽）。

### Q: 主辦人需要手動做的事？

只有兩件：
1. **試算表開過一次後**，自訂選單才會出現（onOpen 觸發）
2. **第一次部署時授權**那一次警告，要點 Advanced → Go to unsafe（Google 沒驗證 app）

之後完全自動，不用碰。

---

## 檔案清單

```
backend/
├── code.gs                 ← 貼到 Apps Script
├── SETUP.md                ← 本檔
├── frontend_integration.js ← 前端引入
└── sample_payload.json     ← 測試用 JSON
```
