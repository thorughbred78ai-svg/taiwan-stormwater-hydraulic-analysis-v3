/* ================================================================
 * export.js
 * 台灣雨水下水道數值水理分析 V3 — 成果匯出
 *
 * 資料來源：
 *   window.v3HydraulicSolution   水理成果
 *   window.v3HglEglSolution      HGL / EGL 成果
 *   window.v3CheckingSolution    工程檢核成果
 *
 * （舊版 export.js 讀取 window.v3Solution，該變數在 V3 流程中
 *   從未建立，匯出一律顯示「尚未有分析結果」。）
 * ================================================================ */

(function (window, document) {

    "use strict";

    function notify(text) {
        if (window.V3UI && window.V3UI.message) {
            window.V3UI.message(text, "warn");
        } else {
            window.alert(text);
        }
    }

    function stamp() {
        var d = new Date();
        function p(n) { return String(n).padStart(2, "0"); }
        return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
            "_" + p(d.getHours()) + p(d.getMinutes());
    }

    function download(filename, content, mime) {
        var blob = new Blob([content], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    /* CSV：逗號／引號／換行跳脫；以 = + - @ 開頭的「文字」加單引號，
       避免 Excel 公式注入（純數字不處理）。 */
    function csvCell(value) {
        if (value === null || value === undefined) { return ""; }
        if (typeof value === "object") { value = JSON.stringify(value); }
        var text = String(value);
        if (typeof value === "string" && /^[=+\-@\t\r]/.test(text) && isNaN(Number(text))) {
            text = "'" + text;
        }
        return /[",\n\r]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text;
    }

    function toCSV(rows) {
        if (!rows || rows.length === 0) { return ""; }
        var keys = [];
        rows.forEach(function (r) {
            Object.keys(r).forEach(function (k) { if (keys.indexOf(k) < 0) { keys.push(k); } });
        });
        var lines = [keys.map(csvCell).join(",")];
        rows.forEach(function (r) {
            lines.push(keys.map(function (k) { return csvCell(r[k]); }).join(","));
        });
        return "\uFEFF" + lines.join("\r\n");
    }

    function hydraulicRows() {
        var s = window.v3HydraulicSolution;
        return s && s.pipeResults ? s.pipeResults : null;
    }

    function hglRows() {
        var s = window.v3HglEglSolution;
        return s && s.records ? s.records : null;
    }

    function exportHydraulicCSV() {
        var rows = hydraulicRows();
        if (!rows) { return notify("尚未有水理分析結果，請先執行分析。"); }
        download("V3_水理分析_" + stamp() + ".csv", toCSV(rows), "text/csv;charset=utf-8");
    }

    function exportHglCSV() {
        var rows = hglRows();
        if (!rows) { return notify("尚未有 HGL/EGL 結果，請先計算。"); }
        download("V3_HGL_EGL_" + stamp() + ".csv", toCSV(rows), "text/csv;charset=utf-8");
    }

    function exportExcel() {
        if (typeof XLSX === "undefined") {
            return notify("Excel 匯出元件（SheetJS CDN）未載入，請確認網路連線，或改用 CSV 匯出。");
        }
        var h = hydraulicRows();
        var g = hglRows();
        if (!h) { return notify("尚未有分析結果，請先執行分析。"); }

        var wb = XLSX.utils.book_new();

        function add(name, rows) {
            if (!rows || !rows.length) { return; }
            // 與 CSV 相同的公式注入防護
            var safe = rows.map(function (r) {
                var o = {};
                Object.keys(r).forEach(function (k) {
                    var v = r[k];
                    if (v !== null && typeof v === "object") { v = JSON.stringify(v); }
                    if (typeof v === "string" && /^[=+\-@]/.test(v) && isNaN(Number(v))) { v = "'" + v; }
                    o[k] = v;
                });
                return o;
            });
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(safe), name);
        }

        add("Hydraulic", h);
        add("HGL_EGL", g);

        var c = window.v3CheckingSolution;
        if (c) {
            add("Check_Pipe", (c.pipeResults || []).map(function (p) {
                return {
                    pipeId: p.pipeId, Q: p.Q, velocity: p.velocity, depth: p.depth,
                    HGLUp: p.HGLUp, HGLDown: p.HGLDown, EGLUp: p.EGLUp, EGLDown: p.EGLDown,
                    status: p.status
                };
            }));
            add("Check_Node", c.nodeResults || []);
        }

        XLSX.writeFile(wb, "V3_雨水下水道分析_" + stamp() + ".xlsx");
    }

    function exportJSON() {
        if (!window.v3HydraulicSolution) {
            return notify("尚未有分析結果，請先執行分析。");
        }
        var out = {
            application: "台灣雨水下水道數值水理分析 V3",
            exportedAt: new Date().toISOString(),
            input: {
                nodes: window.nodes || [],
                pipes: window.pipes || [],
                boundaryConditions: window.v3BoundaryConditions || {}
            },
            hydraulic: window.v3HydraulicSolution,
            hglEgl: window.v3HglEglSolution || null,
            checking: window.v3CheckingSolution || null,
            disclaimer: "數值水理分析輸出，正式設計須依最新法規與技師專業判斷確認。"
        };
        download("V3_完整分析_" + stamp() + ".json", JSON.stringify(out, null, 2),
            "application/json;charset=utf-8");
    }

    function printResult() {
        window.print();
    }

    function bind(id, fn) {
        var el = document.getElementById(id);
        if (el) { el.addEventListener("click", fn); }
    }

    function init() {
        bind("exportHydraulicCsvBtn", exportHydraulicCSV);
        bind("exportHglCsvBtn", exportHglCSV);
        bind("exportExcelBtn", exportExcel);
        bind("exportJsonBtn", exportJSON);
        bind("printResultBtn", printResult);
    }

    window.V3Export = {
        hydraulicCSV: exportHydraulicCSV,
        hglCSV: exportHglCSV,
        excel: exportExcel,
        json: exportJSON,
        toCSV: toCSV
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})(window, document);
