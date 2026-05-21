# 🍶 Sake Tasting Web — 清酒試飲會互動式網頁

> 為 16 人專業日料試飲會打造的 mobile-first 互動體驗網站。
> 引導品飲 → 收集評鑑 → 現場下單 → 即時統計，一條龍。

![tech](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![tech](https://img.shields.io/badge/Tailwind-CDN-06B6D4?logo=tailwindcss)
![tech](https://img.shields.io/badge/backend-Google%20Apps%20Script-4285F4?logo=google)
![tech](https://img.shields.io/badge/no--build-vanilla%20HTML-orange)

---

## 📋 這個專案是什麼？

一場下週一在台中舉辦的清酒試飲會用的互動網頁。
9 間高端日料店共 16 位主理人，現場一邊試飲、一邊用手機在這個網站上：

1. **選擇主理店家**（8 間預設店家）
2. **走完 7 款清酒的品飲流程**
   - 每款酒有獨立的「舞台」 — 真實酒瓶照片 + 偽 3D 視差效果 + 開瓶音效
   - 五個資訊面板：酒造故事 / 香氣定位（SSI 4 象限）/ 飲用口感（酒度）/ 餐點搭配 / 產區介紹
3. **完成 5 步驟評鑑儀式**（香氣、酒體、酒精、餐配、評語+評分）
4. **餐飲場景討論題**（給每位主理人開啟談話）
5. **採購單下單**（瓶數 + 進貨動機 + 推薦策略 + 排序）
6. **即時統計牆**（活動結束時看全場結果）

訂單資料會傳到 Google Sheet，主辦人可以即時看到誰下了什麼。

---

## 🎯 快速開始（5 分鐘看到網站）

### 你需要的東西

| 工具 | 用途 | 取得方式 |
|---|---|---|
| `git` | 下載專案 | macOS 內建 / [git-scm.com](https://git-scm.com/) |
| `python3` | 本機跑伺服器 | macOS 內建 / [python.org](https://python.org/) |
| 任何瀏覽器 | 看網站 | Chrome / Safari / Firefox 都可以 |

> 💡 **不需要** Node.js / npm / yarn / build step。這是純靜態網站，所有依賴都從 CDN 載。

### 三行指令啟動

```bash
# 1. 複製專案
git clone https://github.com/JerryChenYM-blip/sake-tasting-web.git
cd sake-tasting-web

# 2. 啟動本機伺服器（任選一行）
python3 -m http.server 8765 --directory public
# 或 npx serve public -l 8765
# 或 php -S localhost:8765 -t public

# 3. 開瀏覽器
open http://localhost:8765/
```

成功的話，你會看到「**今日試飲酒款**」首頁，請你選店家。

> ⚠️ **不要直接雙擊 `public/index.html`**。瀏覽器的 `file://` 安全限制會擋掉 `fetch('./sake_data.json')`，畫面會空白。一定要透過 `http://localhost:8765/` 開。

---

## 📱 用手機測試（推薦，因為這是 mobile-first 設計）

1. 電腦跑著 `python3 -m http.server 8765 --directory public`
2. 確認電腦跟手機**連到同一個 Wi-Fi**
3. 在電腦終端機查 IP：
   ```bash
   ipconfig getifaddr en0     # 通常 Wi-Fi
   # 或
   ipconfig getifaddr en1
   ```
   會看到類似 `192.168.1.42`
4. 手機開瀏覽器，輸入 `http://192.168.1.42:8765/`（把 IP 換成你的）
5. iPhone 第一次點酒瓶會跳「動作與方向存取」權限請求 → 請允許，才能體驗陀螺儀視差效果

### 走完整體驗的建議路徑

| 步驟 | 重點測試什麼 |
|---|---|
| 1. 選店家 | 8 間，挑一間 |
| 2. 看 #01 加佐一陽 CASARECCIO | **點酒瓶** — 看震動、瓶蓋飛出、氣泡、聽「啵」聲 |
| 3. 點五個資訊按鈕 | 故事 / 香氣（SSI 4 象限光點）/ 口感（酒度條）/ 搭配 / 產區 |
| 4. 點「開始評鑑儀式」 | 5 步驟，每步有 30 秒倒數但不強制 |
| 5. 場景討論題 | 算是節奏休息 |
| 6. 跳到下一款 | 連續走完 7 款 |
| 7. 採購單 | 每款瓶數 + 動機/策略/排序 |
| 8. 統計牆 | 標註「示意」的 mock 數據 |

### 試試這些細節

- 👉 **觸碰酒瓶** — 光斑會跟著手指走
- 📱 **傾斜手機** — 酒瓶會有 3-5 度視差跟動（陀螺儀）
- 🔄 **重新整理頁面** — `localStorage` 會記住你選的店家跟已完成的評鑑（同一天有效）
- 🔇 **每個按鈕都有 Web Audio 合成音效** — 注意聽

---

## 🗂️ 專案結構

```
sake-tasting-web/
├── public/                    ← 網站根目錄（部署這個資料夾就好）
│   ├── index.html             ← 1.7KB 入口（載 React + Babel + app.js）
│   ├── app.js                 ← 41KB / 1184 行 React 主應用（JSX）
│   ├── styles.css             ← 12KB 偽 3D 酒瓶 / 玻璃面板 / 動畫
│   ├── sake_data.json         ← 27KB 7 款酒完整資料（含 SSI 4 タイプ 驗證）
│   └── bottles/               ← 7 張 AI 去背透明 PNG (640×1600)
│
├── backend/                   ← 不會自動部署，需手動弄
│   ├── code.gs                ← Google Apps Script（doPost / 儀表板 / CSV）
│   ├── SETUP.md               ← 6 步驟部署教學（含截圖位置）
│   ├── frontend_integration.js
│   └── sample_payload.json    ← 範例訂單 JSON
│
├── build/                     ← 工作備份
│   ├── process_bottles.py     ← AI 去背 + 正規化腳本（可重新跑）
│   ├── sake_data.json         ← public/ 的同步副本
│   └── VERIFICATION_REPORT.md ← SSI 4 タイプ 驗證報告
│
├── .gitignore
└── README.md                  ← 你正在看的這份
```

---

## 🛠️ 技術棧

- **前端**：React 18 + Tailwind CSS（全部 CDN，無 build step）
- **JSX 轉譯**：Babel standalone（瀏覽器即時編譯，首次載入慢 1-2 秒）
- **資料**：靜態 `sake_data.json`，無資料庫
- **酒瓶**：真實照片用 [rembg](https://github.com/danielgatis/rembg) AI 去背 + Pillow 正規化（不是 3D 模型）
- **音效**：Web Audio API 程式合成（無音檔，超小）
- **持久化**：`localStorage`（同日有效）
- **後端**：Google Apps Script + Google Sheet（零成本、零維護）

---

## 🧪 測試後端訂單系統（選擇性）

如果想看訂單真的被收到、寫入 Google Sheet：

1. 跟著 `backend/SETUP.md` 走（約 10 分鐘）
2. 部署完拿到 Apps Script Web App URL
3. 編輯 `public/index.html`，找到：
   ```js
   window.SAKE_ORDER_ENDPOINT = null;
   ```
   改成：
   ```js
   window.SAKE_ORDER_ENDPOINT = "https://script.google.com/macros/s/AKfycb.../exec";
   ```
4. 重新整理網頁，走完一輪到「採購單 → 提交」
5. 回 Google Sheet 看 `Orders` / `Evaluations` / `Cart` 三個 tab 有沒有資料

> 💡 不設定也能測前端：訂單會印在瀏覽器 console 而非送出。

---

## ❓ 常見問題

<details>
<summary>畫面空白，console 有錯</summary>

8 成是直接雙擊了 `index.html`。請改用 `http://localhost:8765/` 開。
</details>

<details>
<summary>酒瓶圖載不出來</summary>

確認 `public/bottles/` 有 7 張 PNG。沒有的話用 `python3 build/process_bottles.py` 重產（需要 `pip3 install rembg onnxruntime Pillow`）。
</details>

<details>
<summary>陀螺儀沒反應</summary>

- iOS 13+ 需要使用者主動授權，第一次點酒瓶時會跳請求
- Android 通常自動允許
- 電腦瀏覽器沒有陀螺儀，僅手機可測
</details>

<details>
<summary>能不能改成 8 間店家以外的名稱？</summary>

編輯 `public/sake_data.json` 的 `stores` 陣列，重整網頁即可。
</details>

<details>
<summary>能不能加更多酒款？</summary>

可以，但需要：

1. 準備酒瓶照片，丟到 `public/bottles/`（或重跑 `build/process_bottles.py` 去背）
2. 在 `public/sake_data.json` 的 `sakes` 陣列加新項目（依現有結構）
</details>

---

## 📅 開發歷程

- **2026-05-21** 啟動：原型 → 補資料 → SSI 4 タイプ 校準 → 7 款酒完整研究 → 三個 Sub Agent 並行（驗證 / 前端 / 後端）→ 整合
- **2026-05-25**（預計）活動上線

---

## 🙋 聯絡

有任何問題或改進建議，直接開 issue 或聯繫專案維護者。

請開心地試喝清酒（測試的時候 🍶）。

