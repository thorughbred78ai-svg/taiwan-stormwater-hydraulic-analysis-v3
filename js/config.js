/* ================================================================
 * config.js — 存取與計數器設定
 *
 * ⚠ 這是純前端靜態網站（GitHub Pages）。
 *   此處只存密碼的 SHA-256 雜湊，不存明碼，但仍屬「基本門檻」，
 *   不是真正的存取控制：任何人可從原始碼取得雜湊並離線暴力破解
 *   （8 位數字密碼可在數秒內被破解），頁面內容也已在原始碼中。
 *   需要真正保護時，請改用伺服器端驗證（見 README「資安說明」）。
 *
 * 產生新密碼雜湊（瀏覽器 Console 或 Node）：
 *   sha256("tw-stormwater-v3|" + 新密碼)
 * ================================================================ */

window.V3_CONFIG = {

    auth: {
        salt: "tw-stormwater-v3|",
        passwordHash: "d65013a78e7fc9d7877e8ab490fd2d4148c8de5c9ca6753cebb5b537c1e977f1",
        maxAttempts: 5,          // 連續錯誤達此次數後暫時鎖定
        lockSeconds: 30          // 鎖定秒數（每次再失敗加倍）
    },

    counter: {
        /*
         * "local"  ：存在本機瀏覽器 localStorage（只計該瀏覽器的進入次數，
         *            不是全站累計；適合離線／內網單機）。
         * "remote" ：呼叫 endpoint 取得全站共用累計（需自行部署，
         *            見 README「瀏覽計數器」）。
         */
        mode: "local",
        endpoint: "",            // 例："https://script.google.com/macros/s/XXXX/exec"
        timeoutMs: 5000,
        storageKey: "v3_visit_count"
    }
};
