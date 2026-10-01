/* ================================================================
 * ui.js
 * 台灣雨水下水道數值水理分析 V3 — 介面接線層
 *
 * 取代原 app.js（原 app.js 自行建立另一套 DOM，從未綁定 index.html
 * 的任何按鈕，是「新增節點 / 新增管段 / 載入示範案例」無反應的根因）。
 *
 * 職責：
 *   1. 節點 / 管段表格（新增、編輯、刪除、清除）
 *   2. 示範案例載入與一鍵分析
 *   3. 輸入驗證（資料不合法時不送進求解器）
 *   4. 呼叫 hydraulic.js → hgl-egl.js → checking.js
 *   5. 結果表格、摘要、縱剖面圖
 *
 * 資料契約（三個引擎共同讀取）：
 *   window.nodes   [{id, invert, groundElevation, inflow}]
 *   window.pipes   [{id, from, to, length, diameter, n, slope,
 *                    entranceK, bendK, exitK, junctionK}]
 *   window.v3BoundaryConditions = {nodes:{[id]:{type, HGL}}}
 *
 * 安全：所有使用者輸入在輸出到 innerHTML 前一律 escape。
 * ================================================================ */

(function (window, document) {

    "use strict";

    var MIN_SLOPE = 0.000001;

    /* ------------------------------------------------------------
     * 狀態
     * ---------------------------------------------------------- */

    var model = {
        nodes: [],
        pipes: [],
        boundary: {}          // nodeId -> HGL (m)
    };

    window.nodes = model.nodes;
    window.pipes = model.pipes;
    window.v3BoundaryConditions = { nodes: {} };

    var chartPending = false;

    /* ------------------------------------------------------------
     * 工具
     * ---------------------------------------------------------- */

    function $(id) {
        return document.getElementById(id);
    }

    function esc(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function num(value, fallback) {
        var x = Number(value);
        return Number.isFinite(x) ? x : fallback;
    }

    function fmt(value, digits) {
        var x = Number(value);
        return Number.isFinite(x) ? x.toFixed(digits === undefined ? 3 : digits) : "-";
    }

    function setText(id, text) {
        var el = $(id);
        if (el) { el.textContent = text; }
    }

    function clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function uniqueId(prefix, list) {
        var i = list.length + 1;
        var used = new Set(list.map(function (x) { return String(x.id); }));
        while (used.has(prefix + i)) { i++; }
        return prefix + i;
    }

    function showTab(tabId) {
        var btn = document.querySelector('[data-tab="' + tabId + '"]');
        if (btn) { btn.click(); }
    }

    /* ------------------------------------------------------------
     * 訊息列（取代 alert，可持續顯示多筆錯誤）
     * ---------------------------------------------------------- */

    function ensureMessageBox() {
        var box = $("v3Message");
        if (box) { return box; }
        box = document.createElement("div");
        box.id = "v3Message";
        box.setAttribute("role", "status");
        box.setAttribute("aria-live", "polite");
        box.style.cssText =
            "display:none;margin:0 0 14px;padding:11px 15px;border-radius:6px;" +
            "font-size:14px;line-height:1.7;white-space:pre-line;";
        var main = document.querySelector("main");
        var bar = document.querySelector(".status-bar");
        if (main && bar) { main.insertBefore(box, bar.nextSibling); }
        return box;
    }

    function message(text, kind) {
        var box = ensureMessageBox();
        var colors = {
            info:  ["#eef8fa", "#0b7285"],
            ok:    ["#e6f6ec", "#2a9d8f"],
            warn:  ["#fff8e1", "#f4a261"],
            error: ["#fdecee", "#d62828"]
        };
        var c = colors[kind || "info"];
        box.style.background = c[0];
        box.style.borderLeft = "4px solid " + c[1];
        box.textContent = text;
        box.style.display = text ? "block" : "none";
    }

    /* ------------------------------------------------------------
     * 節點
     * ---------------------------------------------------------- */

    function addNode(data) {
        data = data || {};
        var id = data.id || uniqueId("N", model.nodes);
        model.nodes.push({
            id: String(id),
            invert: num(data.invert, 100),
            groundElevation: num(data.groundElevation, 102),
            inflow: num(data.inflow, 0)
        });
        if (data.HGL !== undefined && data.HGL !== null && data.HGL !== "") {
            model.boundary[String(id)] = Number(data.HGL);
        }
    }

    function renderNodes() {
        var tbody = $("nodeTableBody");
        if (!tbody) { return; }

        tbody.innerHTML = model.nodes.map(function (n, i) {
            var hgl = model.boundary[n.id];
            return "<tr data-index=\"" + i + "\">" +
                "<td><input data-f=\"id\" value=\"" + esc(n.id) + "\" aria-label=\"Node ID\"></td>" +
                "<td><input data-f=\"invert\" type=\"number\" step=\"0.01\" value=\"" + esc(n.invert) + "\" aria-label=\"管底高程\"></td>" +
                "<td><input data-f=\"groundElevation\" type=\"number\" step=\"0.01\" value=\"" + esc(n.groundElevation) + "\" aria-label=\"地面高程\"></td>" +
                "<td><input data-f=\"inflow\" type=\"number\" step=\"0.001\" min=\"0\" value=\"" + esc(n.inflow) + "\" aria-label=\"外部入流\"></td>" +
                "<td><input data-f=\"HGL\" type=\"number\" step=\"0.01\" placeholder=\"無\" value=\"" +
                    (Number.isFinite(hgl) ? esc(hgl) : "") + "\" aria-label=\"下游HGL\"></td>" +
                "<td><button type=\"button\" class=\"btn btn-light\" data-action=\"del-node\">刪除</button></td>" +
                "</tr>";
        }).join("");

        refreshCounts();
    }

    function onNodeEdit(event) {
        var input = event.target;
        var tr = input.closest("tr");
        if (!tr || !input.dataset.f) { return; }

        var node = model.nodes[Number(tr.dataset.index)];
        if (!node) { return; }

        var f = input.dataset.f;

        if (f === "id") {
            var oldId = node.id;
            var newId = input.value.trim();

            if (!newId) {
                input.value = oldId;
                message("Node ID 不可為空白。", "warn");
                return;
            }
            if (model.nodes.some(function (x) { return x !== node && x.id === newId; })) {
                input.value = oldId;
                message("Node ID「" + newId + "」已存在，請使用不重複的編號。", "warn");
                return;
            }

            node.id = newId;

            // 同步更新管段參照與邊界條件
            model.pipes.forEach(function (p) {
                if (p.from === oldId) { p.from = newId; }
                if (p.to === oldId) { p.to = newId; }
            });
            if (oldId in model.boundary) {
                model.boundary[newId] = model.boundary[oldId];
                delete model.boundary[oldId];
            }
            renderPipes();
            return;
        }

        if (f === "HGL") {
            if (input.value === "") {
                delete model.boundary[node.id];
            } else {
                model.boundary[node.id] = Number(input.value);
            }
            return;
        }

        var v = Number(input.value);
        node[f] = Number.isFinite(v) ? v : 0;
    }

    function onNodeClick(event) {
        var btn = event.target.closest("[data-action='del-node']");
        if (!btn) { return; }

        var tr = btn.closest("tr");
        var index = Number(tr.dataset.index);
        var node = model.nodes[index];
        if (!node) { return; }

        var used = model.pipes.filter(function (p) {
            return p.from === node.id || p.to === node.id;
        });

        if (used.length > 0 &&
            !window.confirm("節點「" + node.id + "」被 " + used.length +
                " 支管段使用，刪除後這些管段的上／下游會被清空。\n確定刪除？")) {
            return;
        }

        used.forEach(function (p) {
            if (p.from === node.id) { p.from = ""; }
            if (p.to === node.id) { p.to = ""; }
        });

        delete model.boundary[node.id];
        model.nodes.splice(index, 1);
        invalidateResults();
        renderNodes();
        renderPipes();
    }

    /* ------------------------------------------------------------
     * 管段
     * ---------------------------------------------------------- */

    function addPipe(data) {
        data = data || {};
        var n = model.nodes;
        var defFrom = n.length >= 2 ? n[n.length - 2].id : "";
        var defTo = n.length >= 2 ? n[n.length - 1].id : "";

        model.pipes.push({
            id: String(data.id || uniqueId("P", model.pipes)),
            from: data.from !== undefined ? data.from : defFrom,
            to: data.to !== undefined ? data.to : defTo,
            length: num(data.length, 100),
            diameter: num(data.diameter, 1.2),
            n: num(data.n, 0.013),
            slope: num(data.slope, 0),
            entranceK: num(data.entranceK, 0),
            bendK: num(data.bendK, 0),
            exitK: num(data.exitK, 0),
            junctionK: num(data.junctionK, 0)
        });
    }

    function nodeOptions(selected) {
        return "<option value=\"\">--</option>" + model.nodes.map(function (n) {
            return "<option value=\"" + esc(n.id) + "\"" +
                (n.id === selected ? " selected" : "") + ">" + esc(n.id) + "</option>";
        }).join("");
    }

    function renderPipes() {
        var tbody = $("pipeTableBody");
        if (!tbody) { return; }

        tbody.innerHTML = model.pipes.map(function (p, i) {
            return "<tr data-index=\"" + i + "\">" +
                "<td><input data-f=\"id\" value=\"" + esc(p.id) + "\" aria-label=\"Pipe ID\"></td>" +
                "<td><select data-f=\"from\" aria-label=\"上游Node\">" + nodeOptions(p.from) + "</select></td>" +
                "<td><select data-f=\"to\" aria-label=\"下游Node\">" + nodeOptions(p.to) + "</select></td>" +
                "<td><input data-f=\"length\" type=\"number\" step=\"0.1\" min=\"0\" value=\"" + esc(p.length) + "\" aria-label=\"長度\"></td>" +
                "<td><input data-f=\"diameter\" type=\"number\" step=\"0.01\" min=\"0\" value=\"" + esc(p.diameter) + "\" aria-label=\"管徑\"></td>" +
                "<td><input data-f=\"n\" type=\"number\" step=\"0.001\" min=\"0\" value=\"" + esc(p.n) + "\" aria-label=\"Manning n\"></td>" +
                "<td><input data-f=\"entranceK\" type=\"number\" step=\"0.01\" min=\"0\" value=\"" + esc(p.entranceK) + "\" aria-label=\"入口K\"></td>" +
                "<td><input data-f=\"bendK\" type=\"number\" step=\"0.01\" min=\"0\" value=\"" + esc(p.bendK) + "\" aria-label=\"彎頭K\"></td>" +
                "<td><input data-f=\"exitK\" type=\"number\" step=\"0.01\" min=\"0\" value=\"" + esc(p.exitK) + "\" aria-label=\"出口K\"></td>" +
                "<td><button type=\"button\" class=\"btn btn-light\" data-action=\"del-pipe\">刪除</button></td>" +
                "</tr>";
        }).join("");

        refreshCounts();
    }

    function onPipeEdit(event) {
        var input = event.target;
        var tr = input.closest("tr");
        if (!tr || !input.dataset.f) { return; }

        var pipe = model.pipes[Number(tr.dataset.index)];
        if (!pipe) { return; }

        var f = input.dataset.f;

        if (f === "id") {
            var v = input.value.trim();
            if (!v || model.pipes.some(function (x) { return x !== pipe && x.id === v; })) {
                input.value = pipe.id;
                message("Pipe ID 不可空白或重複。", "warn");
                return;
            }
            pipe.id = v;
        } else if (f === "from" || f === "to") {
            pipe[f] = input.value;
        } else {
            var x = Number(input.value);
            pipe[f] = Number.isFinite(x) ? x : 0;
        }
    }

    function onPipeClick(event) {
        var btn = event.target.closest("[data-action='del-pipe']");
        if (!btn) { return; }
        var index = Number(btn.closest("tr").dataset.index);
        model.pipes.splice(index, 1);
        invalidateResults();
        renderPipes();
    }

    /* ------------------------------------------------------------
     * 示範案例
     * ---------------------------------------------------------- */

    var DEMO = {
        nodes: [
            { id: "N0", invert: 100.00, groundElevation: 102.50, inflow: 1.8 },
            { id: "N1", invert:  99.40, groundElevation: 101.90, inflow: 0.4 },
            { id: "N2", invert:  98.80, groundElevation: 101.20, inflow: 0 },
            { id: "N3", invert:  98.20, groundElevation: 100.70, inflow: 0, HGL: 99.05 }
        ],
        pipes: [
            { id: "P01", from: "N0", to: "N1", length: 120, diameter: 1.2, n: 0.013, entranceK: 0.2, bendK: 0,   exitK: 0   },
            { id: "P02", from: "N1", to: "N2", length: 130, diameter: 1.2, n: 0.013, entranceK: 0,   bendK: 0.1, exitK: 0   },
            { id: "P03", from: "N2", to: "N3", length: 140, diameter: 1.2, n: 0.013, entranceK: 0,   bendK: 0,   exitK: 0.3 }
        ]
    };

    function loadDemoNodes() {
        model.nodes.length = 0;
        model.boundary = {};
        clone(DEMO.nodes).forEach(addNode);
        invalidateResults();
        renderNodes();
        renderPipes();
    }

    function loadDemoPipes() {
        if (model.nodes.length === 0) { loadDemoNodes(); }
        model.pipes.length = 0;
        clone(DEMO.pipes).forEach(addPipe);
        invalidateResults();
        renderPipes();
    }

    function loadDemoCase() {
        model.nodes.length = 0;
        model.pipes.length = 0;
        model.boundary = {};
        clone(DEMO.nodes).forEach(addNode);
        clone(DEMO.pipes).forEach(addPipe);
        invalidateResults();
        renderNodes();
        renderPipes();
        message("已載入示範案例：" + model.nodes.length + " 個節點、" +
            model.pipes.length + " 支管段。示範數值非特定工程設計值。", "ok");
    }

    /* ------------------------------------------------------------
     * 輸入驗證
     * ---------------------------------------------------------- */

    function validateModel() {
        var errors = [];
        var warnings = [];

        if (model.nodes.length === 0) { errors.push("尚無節點資料。"); }
        if (model.pipes.length === 0) { errors.push("尚無管段資料。"); }
        if (errors.length) { return { errors: errors, warnings: warnings }; }

        var ids = new Set();
        model.nodes.forEach(function (n) {
            if (!n.id) { errors.push("有節點的 ID 為空白。"); }
            if (ids.has(n.id)) { errors.push("節點 ID 重複：" + n.id); }
            ids.add(n.id);
            if (!Number.isFinite(n.invert) || !Number.isFinite(n.groundElevation)) {
                errors.push("節點 " + n.id + " 的高程不是有效數字。");
            } else if (n.groundElevation <= n.invert) {
                warnings.push("節點 " + n.id + " 地面高程不高於管底高程。");
            }
            if (n.inflow < 0) { errors.push("節點 " + n.id + " 外部入流不可為負值。"); }
        });

        var pipeIds = new Set();
        model.pipes.forEach(function (p) {
            if (pipeIds.has(p.id)) { errors.push("管段 ID 重複：" + p.id); }
            pipeIds.add(p.id);

            if (!p.from || !p.to) {
                errors.push("管段 " + p.id + " 尚未指定上游或下游節點。");
            } else {
                if (!ids.has(p.from)) { errors.push("管段 " + p.id + " 的上游節點不存在：" + p.from); }
                if (!ids.has(p.to)) { errors.push("管段 " + p.id + " 的下游節點不存在：" + p.to); }
                if (p.from === p.to) { errors.push("管段 " + p.id + " 的上下游為同一節點。"); }
            }
            if (!(p.length > 0)) { errors.push("管段 " + p.id + " 長度必須大於 0。"); }
            if (!(p.diameter > 0)) { errors.push("管段 " + p.id + " 管徑必須大於 0。"); }
            if (!(p.n > 0)) { errors.push("管段 " + p.id + " Manning n 必須大於 0。"); }
        });
        if (errors.length) { return { errors: errors, warnings: warnings }; }

        // 環狀偵測（本引擎為樹狀／有向無環網路）
        var indeg = {};
        model.nodes.forEach(function (n) { indeg[n.id] = 0; });
        model.pipes.forEach(function (p) { indeg[p.to]++; });
        var queue = Object.keys(indeg).filter(function (k) { return indeg[k] === 0; });
        var visited = 0;
        while (queue.length) {
            var id = queue.shift();
            visited++;
            model.pipes.forEach(function (p) {
                if (p.from === id && --indeg[p.to] === 0) { queue.push(p.to); }
            });
        }
        if (visited < model.nodes.length) {
            errors.push("管網含有環狀連接（流向形成迴圈），目前穩態求解器僅支援有向無環管網。");
        }

        // 坡度由管底高程推得，下坡才有重力流
        model.pipes.forEach(function (p) {
            var a = model.nodes.find(function (n) { return n.id === p.from; });
            var b = model.nodes.find(function (n) { return n.id === p.to; });
            if (a && b) {
                var s = (a.invert - b.invert) / p.length;
                if (s <= 0) {
                    warnings.push("管段 " + p.id + " 管底坡度 ≤ 0（上游管底不高於下游），已採最小坡度計算，請確認管底高程。");
                }
            }
        });

        var hasInflow = model.nodes.some(function (n) { return n.inflow > 0; });
        if (!hasInflow) { errors.push("所有節點外部入流皆為 0，無流量可分析。"); }

        return { errors: errors, warnings: warnings };
    }

    /* 將表格資料同步成引擎讀取的全域變數 */
    function syncGlobals() {
        var byId = {};
        model.nodes.forEach(function (n) { byId[n.id] = n; });

        model.pipes.forEach(function (p) {
            var a = byId[p.from];
            var b = byId[p.to];
            var s = a && b && p.length > 0 ? (a.invert - b.invert) / p.length : 0;
            p.slope = s > MIN_SLOPE ? s : MIN_SLOPE;
        });

        var bc = { nodes: {} };
        Object.keys(model.boundary).forEach(function (id) {
            var v = model.boundary[id];
            if (Number.isFinite(v) && byId[id]) {
                bc.nodes[id] = { type: "outfall", HGL: v };
            }
        });

        window.nodes = model.nodes;
        window.pipes = model.pipes;
        window.v3BoundaryConditions = bc;
    }

    /* ------------------------------------------------------------
     * 成果管理
     * ---------------------------------------------------------- */

    function invalidateResults() {
        window.v3HydraulicSolution = undefined;
        window.v3HglEglSolution = undefined;
        window.v3CheckingSolution = undefined;
        chartPending = false;
        clearResultViews();
    }

    function clearResultViews() {
        ["hydraulicResultBody", "hglResultBody", "checkingResultBody"].forEach(function (id) {
            var el = $(id);
            if (el) { el.innerHTML = ""; }
        });
        ["summaryQ", "summaryV", "summaryHGL", "summaryEGL"].forEach(function (id) { setText(id, "-"); });
        ["hglMax", "eglMax", "backwaterMax"].forEach(function (id) { setText(id, "-"); });
        ["checkPassCount", "checkWarnCount", "checkFailCount", "checkTotalCount"].forEach(function (id) { setText(id, "0"); });
        setText("solverStatus", "尚未計算");
        setText("checkingStatus", "尚未檢核");

        if (window.__v3Chart) {
            window.__v3Chart.destroy();
            window.__v3Chart = null;
        }
        var chartBox = $("hydraulicProfileChart");
        if (chartBox && !chartBox.querySelector("canvas")) {
            chartBox.innerHTML = "<canvas id=\"hydraulicProfileCanvas\"></canvas>";
        }
    }

    function refreshCounts() {
        setText("nodeCount", String(model.nodes.length));
        setText("pipeCount", String(model.pipes.length));
    }

    /* ------------------------------------------------------------
     * 分析流程
     * ---------------------------------------------------------- */

    function prepare() {
        var v = validateModel();
        if (v.errors.length) {
            message("輸入資料有誤，無法分析：\n• " + v.errors.join("\n• "), "error");
            return false;
        }
        syncGlobals();
        if (v.warnings.length) {
            message("提醒：\n• " + v.warnings.join("\n• "), "warn");
        } else {
            message("", "info");
        }
        return true;
    }

    function readNumber(id, fallback) {
        var el = $(id);
        return el ? num(el.value, fallback) : fallback;
    }

    function runHydraulic() {
        if (!prepare()) { return null; }

        if (typeof window.solveNetworkContinuity !== "function" &&
            typeof solveNetworkContinuity === "undefined") {
            message("找不到水理引擎（js/hydraulic.js 未載入）。", "error");
            return null;
        }

        try {
            var solution = solveNetworkContinuity({
                maxNetworkIterations: Math.max(1, Math.floor(readNumber("maxIterationInput", 100))),
                flowTolerance: Math.max(1e-12, readNumber("solverToleranceInput", 1e-6))
            });

            window.v3HglEglSolution = undefined;
            window.v3CheckingSolution = undefined;

            renderHydraulic(solution, null);
            refreshCounts();
            setText("solverStatus", solution.converged ? "✓ 已收斂" : "⚠ 未收斂");

            if (!solution.converged) {
                message("水理求解未在最大迭代次數內收斂，成果僅供參考，請檢查資料或提高迭代次數。", "warn");
            }
            return solution;

        } catch (error) {
            console.error(error);
            message("水理分析失敗：" + error.message, "error");
            setText("solverStatus", "計算失敗");
            return null;
        }
    }

    function runHgl() {
        if (!window.v3HydraulicSolution) {
            message("請先執行水理分析。", "warn");
            return null;
        }
        if (!window.V3HglEgl) {
            message("找不到 HGL/EGL 引擎（js/hgl-egl.js 未載入）。", "error");
            return null;
        }

        try {
            var result = window.V3HglEgl.calculate({
                gravity: 9.80665,
                includeVelocityHead: true,
                propagateBackwater: true,
                defaultKEntrance: 0,
                defaultKExit: 0,
                defaultKMinor: 0,
                useSolvedDepthAsFallback: true
            });

            renderHgl(result);
            renderHydraulic(window.v3HydraulicSolution, result);
            chartPending = true;
            return result;

        } catch (error) {
            console.error(error);
            message("HGL/EGL 計算失敗：" + error.message, "error");
            return null;
        }
    }

    function drawChart() {
        var result = window.v3HglEglSolution;
        if (!result) {
            message("請先計算 HGL / EGL。", "warn");
            return;
        }
        if (typeof Chart === "undefined") {
            message("找不到 Chart.js（CDN 載入失敗，請確認網路連線）。表格成果仍可使用。", "warn");
            return;
        }
        try {
            // 圖表必須在可見狀態下繪製，否則尺寸為 0
            window.V3HglEgl.drawProfile(result, "hydraulicProfileChart");
            chartPending = false;
        } catch (error) {
            console.error(error);
            message("縱剖面繪製失敗：" + error.message, "error");
        }
    }

    function applyCheckingConfig() {
        if (!window.V3Checking) { return; }
        window.V3Checking.setConfig({
            velocity: {
                enabled: ($("checkVelocityEnabled") || {}).value !== "false",
                min: readNumber("checkVmin", 0.8),
                max: readNumber("checkVmax", 3.0)
            },
            pipeDiameter: {
                min: readNumber("checkMinDiameter", 0.8)
            },
            nodeContinuity: {
                absoluteTolerance: Math.max(0, readNumber("checkNodeTolerance", 1e-6))
            },
            surcharge: {
                enabled: ($("checkSurcharge") || {}).value !== "false"
            }
        });
    }

    function runChecking() {
        if (!window.v3HglEglSolution) {
            message("請先計算 HGL / EGL，再執行工程檢核。", "warn");
            return null;
        }
        if (!window.V3Checking) {
            message("找不到工程檢核引擎（js/checking.js 未載入）。", "error");
            return null;
        }
        try {
            applyCheckingConfig();
            var result = window.V3Checking.run();
            renderChecking(result);
            return result;
        } catch (error) {
            console.error(error);
            message("工程檢核失敗：" + error.message, "error");
            return null;
        }
    }

    function runFull() {
        var h = runHydraulic();
        if (!h) { return false; }
        var g = runHgl();
        if (!g) { return false; }
        var c = runChecking();
        return !!c;
    }

    /* ------------------------------------------------------------
     * 顯示：水理成果
     * ---------------------------------------------------------- */

    var REGIME = { supercritical: "急流", subcritical: "緩流", critical: "臨界流" };

    function regimeText(r) {
        if (r.surcharge) { return "壓力流"; }
        if (r.full) { return "滿管"; }
        return REGIME[r.regime] || r.regime || "-";
    }

    function renderHydraulic(solution, hgl) {
        var tbody = $("hydraulicResultBody");
        if (!tbody || !solution) { return; }

        var loss = {};
        if (hgl && Array.isArray(hgl.records)) {
            hgl.records.forEach(function (r) { loss[r.id] = r; });
        }

        tbody.innerHTML = solution.pipeResults.map(function (r) {
            var l = loss[r.pipeId];
            return "<tr>" +
                "<td>" + esc(r.pipeId) + "</td>" +
                "<td>" + fmt(r.Q, 4) + "</td>" +
                "<td>" + fmt(r.depth, 3) + "</td>" +
                "<td>" + fmt(r.velocity, 3) + "</td>" +
                "<td>" + fmt(r.area, 4) + "</td>" +
                "<td>" + fmt(r.hydraulicRadius, 4) + "</td>" +
                "<td>" + fmt(r.froude, 3) + "</td>" +
                "<td>" + esc(regimeText(r)) + "</td>" +
                "<td>" + (l ? fmt(l.frictionLoss, 4) : "-") + "</td>" +
                "<td>" + (l ? fmt(l.localLoss, 4) : "-") + "</td>" +
                "</tr>";
        }).join("");

        var outfallQ = 0;
        (solution.nodeResults || []).forEach(function (n) {
            if (!n.outgoingPipes || n.outgoingPipes.length === 0) { outfallQ += n.Qin + n.Qlocal; }
        });
        var maxV = Math.max.apply(null, solution.pipeResults.map(function (r) { return Number(r.velocity) || 0; }));

        setText("summaryQ", fmt(outfallQ, 3) + " m³/s");
        setText("summaryV", fmt(maxV, 3) + " m/s");
    }

    /* ------------------------------------------------------------
     * 顯示：HGL / EGL
     * ---------------------------------------------------------- */

    function renderHgl(result) {
        var tbody = $("hglResultBody");
        if (!tbody || !result) { return; }

        tbody.innerHTML = result.records.map(function (r) {
            return "<tr>" +
                "<td>" + esc(r.id) + "</td>" +
                "<td>" + fmt(r.upstreamInvert) + "</td>" +
                "<td>" + fmt(r.downstreamInvert) + "</td>" +
                "<td>" + fmt(r.upstreamHGL) + "</td>" +
                "<td>" + fmt(r.downstreamHGL) + "</td>" +
                "<td>" + fmt(r.upstreamEGL) + "</td>" +
                "<td>" + fmt(r.downstreamEGL) + "</td>" +
                "<td>" + fmt(r.frictionLoss, 4) + "</td>" +
                "<td>" + fmt(r.localLoss, 4) + "</td>" +
                "<td>" + fmt(r.upstreamBackwater, 3) + "</td>" +
                "</tr>";
        }).join("");

        var s = result.statistics || {};
        setText("hglMax", fmt(s.maxHGL));
        setText("eglMax", fmt(s.maxEGL));
        setText("backwaterMax", fmt(s.maxBackwater));
        setText("summaryHGL", fmt(s.maxHGL) + " m");
        setText("summaryEGL", fmt(s.maxEGL) + " m");
    }

    /* ------------------------------------------------------------
     * 顯示：工程檢核
     * ---------------------------------------------------------- */

    var CHECK_LABELS = {
        velocity:  "流速",
        diameter:  "最小管徑",
        fullFlow:  "滿管狀態",
        surcharge: "Surcharge / 壓力流",
        ground:    "HGL 對地面高程",
        external:  "外水位"
    };

    function badge(status) {
        var cls = status === "PASS" ? "badge-pass" :
                  status === "WARN" ? "badge-warn" :
                  status === "FAIL" ? "badge-fail" : "badge-neutral";
        return "<span class=\"badge " + cls + "\">" + esc(status || "-") + "</span>";
    }

    function renderChecking(result) {
        var tbody = $("checkingResultBody");
        if (!tbody || !result) { return; }

        var cfg = result.config || {};
        var rows = [];

        (result.pipeResults || []).forEach(function (p) {
            Object.keys(CHECK_LABELS).forEach(function (key) {
                var c = p.checks && p.checks[key];
                if (!c) { return; }

                var value = "-", lower = "-", upper = "-";
                if (key === "velocity") {
                    value = fmt(c.value); lower = fmt(cfg.velocity && cfg.velocity.min, 2);
                    upper = fmt(cfg.velocity && cfg.velocity.max, 2);
                } else if (key === "diameter") {
                    value = fmt(c.value); lower = fmt(cfg.pipeDiameter && cfg.pipeDiameter.min, 3);
                } else if (key === "fullFlow") {
                    value = fmt(c.ratio); upper = fmt(cfg.fullFlow && cfg.fullFlow.fullRatio, 2);
                } else if (c.excess !== undefined) {
                    value = fmt(c.excess); upper = "0.000";
                }

                rows.push({ target: "管 " + p.pipeId, item: CHECK_LABELS[key],
                    value: value, lower: lower, upper: upper,
                    status: c.status, text: c.message || "" });
            });
        });

        (result.nodeResults || []).forEach(function (n) {
            rows.push({ target: "節點 " + n.nodeId, item: "節點連續",
                value: fmt(n.balance, 6), lower: "-", upper: fmt(n.relativeError, 3) + " %",
                status: n.status,
                text: "Qin " + fmt(n.inflow, 3) + " + 外部 " + fmt(n.externalInflow, 3) +
                      " − Qout " + fmt(n.outflow, 3) });
        });

        tbody.innerHTML = rows.map(function (r) {
            return "<tr><td>" + esc(r.target) + "</td><td>" + esc(r.item) + "</td><td>" +
                esc(r.value) + "</td><td>" + esc(r.lower) + "</td><td>" + esc(r.upper) +
                "</td><td>" + badge(r.status) + "</td><td style=\"text-align:left\">" +
                esc(r.text) + "</td></tr>";
        }).join("");

        var pass = rows.filter(function (r) { return r.status === "PASS"; }).length;
        var warn = rows.filter(function (r) { return r.status === "WARN"; }).length;
        var fail = rows.filter(function (r) { return r.status === "FAIL"; }).length;

        setText("checkPassCount", String(pass));
        setText("checkWarnCount", String(warn));
        setText("checkFailCount", String(fail));
        setText("checkTotalCount", String(rows.length));

        var sys = result.systemStatus;
        setText("checkingStatus", sys === "PASS" ? "✓ 全部通過" :
            sys === "WARN" ? "⚠ 有警告 (" + warn + ")" : "✗ 有不符項目 (" + fail + ")");
    }

    /* ------------------------------------------------------------
     * 事件綁定（event delegation，重繪表格後仍有效）
     * ---------------------------------------------------------- */

    function bind(id, handler) {
        var el = $(id);
        if (el) { el.addEventListener("click", handler); }
    }

    function init() {
        ensureMessageBox();

        var nodeBody = $("nodeTableBody");
        var pipeBody = $("pipeTableBody");
        if (nodeBody) {
            nodeBody.addEventListener("change", onNodeEdit);
            nodeBody.addEventListener("click", onNodeClick);
        }
        if (pipeBody) {
            pipeBody.addEventListener("change", onPipeEdit);
            pipeBody.addEventListener("click", onPipeClick);
        }

        bind("addNodeBtn", function () {
            addNode();
            invalidateResults();
            renderNodes();
            renderPipes();
        });
        bind("loadDemoNodeBtn", loadDemoNodes);
        bind("clearNodeBtn", function () {
            if (model.nodes.length &&
                !window.confirm("清除全部節點？管段的上下游參照也會被清空。")) { return; }
            model.nodes.length = 0;
            model.boundary = {};
            model.pipes.forEach(function (p) { p.from = ""; p.to = ""; });
            invalidateResults();
            renderNodes();
            renderPipes();
        });

        bind("addPipeBtn", function () {
            addPipe();
            invalidateResults();
            renderPipes();
        });
        bind("loadDemoPipeBtn", loadDemoPipes);
        bind("clearPipeBtn", function () {
            if (model.pipes.length && !window.confirm("清除全部管段？")) { return; }
            model.pipes.length = 0;
            invalidateResults();
            renderPipes();
        });

        bind("runHydraulicBtn", runHydraulic);
        bind("runFullAnalysisBtn", function () {
            if (runFull()) { message("水理、HGL/EGL 與工程檢核已完成。", "ok"); }
        });
        bind("resetSolutionBtn", function () {
            invalidateResults();
            message("已清除計算成果（輸入資料保留）。", "info");
        });

        bind("calculateHglBtn", function () {
            if (!window.v3HydraulicSolution && !runHydraulic()) { return; }
            if (runHgl()) { drawChart(); }
        });
        bind("drawProfileBtn", function () {
            if (!window.v3HglEglSolution) {
                if (!window.v3HydraulicSolution && !runHydraulic()) { return; }
                if (!runHgl()) { return; }
            }
            drawChart();
        });

        bind("runCheckingBtn", function () {
            if (!window.v3HglEglSolution) {
                if (!window.v3HydraulicSolution && !runHydraulic()) { return; }
                if (!runHgl()) { return; }
            }
            runChecking();
        });

        bind("loadDemoCaseBtn", function () {
            loadDemoCase();
            showTab("tab-nodes");
        });

        bind("runDemoCaseBtn", function () {
            loadDemoCase();
            if (runFull()) {
                message("已載入示範案例並完成：水理 → HGL/EGL → 工程檢核。", "ok");
                showTab("tab-hgl");
            }
        });

        // 切換到 HGL 頁時補畫縱剖面（隱藏分頁中 Chart.js 無法取得尺寸）
        var hglTab = document.querySelector('[data-tab="tab-hgl"]');
        if (hglTab) {
            hglTab.addEventListener("click", function () {
                if (chartPending) {
                    window.requestAnimationFrame(drawChart);
                }
            });
        }

        renderNodes();
        renderPipes();
        clearResultViews();
    }

    /* 供 export.js 與除錯使用 */
    window.V3UI = {
        model: model,
        runHydraulic: runHydraulic,
        runHgl: runHgl,
        runChecking: runChecking,
        runFull: runFull,
        loadDemoCase: loadDemoCase,
        message: message
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})(window, document);
