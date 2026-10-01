/* ================================================================
 * gate.js — 登入閘門 + 瀏覽累計人次數
 *
 * 流程：載入 → 顯示登入視窗（主內容隱藏）→ 輸入密碼 →
 *       SHA-256 比對 → 通過後解鎖，並於本分頁工作階段首次
 *       登入時累計人次 +1。
 *
 * 注意：純前端驗證僅為基本門檻，見 config.js 說明。
 * ================================================================ */

(function (window, document) {

    "use strict";

    var CFG = window.V3_CONFIG;
    var SESSION_KEY = "v3_auth_ok";
    var COUNTED_KEY = "v3_counted";
    var FAIL_KEY = "v3_fail_state";

    /* ------------------------------------------------------------
     * SHA-256（純 JS；crypto.subtle 在非安全環境不可用時作後備）
     * ---------------------------------------------------------- */

    var K = [
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];

    function utf8(str) {
        return new TextEncoder().encode(str);
    }

    function sha256Bytes(bytes) {
        var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
        var len = bytes.length;
        var padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
        padded.set(bytes);
        padded[len] = 0x80;
        var bits = len * 8;
        var dv = new DataView(padded.buffer);
        dv.setUint32(padded.length - 8, Math.floor(bits / 4294967296));
        dv.setUint32(padded.length - 4, bits >>> 0);
        var w = new Uint32Array(64);

        function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

        for (var off = 0; off < padded.length; off += 64) {
            for (var i = 0; i < 16; i++) { w[i] = dv.getUint32(off + i * 4); }
            for (i = 16; i < 64; i++) {
                var s0 = rotr(w[i-15],7) ^ rotr(w[i-15],18) ^ (w[i-15] >>> 3);
                var s1 = rotr(w[i-2],17) ^ rotr(w[i-2],19) ^ (w[i-2] >>> 10);
                w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
            }
            var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
            for (i = 0; i < 64; i++) {
                var S1 = rotr(e,6) ^ rotr(e,11) ^ rotr(e,25);
                var ch = (e & f) ^ (~e & g);
                var t1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
                var S0 = rotr(a,2) ^ rotr(a,13) ^ rotr(a,22);
                var mj = (a & b) ^ (a & c) ^ (b & c);
                var t2 = (S0 + mj) >>> 0;
                hh=g; g=f; f=e; e=(d + t1) >>> 0; d=c; c=b; b=a; a=(t1 + t2) >>> 0;
            }
            h[0]=(h[0]+a)>>>0; h[1]=(h[1]+b)>>>0; h[2]=(h[2]+c)>>>0; h[3]=(h[3]+d)>>>0;
            h[4]=(h[4]+e)>>>0; h[5]=(h[5]+f)>>>0; h[6]=(h[6]+g)>>>0; h[7]=(h[7]+hh)>>>0;
        }
        return h.map(function (x) { return ("00000000" + x.toString(16)).slice(-8); }).join("");
    }

    function sha256Hex(text) {
        var bytes = utf8(text);
        if (window.crypto && window.crypto.subtle && window.isSecureContext) {
            return window.crypto.subtle.digest("SHA-256", bytes).then(function (buf) {
                return Array.prototype.map.call(new Uint8Array(buf), function (b) {
                    return ("0" + b.toString(16)).slice(-2);
                }).join("");
            }).catch(function () { return sha256Bytes(bytes); });
        }
        return Promise.resolve(sha256Bytes(bytes));
    }

    /* 固定時間比較，避免逐字元提早結束 */
    function safeEqual(a, b) {
        if (a.length !== b.length) { return false; }
        var r = 0;
        for (var i = 0; i < a.length; i++) { r |= a.charCodeAt(i) ^ b.charCodeAt(i); }
        return r === 0;
    }

    /* ------------------------------------------------------------
     * 儲存（隱私模式可能丟例外，一律包 try）
     * ---------------------------------------------------------- */

    function sget(store, key) {
        try { return window[store].getItem(key); } catch (e) { return null; }
    }
    function sset(store, key, value) {
        try { window[store].setItem(key, value); } catch (e) { /* 忽略 */ }
    }

    /* ------------------------------------------------------------
     * 計數器
     * ---------------------------------------------------------- */

    function showCount(text, title) {
        var el = document.getElementById("visitCount");
        if (!el) { return; }
        el.textContent = text;
        if (title) { el.title = title; }
    }

    function formatCount(n) {
        return Number(n).toLocaleString("en-US");
    }

    function localCount(increment) {
        var key = CFG.counter.storageKey;
        var n = parseInt(sget("localStorage", key), 10);
        if (!Number.isFinite(n) || n < 0) { n = 0; }
        if (increment) {
            n += 1;
            sset("localStorage", key, String(n));
        }
        return n;
    }

    function remoteCount(increment) {
        var url = CFG.counter.endpoint;
        if (!/^https:\/\//i.test(url)) {
            return Promise.reject(new Error("endpoint 必須是 https"));
        }
        var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, CFG.counter.timeoutMs) : null;

        return fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=" + (increment ? "hit" : "get"), {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            signal: ctrl ? ctrl.signal : undefined
        }).then(function (res) {
            if (!res.ok) { throw new Error("HTTP " + res.status); }
            return res.json();
        }).then(function (data) {
            var n = Number(data && data.count);
            if (!Number.isFinite(n) || n < 0) { throw new Error("回應格式錯誤"); }
            return n;
        }).then(function (n) {
            if (timer) { clearTimeout(timer); }
            return n;
        }, function (err) {
            if (timer) { clearTimeout(timer); }
            throw err;
        });
    }

    function updateCounter() {
        var first = sget("sessionStorage", COUNTED_KEY) !== "1";
        sset("sessionStorage", COUNTED_KEY, "1");

        if (CFG.counter.mode === "remote" && CFG.counter.endpoint) {
            showCount("…");
            remoteCount(first).then(function (n) {
                showCount(formatCount(n), "全站累計");
            }).catch(function (err) {
                console.warn("[counter] 遠端計數失敗，改用本機計數：", err.message);
                showCount(formatCount(localCount(first)) + "（本機）",
                    "遠端計數器無法連線，顯示本機瀏覽器累計");
            });
        } else {
            showCount(formatCount(localCount(first)) + "（本機）",
                "僅統計此瀏覽器的進入次數；全站累計需設定遠端計數器");
        }
    }

    /* ------------------------------------------------------------
     * 登入
     * ---------------------------------------------------------- */

    function unlock() {
        sset("sessionStorage", SESSION_KEY, "1");
        document.documentElement.classList.remove("v3-locked");
        var gate = document.getElementById("v3Gate");
        if (gate) { gate.style.display = "none"; }
        updateCounter();
    }

    function loadFail() {
        try {
            var s = JSON.parse(sget("sessionStorage", FAIL_KEY) || "{}");
            return { count: s.count || 0, until: s.until || 0, round: s.round || 0 };
        } catch (e) {
            return { count: 0, until: 0, round: 0 };
        }
    }

    function init() {
        var gate = document.getElementById("v3Gate");
        var form = document.getElementById("v3GateForm");
        var input = document.getElementById("v3GatePassword");
        var msg = document.getElementById("v3GateMsg");
        var btn = document.getElementById("v3GateSubmit");

        if (sget("sessionStorage", SESSION_KEY) === "1") {
            unlock();
            return;
        }

        if (!gate || !form || !input) {
            // 閘門元件缺失時保持鎖定，不可預設放行
            console.error("[gate] 缺少登入元件，維持鎖定。");
            return;
        }

        gate.style.display = "flex";
        input.focus();

        var timerId = null;

        function renderLock() {
            var st = loadFail();
            var left = Math.ceil((st.until - Date.now()) / 1000);
            if (left > 0) {
                btn.disabled = true;
                msg.textContent = "錯誤次數過多，請 " + left + " 秒後再試。";
                timerId = setTimeout(renderLock, 500);
            } else {
                btn.disabled = false;
                if (st.until) { msg.textContent = ""; }
            }
        }
        renderLock();

        form.addEventListener("submit", function (event) {
            event.preventDefault();
            var st = loadFail();
            if (st.until > Date.now()) { return renderLock(); }

            var pw = input.value;
            if (!pw) { msg.textContent = "請輸入密碼。"; return; }

            btn.disabled = true;
            sha256Hex(CFG.auth.salt + pw).then(function (hex) {
                if (safeEqual(hex, CFG.auth.passwordHash)) {
                    sset("sessionStorage", FAIL_KEY, "{}");
                    input.value = "";
                    unlock();
                    return;
                }
                st.count += 1;
                if (st.count >= CFG.auth.maxAttempts) {
                    st.round += 1;
                    st.count = 0;
                    st.until = Date.now() + CFG.auth.lockSeconds * 1000 * Math.pow(2, st.round - 1);
                    msg.textContent = "";
                } else {
                    msg.textContent = "密碼錯誤（剩餘 " + (CFG.auth.maxAttempts - st.count) + " 次）。";
                }
                sset("sessionStorage", FAIL_KEY, JSON.stringify(st));
                input.value = "";
                input.focus();
                btn.disabled = false;
                renderLock();
            });
        });
    }

    window.V3Gate = { sha256Hex: sha256Hex };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})(window, document);
