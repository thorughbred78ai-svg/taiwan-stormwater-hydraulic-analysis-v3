/* ================================================================
 * 台灣雨水下水道數值水理分析 V3
 *
 * File:
 *     app_.js
 *
 * Purpose:
 *     V3 主程式
 *
 *     功能：
 *       1. 建立 / 載入完整示範案例
 *       2. 建立 nodes / pipes
 *       3. 建立 v3HydraulicSolution.pipeResults
 *       4. 呼叫 js/hgl-egl.js
 *       5. 顯示 HGL / EGL
 *       6. 顯示縱剖面
 *       7. 顯示計算成果
 *       8. 支援 JSON 案例載入
 *
 * 注意：
 *     本檔案可獨立作為 V3 demo app controller。
 *
 *     需要：
 *
 *       Chart.js
 *       js/hgl-egl.js
 *
 * ================================================================ */

(function (window, document) {

    "use strict";


    /* ============================================================
     * Global
     * ============================================================ */

    const APP_VERSION =
        "V3.0.0";


    const G =
        9.80665;


    let currentCase =
        null;


    let currentHglEgl =
        null;


    /* ============================================================
     * Demo Case
     *
     * 系統：
     *
     * N0
     *  |
     * P01
     *  |
     * N1
     *  |
     * P02
     *  |
     * N2
     *  |
     * P03
     *  |
     * N3 outlet
     *
     * ============================================================ */

    const DEMO_CASE = {

        meta: {

            id:
                "TAIWAN_RAINWATER_DEMO_01",

            name:
                "台灣雨水下水道示範案例－三管段",

            description:
                "穩態 / 準穩態雨水下水道 HGL / EGL 示範",

            version:
                APP_VERSION,

            unitSystem:
                "SI",

            country:
                "Taiwan"

        },


        /* ========================================================
         * Nodes
         * ======================================================== */

        nodes: [

            {

                id:
                    "N0",

                name:
                    "N0 上游集水節點",

                type:
                    "junction",

                invert:
                    100.00,

                groundElevation:
                    102.50,

                x:
                    0,

                y:
                    0

            },


            {

                id:
                    "N1",

                name:
                    "N1 中間節點",

                type:
                    "junction",

                invert:
                    99.40,

                groundElevation:
                    101.90,

                x:
                    120,

                y:
                    0

            },


            {

                id:
                    "N2",

                name:
                    "N2 中間節點",

                type:
                    "junction",

                invert:
                    98.80,

                groundElevation:
                    101.20,

                x:
                    250,

                y:
                    0

            },


            {

                id:
                    "N3",

                name:
                    "N3 下游出口",

                type:
                    "outfall",

                invert:
                    98.20,

                groundElevation:
                    100.70,

                x:
                    390,

                y:
                    0

            }

        ],


        /* ========================================================
         * Pipes
         * ======================================================== */

        pipes: [

            {

                id:
                    "P01",

                name:
                    "P01",

                from:
                    "N0",

                to:
                    "N1",

                length:
                    120,

                diameter:
                    1.20,

                n:
                    0.013,

                slope:
                    0.005,

                material:
                    "RC",

                entranceK:
                    0.20,

                exitK:
                    0.00,

                bendK:
                    0.00,

                junctionK:
                    0.05

            },


            {

                id:
                    "P02",

                name:
                    "P02",

                from:
                    "N1",

                to:
                    "N2",

                length:
                    130,

                diameter:
                    1.20,

                n:
                    0.013,

                slope:
                    0.004615,

                material:
                    "RC",

                entranceK:
                    0.00,

                exitK:
                    0.00,

                bendK:
                    0.10,

                junctionK:
                    0.05

            },


            {

                id:
                    "P03",

                name:
                    "P03",

                from:
                    "N2",

                to:
                    "N3",

                length:
                    140,

                diameter:
                    1.20,

                n:
                    0.013,

                slope:
                    0.004286,

                material:
                    "RC",

                entranceK:
                    0.00,

                exitK:
                    0.30,

                bendK:
                    0.00,

                junctionK:
                    0.05

            }

        ],


        /* ========================================================
         * Hydraulic results
         *
         * 這裡模擬前端 hydraulic solver 已完成。
         *
         * app.js 會將資料放入：
         *
         * window.v3HydraulicSolution.pipeResults
         *
         * ======================================================== */

        pipeResults: [

            {

                pipeId:
                    "P01",

                Q:
                    1.80,

                depth:
                    0.48,

                velocity:
                    2.05

            },


            {

                pipeId:
                    "P02",

                Q:
                    2.20,

                depth:
                    0.55,

                velocity:
                    2.35

            },


            {

                pipeId:
                    "P03",

                Q:
                    2.20,

                depth:
                    0.56,

                velocity:
                    2.30

            }

        ],


        /* ========================================================
         * Boundary Conditions
         * ======================================================== */

        boundaryConditions: {

            nodes: {

                N3: {

                    type:
                        "outfall",

                    HGL:
                        99.05

                }

            }

        }

    };


    /* ============================================================
     * Utility
     * ============================================================ */

    function $(id) {

        return document.getElementById(id);

    }


    function createElement(
        tag,
        className,
        text
    ) {

        const el =
            document.createElement(
                tag
            );


        if (className) {

            el.className =
                className;

        }


        if (
            text !== undefined
        ) {

            el.textContent =
                text;

        }


        return el;

    }


    function number(
        value,
        digits = 3
    ) {

        const x =
            Number(value);


        if (
            !Number.isFinite(x)
        ) {

            return "-";

        }


        return x.toFixed(
            digits
        );

    }


    function clone(
        object
    ) {

        return JSON.parse(
            JSON.stringify(
                object
            )
        );

    }


    /* ============================================================
     * DOM
     * ============================================================ */

    function ensureAppDOM() {

        let app =
            $("v3-app");


        if (
            !app
        ) {

            app =
                document.createElement(
                    "div"
                );


            app.id =
                "v3-app";


            document.body.appendChild(
                app
            );

        }


        /*
         * 如果使用者已有畫面，
         * 不覆蓋原有 DOM。
         */

        if (
            !$("v3-case-title")
        ) {

            buildAppDOM(
                app
            );

        }

    }


    function buildAppDOM(
        app
    ) {

        app.innerHTML = `

            <div
                id="v3-header"
                style="
                    padding:16px;
                    background:#0d6efd;
                    color:white;
                    border-radius:8px;
                    margin-bottom:16px;
                "
            >

                <div
                    style="
                        font-size:24px;
                        font-weight:700;
                    "
                >
                    台灣雨水下水道數值水理分析 V3
                </div>

                <div
                    id="v3-case-title"
                    style="
                        margin-top:6px;
                        opacity:.9;
                    "
                >
                    示範案例
                </div>

            </div>


            <div
                style="
                    display:flex;
                    gap:8px;
                    flex-wrap:wrap;
                    margin-bottom:16px;
                "
            >

                <button
                    id="v3-load-demo"
                    type="button"
                >
                    載入完整示範案例
                </button>


                <button
                    id="v3-run"
                    type="button"
                >
                    執行 HGL / EGL
                </button>


                <button
                    id="v3-clear"
                    type="button"
                >
                    清除成果
                </button>


                <label
                    style="
                        display:inline-flex;
                        align-items:center;
                        gap:6px;
                    "
                >

                    <span>
                        JSON 案例：
                    </span>

                    <input
                        id="v3-json-file"
                        type="file"
                        accept=".json,application/json"
                    >

                </label>

            </div>


            <div
                id="v3-status"
                style="
                    padding:10px;
                    background:#f8f9fa;
                    border:1px solid #dee2e6;
                    border-radius:6px;
                    margin-bottom:16px;
                "
            >
                尚未載入案例。
            </div>


            <section
                style="
                    margin-bottom:24px;
                "
            >

                <h3>
                    管段資料
                </h3>

                <div
                    style="
                        overflow:auto;
                    "
                >

                    <table
                        id="v3-pipe-table"
                        style="
                            width:100%;
                            border-collapse:collapse;
                        "
                    ></table>

                </div>

            </section>


            <section
                style="
                    margin-bottom:24px;
                "
            >

                <h3>
                    HGL / EGL 縱剖面
                </h3>

                <div
                    id="v3-profile-chart"
                    style="
                        width:100%;
                        height:430px;
                    "
                ></div>

            </section>


            <section
                style="
                    margin-bottom:24px;
                "
            >

                <h3>
                    節點 HGL
                </h3>

                <div
                    style="
                        overflow:auto;
                    "
                >

                    <table
                        id="v3-node-table"
                        style="
                            width:100%;
                            border-collapse:collapse;
                        "
                    ></table>

                </div>

            </section>


            <section>

                <h3>
                    分析摘要
                </h3>

                <div
                    id="v3-summary"
                ></div>

            </section>

        `;


        bindEvents();

    }


    /* ============================================================
     * Events
     * ============================================================ */

    function bindEvents() {

        const loadButton =
            $("v3-load-demo");


        if (
            loadButton
        ) {

            loadButton.addEventListener(
                "click",
                function () {

                    loadDemoCase();

                }
            );

        }


        const runButton =
            $("v3-run");


        if (
            runButton
        ) {

            runButton.addEventListener(
                "click",
                function () {

                    runAnalysis();

                }
            );

        }


        const clearButton =
            $("v3-clear");


        if (
            clearButton
        ) {

            clearButton.addEventListener(
                "click",
                function () {

                    clearResults();

                }
            );

        }


        const fileInput =
            $("v3-json-file");


        if (
            fileInput
        ) {

            fileInput.addEventListener(
                "change",
                handleJSONFile
            );

        }

    }


    /* ============================================================
     * Load Demo
     * ============================================================ */

    function loadDemoCase() {

        currentCase =
            clone(
                DEMO_CASE
            );


        /*
         * 建立全域資料。
         */

        window.nodes =
            currentCase.nodes;


        window.pipes =
            currentCase.pipes;


        window.v3BoundaryConditions =
            currentCase.boundaryConditions;


        /*
         * 模擬 hydraulic solver 的輸出。
         *
         * hgl-egl.js 要讀：
         *
         * window.v3HydraulicSolution.pipeResults
         */

        window.v3HydraulicSolution = {

            nodes:
                currentCase.nodes,

            pipes:
                currentCase.pipes,

            pipeResults:
                currentCase.pipeResults,

            boundaryConditions:
                currentCase.boundaryConditions,

            model:
                "V3 demo hydraulic solution"

        };


        /*
         * 更新 UI。
         */

        updateCaseTitle();


        setStatus(
            "已載入完整示範案例，共 " +
            currentCase.nodes.length +
            " 個節點、" +
            currentCase.pipes.length +
            " 支管段。"
        );


        renderPipeTable(
            currentCase
        );


        renderNodeTable(
            currentCase.nodes,
            null
        );


        /*
         * 自動執行。
         */

        runAnalysis();

    }


    /* ============================================================
     * JSON Case
     * ============================================================ */

    function handleJSONFile(
        event
    ) {

        const file =
            event.target.files &&
            event.target.files[0];


        if (
            !file
        ) {

            return;

        }


        const reader =
            new FileReader();


        reader.onload =
            function () {

                try {

                    const data =
                        JSON.parse(
                            reader.result
                        );


                    loadCase(
                        data
                    );

                }
                catch (error) {

                    console.error(
                        error
                    );


                    setStatus(
                        "JSON 載入失敗：" +
                        error.message,
                        true
                    );

                }

            };


        reader.readAsText(
            file,
            "utf-8"
        );

    }


    /* ============================================================
     * Generic Load Case
     * ============================================================ */

    function loadCase(
        data
    ) {

        if (
            !data ||
            typeof data !== "object"
        ) {

            throw new Error(
                "案例資料格式錯誤。"
            );

        }


        const nodes =
            Array.isArray(
                data.nodes
            )
                ? data.nodes
                : [];


        const pipes =
            Array.isArray(
                data.pipes
            )
                ? data.pipes
                : [];


        if (
            nodes.length === 0
        ) {

            throw new Error(
                "案例沒有 nodes。"
            );

        }


        if (
            pipes.length === 0
        ) {

            throw new Error(
                "案例沒有 pipes。"
            );

        }


        /*
         * 如果 JSON 已經包含：
         *
         * pipeResults
         *
         * 直接使用。
         *
         * 否則自動產生一組 demo-like
         * hydraulic results。
         */

        let pipeResults =
            Array.isArray(
                data.pipeResults
            )
                ? data.pipeResults
                : [];


        if (
            pipeResults.length === 0
        ) {

            pipeResults =
                pipes.map(
                    function (pipe) {

                        return {

                            pipeId:
                                pipe.id,

                            Q:
                                Number(
                                    pipe.Q ||
                                    pipe.flow ||
                                    1.0
                                ),

                            depth:
                                Number(
                                    pipe.depth ||
                                    pipe.normalDepth ||
                                    0.30
                                )

                        };

                    }
                );

        }


        currentCase = {

            meta:
                data.meta ||
                {
                    id:
                        "JSON_CASE",

                    name:
                        "JSON 載入案例"

                },

            nodes,

            pipes,

            pipeResults,

            boundaryConditions:
                data.boundaryConditions ||
                data.boundaries ||
                {}

        };


        window.nodes =
            currentCase.nodes;


        window.pipes =
            currentCase.pipes;


        window.v3BoundaryConditions =
            currentCase.boundaryConditions;


        window.v3HydraulicSolution = {

            nodes:
                currentCase.nodes,

            pipes:
                currentCase.pipes,

            pipeResults:
                currentCase.pipeResults,

            boundaryConditions:
                currentCase.boundaryConditions,

            model:
                "V3 JSON hydraulic solution"

        };


        updateCaseTitle();


        renderPipeTable(
            currentCase
        );


        setStatus(
            "已載入 JSON 案例。"
        );


        runAnalysis();

    }


    /* ============================================================
     * Run Analysis
     * ============================================================ */

    function runAnalysis() {

        if (
            !window.v3HydraulicSolution
        ) {

            setStatus(
                "尚未載入案例，先載入完整示範案例。",
                true
            );


            return;

        }


        if (
            !window.V3HglEgl
        ) {

            setStatus(
                "找不到 V3HglEgl。請確認 index.html 已載入 js/hgl-egl.js。",
                true
            );


            return;

        }


        try {

            currentHglEgl =
                window.V3HglEgl.calculate({

                    gravity:
                        G,

                    includeVelocityHead:
                        true,

                    propagateBackwater:
                        true,

                    defaultKEntrance:
                        0,

                    defaultKExit:
                        0,

                    defaultKMinor:
                        0,

                    useSolvedDepthAsFallback:
                        true

                });


            /*
             * 結果表。
             */

            renderPipeTable(
                currentCase,
                currentHglEgl
            );


            renderNodeTable(
                currentCase.nodes,
                currentHglEgl
            );


            renderSummary(
                currentHglEgl
            );


            /*
             * Chart
             */

            if (
                $("v3-profile-chart")
            ) {

                window.V3HglEgl.drawProfile(
                    currentHglEgl,
                    "v3-profile-chart"
                );

            }


            setStatus(
                "HGL / EGL 分析完成。"
            );

        }
        catch (error) {

            console.error(
                error
            );


            setStatus(
                "HGL / EGL 計算失敗：" +
                error.message,
                true
            );

        }

    }


    /* ============================================================
     * Clear
     * ============================================================ */

    function clearResults() {

        currentHglEgl =
            null;


        window.v3HglEglSolution =
            null;


        const pipeTable =
            $("v3-pipe-table");


        if (
            pipeTable
        ) {

            pipeTable.innerHTML =
                "";

        }


        const nodeTable =
            $("v3-node-table");


        if (
            nodeTable
        ) {

            nodeTable.innerHTML =
                "";

        }


        const summary =
            $("v3-summary");


        if (
            summary
        ) {

            summary.innerHTML =
                "";

        }


        const chart =
            $("v3-profile-chart");


        if (
            chart
        ) {

            chart.innerHTML =
                "";

        }


        setStatus(
            "已清除分析成果。"
        );

    }


    /* ============================================================
     * UI Status
     * ============================================================ */

    function setStatus(
        message,
        isError = false
    ) {

        const el =
            $("v3-status");


        if (
            !el
        ) {

            return;

        }


        el.textContent =
            message;


        el.style.background =
            isError
                ? "#f8d7da"
                : "#f8f9fa";


        el.style.color =
            isError
                ? "#842029"
                : "#212529";


        el.style.borderColor =
            isError
                ? "#f5c2c7"
                : "#dee2e6";

    }


    function updateCaseTitle() {

        const title =
            $("v3-case-title");


        if (
            !title
        ) {

            return;

        }


        const meta =
            currentCase &&
            currentCase.meta;


        title.textContent =
            meta &&
            meta.name
                ? meta.name
                : "V3 案例";

    }


    /* ============================================================
     * Table CSS
     * ============================================================ */

    function styleTable(
        table
    ) {

        table.style.width =
            "100%";


        table.style.borderCollapse =
            "collapse";


        const cells =
            table.querySelectorAll(
                "th, td"
            );


        cells.forEach(
            function (cell) {

                cell.style.border =
                    "1px solid #dee2e6";

                cell.style.padding =
                    "7px 8px";

                cell.style.textAlign =
                    "right";

            }
        );


        const headers =
            table.querySelectorAll(
                "th"
            );


        headers.forEach(
            function (th) {

                th.style.background =
                    "#f1f3f5";

                th.style.fontWeight =
                    "600";

            }
        );

    }


    /* ============================================================
     * Pipe Table
     * ============================================================ */

    function renderPipeTable(
        data,
        analysis
    ) {

        const table =
            $("v3-pipe-table");


        if (
            !table
        ) {

            return;

        }


        table.innerHTML =
            "";


        const header =
            document.createElement(
                "tr"
            );


        [

            "Pipe",

            "From",

            "To",

            "Length (m)",

            "D (m)",

            "Q (m³/s)",

            "Depth (m)",

            "Velocity (m/s)",

            "hf (m)",

            "hm (m)",

            "HGL Up",

            "HGL Down",

            "EGL Up",

            "EGL Down"

        ].forEach(
            function (text) {

                const th =
                    document.createElement(
                        "th"
                    );


                th.textContent =
                    text;


                header.appendChild(
                    th
                );

            }
        );


        table.appendChild(
            header
        );


        const records =
            analysis &&
            Array.isArray(
                analysis.records
            )
                ? analysis.records
                : data.pipes.map(
                    function (pipe) {

                        const result =
                            data.pipeResults.find(
                                function (r) {

                                    return String(
                                        r.pipeId
                                    ) === String(
                                        pipe.id
                                    );

                                }
                            ) || {};


                        return {

                            ...pipe,

                            Q:
                                result.Q,

                            depth:
                                result.depth,

                            velocity:
                                result.velocity

                        };

                    }
                );


        records.forEach(
            function (p) {

                const tr =
                    document.createElement(
                        "tr"
                    );


                const values = [

                    p.id,

                    p.from,

                    p.to,

                    number(
                        p.length,
                        1
                    ),

                    number(
                        p.diameter,
                        3
                    ),

                    number(
                        p.Q,
                        4
                    ),

                    number(
                        p.depth,
                        3
                    ),

                    number(
                        p.velocity,
                        3
                    ),

                    number(
                        p.frictionLoss,
                        4
                    ),

                    number(
                        p.localLoss,
                        4
                    ),

                    number(
                        p.upstreamHGL,
                        3
                    ),

                    number(
                        p.downstreamHGL,
                        3
                    ),

                    number(
                        p.upstreamEGL,
                        3
                    ),

                    number(
                        p.downstreamEGL,
                        3
                    )

                ];


                values.forEach(
                    function (value) {

                        const td =
                            document.createElement(
                                "td"
                            );


                        td.textContent =
                            value;


                        tr.appendChild(
                            td
                        );

                    }
                );


                table.appendChild(
                    tr
                );

            }
        );


        styleTable(
            table
        );

    }


    /* ============================================================
     * Node Table
     * ============================================================ */

    function renderNodeTable(
        nodes,
        analysis
    ) {

        const table =
            $("v3-node-table");


        if (
            !table
        ) {

            return;

        }


        table.innerHTML =
            "";


        const tr =
            document.createElement(
                "tr"
            );


        [

            "Node",

            "Type",

            "Invert (m)",

            "Ground (m)",

            "HGL (m)",

            "Depth above invert (m)"

        ].forEach(
            function (text) {

                const th =
                    document.createElement(
                        "th"
                    );


                th.textContent =
                    text;


                tr.appendChild(
                    th
                );

            }
        );


        table.appendChild(
            tr
        );


        nodes.forEach(
            function (node) {

                const nodeId =
                    String(
                        node.id
                    );


                let hgl =
                    NaN;


                if (
                    analysis &&
                    analysis.nodeHGL
                ) {

                    hgl =
                        analysis.nodeHGL.get(
                            nodeId
                        );

                }


                const invert =
                    Number(
                        node.invert
                    );


                const depth =
                    Number.isFinite(
                        hgl
                    ) &&
                    Number.isFinite(
                        invert
                    )
                        ? hgl - invert
                        : NaN;


                const row =
                    document.createElement(
                        "tr"
                    );


                [

                    nodeId,

                    node.type || "-",

                    number(
                        invert,
                        3
                    ),

                    number(
                        node.groundElevation,
                        3
                    ),

                    number(
                        hgl,
                        3
                    ),

                    number(
                        depth,
                        3
                    )

                ].forEach(
                    function (value) {

                        const td =
                            document.createElement(
                                "td"
                            );


                        td.textContent =
                            value;


                        row.appendChild(
                            td
                        );

                    }
                );


                table.appendChild(
                    row
                );

            }
        );


        styleTable(
            table
        );

    }


    /* ============================================================
     * Summary
     * ============================================================ */

    function renderSummary(
        analysis
    ) {

        const container =
            $("v3-summary");


        if (
            !container
        ) {

            return;

        }


        const s =
            analysis.statistics;


        container.innerHTML = `

            <div
                style="
                    display:grid;
                    grid-template-columns:
                        repeat(
                            auto-fit,
                            minmax(
                                180px,
                                1fr
                            )
                        );
                    gap:12px;
                "
            >

                ${summaryCard(
                    "管段數",
                    s.pipeCount
                )}

                ${summaryCard(
                    "節點數",
                    s.nodeCount
                )}

                ${summaryCard(
                    "最高 HGL",
                    number(
                        s.maxHGL,
                        3
                    ) + " m"
                )}

                ${summaryCard(
                    "最低管底",
                    number(
                        s.minInvert,
                        3
                    ) + " m"
                )}

                ${summaryCard(
                    "最高 EGL",
                    number(
                        s.maxEGL,
                        3
                    ) + " m"
                )}

                ${summaryCard(
                    "最大回水水頭",
                    number(
                        s.maxBackwater,
                        3
                    ) + " m"
                )}

            </div>


            <div
                style="
                    margin-top:16px;
                    padding:12px;
                    background:#fff3cd;
                    border:1px solid #ffecb5;
                    border-radius:6px;
                "
            >

                ${analysis.note}

            </div>

        `;

    }


    function summaryCard(
        label,
        value
    ) {

        return `

            <div
                style="
                    padding:14px;
                    border:1px solid #dee2e6;
                    border-radius:8px;
                    background:white;
                "
            >

                <div
                    style="
                        color:#6c757d;
                        font-size:13px;
                    "
                >
                    ${label}
                </div>

                <div
                    style="
                        margin-top:5px;
                        font-size:22px;
                        font-weight:700;
                    "
                >
                    ${value}
                </div>

            </div>

        `;

    }


    /* ============================================================
     * Export
     * ============================================================ */

    function exportResultJSON() {

        if (
            !currentHglEgl
        ) {

            throw new Error(
                "尚未建立 HGL/EGL 成果。"
            );

        }


        const output = {

            appVersion:
                APP_VERSION,

            case:
                currentCase,

            hydraulicSolution:
                window.v3HydraulicSolution,

            hglEglSolution:
                currentHglEgl

        };


        const blob =
            new Blob(
                [
                    JSON.stringify(
                        output,
                        null,
                        2
                    )
                ],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const a =
            document.createElement(
                "a"
            );


        a.href =
            url;


        a.download =
            "v3-hgl-egl-result.json";


        document.body.appendChild(
            a
        );


        a.click();


        a.remove();


        URL.revokeObjectURL(
            url
        );

    }


    /* ============================================================
     * Public API
     * ============================================================ */

    window.V3App = {

        version:
            APP_VERSION,

        demoCase:
            DEMO_CASE,

        loadDemoCase,

        loadCase,

        runAnalysis,

        clearResults,

        exportResultJSON,

        getCurrentCase:
            function () {

                return currentCase;

            },

        getCurrentResult:
            function () {

                return currentHglEgl;

            }

    };


    /* ============================================================
     * Auto Init
     * ============================================================ */

    function init() {

        ensureAppDOM();


        /*
         * 如果頁面已經存在 hydraulic solution，
         * 不覆蓋它。
         *
         * 否則自動載入完整示範案例。
         */

        if (
            window.v3HydraulicSolution &&
            Array.isArray(
                window
                    .v3HydraulicSolution
                    .pipeResults
            ) &&
            window
                .v3HydraulicSolution
                .pipeResults
                .length > 0
        ) {

            currentCase = {

                meta: {

                    id:
                        "EXISTING_CASE",

                    name:
                        "目前 V3 水理分析案例"

                },

                nodes:
                    window.nodes || [],

                pipes:
                    window.pipes || [],

                pipeResults:
                    window
                        .v3HydraulicSolution
                        .pipeResults,

                boundaryConditions:
                    window.v3BoundaryConditions ||
                    {}

            };


            updateCaseTitle();


            runAnalysis();

        }
        else {

            /*
             * 預設：
             * 載入完整示範案例。
             */

            loadDemoCase();

        }

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            init
        );

    }
    else {

        init();

    }


})(window, document);
