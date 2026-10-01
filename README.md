# taiwan-stormwater-hydraulic-analysis-v3

台灣雨水下水道數值水理分析 V3
節點／管段網路的穩態水理分析工具：Manning 非滿流、滿管切換、HGL／EGL、下游回水與工程檢核。純前端靜態網站，可直接部署於 GitHub Pages，無需後端。
> **創建者：** HHHuang
> ⚠️ **工程使用聲明**
> 本工具為數值水理分析輔助工具，內建示範數值**不是**特定工程設計值。正式設計仍須依案件條件、最新法規與設計指南、地形與管網調查、邊界條件，並由合格技師確認。計算成果不得未經人工覆核直接作為設計或決策依據。
---
目錄
功能
快速開始
使用流程
專案結構
資料格式
計算方法與限制
登入與資安說明
瀏覽計數器
部署到 GitHub Pages
測試
變更紀錄
---
功能
模組	說明
節點／管段輸入	表格式輸入，可新增、修改、刪除，節點改名時管段參照自動同步
水理分析	節點連續方程、Manning 圓管非滿流、滿管／surcharge 判定、Froude 數與流況
HGL／EGL	摩阻損失、局部損失（入口／彎頭／出口／匯流 K）、下游回水推算
縱剖面圖	管底、水面、HGL、EGL（Chart.js）
工程檢核	流速、最小管徑、滿管、surcharge、HGL 對地面、外水位、節點連續；門檻值可調
成果匯出	CSV、Excel、完整 JSON、列印
登入閘門	進入網頁需輸入存取密碼（見資安說明）
瀏覽計數器	頁首右上角顯示「瀏覽累計人次數」
快速開始
不需安裝任何套件。
```bash
git clone https://github.com/thorughbred78ai-svg/taiwan-stormwater-hydraulic-analysis-v3.git
cd taiwan-stormwater-hydraulic-analysis-v3

# 方式一：直接用瀏覽器開啟 index.html
# 方式二：啟動本機伺服器（建議）
python3 -m http.server 8000
# 瀏覽 http://localhost:8000
```
> 圖表與 Excel 匯出依賴 CDN 載入的 Chart.js 與 SheetJS。離線或內網環境請見[資安說明](#登入與資安說明)的「第三方程式庫」。
使用流程
輸入存取密碼登入。
到 示範案例 分頁，按「載入並執行完整分析」，可一次看到完整流程與結果。
自行建案：
節點輸入：管底高程、地面高程、外部入流 Q（m³/s）、出口節點的下游水位（HGL，選填）。
管段輸入：上下游節點、長度、管徑、Manning n、入口／彎頭／出口 K。
水理分析 → 「水理＋HGL/EGL＋檢核」。
在 系統檢核 分頁調整檢核門檻後重新執行。
在 成果匯出 分頁下載成果。
專案結構
```
.
├── index.html          主頁面（含登入閘門、頁首計數器）
├── README.md
└── js/
    ├── config.js       密碼雜湊、計數器設定
    ├── gate.js         登入閘門與瀏覽計數器
    ├── hydraulic.js    水理核心：連續方程、Manning、滿管切換
    ├── hgl-egl.js      HGL／EGL、損失計算、回水、縱剖面繪圖
    ├── checking.js     工程檢核引擎與設定
    ├── ui.js           介面接線：表格、按鈕、驗證、結果顯示
    └── export.js       CSV／Excel／JSON 匯出
```
資料流：
```
輸入表格 → 驗證 → window.nodes / pipes / v3BoundaryConditions
        → hydraulic.js → window.v3HydraulicSolution
        → hgl-egl.js   → window.v3HglEglSolution
        → checking.js  → window.v3CheckingSolution
        → 表格／圖表／匯出
```
> 舊架構檔案（`model.js`、`network.js`、`boundary.js`、`hydrology.js`、`geometry.js`、`losses.js`、`overflow.js`、`solver.js`、`profile.js`、`app.js`）已不再使用，請勿與目前檔案混載（函式名稱會衝突）。
資料格式
節點
欄位	單位	說明
`id`	–	節點編號，不可重複
`invert`	m	管底高程
`groundElevation`	m	地面高程
`inflow`	m³/s	外部入流（≥ 0）
管段
欄位	單位	說明
`id`	–	管段編號，不可重複
`from` / `to`	–	上游／下游節點
`length`	m	長度（> 0）
`diameter`	m	管徑（> 0）
`n`	–	Manning 粗糙係數（> 0）
`entranceK` `bendK` `exitK` `junctionK`	–	局部損失係數
`slope`	–	由上下游管底高程與長度自動推算，不需輸入
邊界條件：出口節點可輸入下游水位 `HGL`（m），未輸入時以計算水深起算。
計算方法與限制
連續方程：節點可用流量 = 外部入流 + 上游管段流量，依管段輸水能力比例分配至下游。
Manning：Q = (1/n)·A·R^(2/3)·S^(1/2)，圓管以二分法求正常水深。
能量：HGL = 管底 + 水深（或壓力水頭）；EGL = HGL + V²/2g；損失 = Manning 摩阻 + K·V²/2g。
定位為穩態／準穩態求解器，不是 Saint-Venant 動力波模型，不模擬降雨歷線、儲蓄與傳遞時間。
管網必須為有向無環（不支援環狀網路）；輸入有迴圈時會被擋下並提示。
圓形斷面；不含箱涵、人孔落差損失之詳細模型與下游潮位時變。
坡度 ≤ 0 的管段（上游管底不高於下游）會警告並以最小坡度計算，請確認管底高程。
登入與資安說明
進入網頁需輸入存取密碼。
這是純前端的「基本門檻」，不是真正的存取控制。 請務必了解：
靜態網站的所有檔案（含 `config.js`）都會傳到使用者瀏覽器。程式只儲存密碼的 SHA-256 雜湊（加固定 salt），不存明碼，但任何人都能取得雜湊並離線暴力破解；純數字短密碼可在數秒內被破解。
頁面內容與計算程式碼本來就在原始碼中，繞過登入畫面即可閱讀。
錯誤 5 次會暫時鎖定（30 秒起、逐次加倍），但這只在瀏覽器端運作，可被清除。
公開 repository 的程式碼與雜湊人人可見。請勿把密碼寫進 README、issue 或 commit 訊息。
不要用本機門檻保護：個人資料、公務機密、未公開之工程資料。此類資料請：
僅在本機／機關內網離線使用，不上傳至公開網站；或
改用伺服器端驗證（機關 SSO、Cloudflare Access、GitHub Pages 以外之具身分驗證的主機，並搭配 MFA 與存取稽核）。
變更密碼：在瀏覽器 Console 計算新雜湊後貼入 `js/config.js` 的 `passwordHash`：
```js
// 新密碼請使用長度足夠的隨機字串
const pw = "新密碼";
const buf = await crypto.subtle.digest(
  "SHA-256", new TextEncoder().encode("tw-stormwater-v3|" + pw));
console.log([...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""));
```
資料處理：所有輸入與計算皆在使用者瀏覽器內完成，不會上傳至任何伺服器（遠端計數器模式例外，僅傳送「計數請求」，不含任何分析資料）。
第三方程式庫：目前由 jsDelivr CDN 載入 Chart.js 4.4.7 與 SheetJS 0.18.5。用於機關環境時，建議下載至 `vendor/` 本機託管，並加上 Subresource Integrity（SRI）或 Content-Security-Policy，降低供應鏈風險。
瀏覽計數器
頁首右上角顯示「瀏覽累計人次數」。登入成功後，同一分頁工作階段只計一次。
兩種模式（`js/config.js` → `counter.mode`）：
模式	行為	適用
`local`（預設）	存於該瀏覽器 `localStorage`，顯示「（本機）」。只統計該瀏覽器自己的次數，不是全站累計	離線、內網單機
`remote`	呼叫你部署的端點取得全站共用累計	GitHub Pages 公開網站
GitHub Pages 是靜態主機，沒有後端，無法自行儲存全站計數。要顯示真正的全站累計，需自行提供一個計數端點。端點規格：
`GET {endpoint}?action=hit` → 計數 +1 並回傳 `{"count": 12345}`
`GET {endpoint}?action=get` → 只回傳目前值
必須是 `https`，並允許跨來源讀取（CORS）；連線失敗時前端會自動退回本機計數。
範例：Google Apps Script（未經實際部署驗證，請自行測試）
建立 Google 試算表，第一個工作表 `A1` 填 `0`。
擴充功能 → Apps Script，貼入：
```js
function doGet(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cell = SpreadsheetApp.getActiveSpreadsheet()
      .getSheets()[0].getRange("A1");
    let count = Number(cell.getValue()) || 0;
    if (e.parameter.action === "hit") {
      count += 1;
      cell.setValue(count);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ count: count }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
```
部署 → 新增部署作業 → 類型「網頁應用程式」，執行身分「我」，存取權「任何人」。
將網頁應用程式網址填入 `js/config.js`：
```js
counter: {
  mode: "remote",
  endpoint: "https://script.google.com/macros/s/XXXXXXXX/exec",
  timeoutMs: 5000,
  storageKey: "v3_visit_count"
}
```
限制：此計數是「登入次數」的粗略統計，無法辨識不重複訪客，也無法防止有心人重複呼叫端點灌水。若法規或機關內規要求蒐集訪客資料，請先確認個資與隱私告知義務；本計數器不蒐集 IP、帳號或任何可識別個人之資訊。
部署到 GitHub Pages
Repository → Settings → Pages。
Source 選 `Deploy from a branch`，Branch 選 `main`、資料夾 `/ (root)`。
等待部署完成後，網址為 `https://<帳號>.github.io/<repo 名稱>/`。
測試
專案目前沒有自動化測試套件。手動驗證建議：
開啟頁面 → 應只看到登入視窗；輸入錯誤密碼 5 次 → 暫時鎖定。
登入後：頁首右上角出現「瀏覽累計人次數」。
示範案例 → 「載入並執行完整分析」：求解已收斂，工程檢核 22 項全數 PASS，最大 HGL ≈ 101.05 m，出口流量 2.200 m³/s。
把任一管徑改為 0.5 m 再執行 → 應出現 FAIL 項目。
新增兩個節點與一支管段而未填入外部入流 → 執行時應顯示「所有節點外部入流皆為 0」。
將管段下游改回上游形成迴圈 → 應顯示環狀連接錯誤。
建議後續補上：Manning 與正常水深的單元測試（對照已知解析解）、HGL 守恆測試、`ui.js` 輸入驗證的邊界案例。
變更紀錄
V3.1（本版）
新增登入閘門與頁首瀏覽計數器。
新增 `ui.js`，修正「新增節點／新增管段／載入示範案例」按鈕無反應（原按鈕未綁定事件）。
重寫 `export.js`，改讀實際計算成果。
`hydraulic.js`：改為依拓樸順序累加流量，修正中間節點外部入流被覆蓋導致無法收斂；出口節點不再被誤判為不平衡。
`checking.js`：出口節點的節點連續檢核不再誤報 FAIL。
`hgl-egl.js`：修正局部損失 K 係數未被讀取，導致局部損失恆為 0、HGL／EGL 偏低。
---
© HHHuang。使用前請先確認授權條款（repository 尚未附 LICENSE 檔）。
