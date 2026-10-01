/* ================================================================
 * 台灣雨水下水道數值水理分析 V3
 *
 * File:
 *     app_.js
 *
 * Purpose:
 *     V3 前端主程式
 *
 *     負責：
 *       1. 初始化 UI
 *       2. 讀取 / 建立 nodes、pipes
 *       3. 呼叫 hydraulic.js
 *       4. 取得 window.v3HydraulicSolution
 *       5. 呼叫 hgl-egl.js
 *       6. 建立 HGL / EGL / 水面 / 管底縱剖面
 *       7. 顯示計算結果
 *       8. 顯示統計資料
 *       9. 提供匯出 JSON / CSV
 *
 * 注意：
 *
 *     本檔案不重新實作 HGL/EGL 計算。
 *
 *     HGL/EGL 計算由：
 *
 *         js/hgl-egl.js
 *
 *     負責。
 *
 *     本檔案主要負責：
 *
 *         UI
 *         資料流程
 *         hydraulic solver
 *         HGL/EGL post-processing
 *         chart
 *
 * ================================================================ */

(function (window, document) {

    "use strict";


    /* ============================================================
     * Global application state
     * ============================================================ */

    const APP = {

        version:
            "V3.0",

        hydraulicSolution:
            null,

        hglEglSolution:
            null,

        chart:
            null,

        initialized:
            false,

        calculating:
            false,

        settings: {

            autoCalculate:
                false,

            autoDrawChart:
                true,

            exportPrecision:
                6

        }

    };


    /* ============================================================
     * Utility
     * ============================================================ */

    function byId(id) {

        return document.getElementById(id);

    }


    function query(selector) {

        return document.querySelector(
            selector
        );

    }


    function all(selector) {

        return Array.from(
            document.querySelectorAll(
                selector
            )
        );

    }


    function number(
        value,
        fallback = 0
    ) {

        const n =
            Number(value);

        return Number.isFinite(n)
            ? n
            : fallback;

    }


    function formatNumber(
        value,
        digits = 3
    ) {

        if (
            value === null ||
            value === undefined ||
            !Number.isFinite(
                Number(value)
            )
        ) {

            return "-";

        }


        return Number(value)
            .toFixed(digits);

    }


    function formatScientific(
        value
    ) {

        if (
            !Number.isFinite(
                Number(value)
            )
        ) {

            return "-";

        }


        return Number(value)
            .toExponential(4);

    }


    function escapeHtml(
        value
    ) {

        return String(
            value === undefined ||
            value === null
                ? ""
                : value
        )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

    }


    function firstNumber(
        object,
        keys,
        fallback = 0
    ) {

        if (!object) {

            return fallback;

        }


        for (
            const key of keys
        ) {

            if (
                object[key] !== undefined &&
                object[key] !== null &&
                Number.isFinite(
                    Number(
                        object[key]
                    )
                )
            ) {

                return Number(
                    object[key]
                );

            }

        }


        return fallback;

    }


    function firstValue(
        object,
        keys,
        fallback = null
    ) {

        if (!object) {

            return fallback;

        }


        for (
            const key of keys
        ) {

            if (
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {

                return object[key];

            }

        }


        return fallback;

    }


    /* ============================================================
     * Data access
     * ============================================================ */

    function getNodes() {

        if (
            Array.isArray(
                window.nodes
            )
        ) {

            return window.nodes;

        }


        if (
            Array.isArray(
                window.nodeData
            )
        ) {

            return window.nodeData;

        }


        if (
            window.v3HydraulicSolution &&
            Array.isArray(
                window.v3HydraulicSolution.nodes
            )
        ) {

            return (
                window
                    .v3HydraulicSolution
                    .nodes
            );

        }


        return [];

    }


    function getPipes() {

        if (
            Array.isArray(
                window.pipes
            )
        ) {

            return window.pipes;

        }


        if (
            Array.isArray(
                window.pipeData
            )
        ) {

            return window.pipeData;

        }


        if (
            window.v3HydraulicSolution &&
            Array.isArray(
                window.v3HydraulicSolution.pipes
            )
        ) {

            return (
                window
                    .v3HydraulicSolution
                    .pipes
            );

        }


        return [];

    }


    function getHydraulicSolution() {

        return (
            window.v3HydraulicSolution ||
            null
        );

    }


    function getHglEglSolution() {

        return (
            window.v3HglEglSolution ||
            null
        );

    }


    /* ============================================================
     * Status UI
     * ============================================================ */

    function getStatusElement() {

        const candidates = [

            "appStatus",

            "status",

            "calculationStatus",

            "message",

            "resultStatus"

        ];


        for (
            const id of candidates
        ) {

            const element =
                byId(id);

            if (element) {

                return element;

            }

        }


        return null;

    }


    function setStatus(
        message,
        type = "info"
    ) {

        const element =
            getStatusElement();


        if (!element) {

            return;

        }


        element.textContent =
            message;


        element.classList.remove(
            "success",
            "error",
            "warning",
            "info"
        );


        element.classList.add(
            type
        );

    }


    function setBusy(
        busy
    ) {

        APP.calculating =
            Boolean(busy);


        const buttons =
            all(
                "button"
            );


        for (
            const button of buttons
        ) {

            if (
                button.dataset &&
                button.dataset.allowWhileBusy ===
                "true"
            ) {

                continue;

            }


            if (
                button.id ===
                "calculateBtn" ||
                button.id ===
                "runHydraulicBtn"
            ) {

                button.disabled =
                    busy;

            }

        }

    }


    /* ============================================================
     * Locate chart container
     * ============================================================ */

    function getChartTarget() {

        const ids = [

            "hglEglChart",

            "profileChart",

            "hydraulicProfileChart",

            "longitudinalProfile",

            "chartContainer"

        ];


        for (
            const id of ids
        ) {

            const element =
                byId(id);

            if (element) {

                return element;

            }

        }


        return null;

    }


    /* ============================================================
     * Locate result containers
     * ============================================================ */

    function getResultContainer() {

        const ids = [

            "hydraulicResults",

            "results",

            "resultPanel",

            "resultContainer",

            "hglEglResults"

        ];


        for (
            const id of ids
        ) {

            const element =
                byId(id);

            if (element) {

                return element;

            }

        }


        return null;

    }


    /* ============================================================
     * Read UI settings
     * ============================================================ */

    function readHglEglSettings() {

        const settings = {};


        const gravityInput =
            byId(
                "gravity"
            );


        if (
            gravityInput
        ) {

            settings.gravity =
                number(
                    gravityInput.value,
                    9.80665
                );

        }


        const includeVelocityHead =
            byId(
                "includeVelocityHead"
            );


        if (
            includeVelocityHead
        ) {

            settings.includeVelocityHead =
                Boolean(
                    includeVelocityHead.checked
                );

        }


        const propagateBackwater =
            byId(
                "propagateBackwater"
            );


        if (
            propagateBackwater
        ) {

            settings.propagateBackwater =
                Boolean(
                    propagateBackwater.checked
                );

        }


        const defaultKEntrance =
            byId(
                "defaultKEntrance"
            );


        if (
            defaultKEntrance
        ) {

            settings.defaultKEntrance =
                number(
                    defaultKEntrance.value,
                    0
                );

        }


        const defaultKExit =
            byId(
                "defaultKExit"
            );


        if (
            defaultKExit
        ) {

            settings.defaultKExit =
                number(
                    defaultKExit.value,
                    0
                );

        }


        const defaultKMinor =
            byId(
                "defaultKMinor"
            );


        if (
            defaultKMinor
        ) {

            settings.defaultKMinor =
                number(
                    defaultKMinor.value,
                    0
                );

        }


        return settings;

    }


    /* ============================================================
     * Read boundary conditions
     * ============================================================ */

    function collectBoundaryConditions() {

        /*
         * 如果其他模組已經建立：
         *
         * window.v3BoundaryConditions
         *
         * 則直接保留。
         */

        if (
            window.v3BoundaryConditions
        ) {

            return (
                window.v3BoundaryConditions
            );

        }


        if (
            window.boundaryConditions
        ) {

            return (
                window.boundaryConditions
            );

        }


        const bc = {

            nodes: {}

        };


        /*
         * 支援 HTML：
         *
         * data-node-id
         *
         * data-boundary
         */

        const elements =
            all(
                "[data-boundary-node]"
            );


        for (
            const element of elements
        ) {

            const nodeId =
                element.dataset
                    .boundaryNode;


            if (!nodeId) {

                continue;

            }


            bc.nodes[
                nodeId
            ] = {

                HGL:
                    number(
                        element.dataset.hgl,
                        NaN
                    ),

                elevation:
                    number(
                        element.dataset.elevation,
                        NaN
                    ),

                depth:
                    number(
                        element.dataset.depth,
                        NaN
                    )

            };

        }


        /*
         * 若沒有任何 boundary，
         * 不建立空的 global boundary。
         */

        if (
            Object.keys(
                bc.nodes
            ).length === 0
        ) {

            return {};

        }


        return bc;

    }


    /* ============================================================
     * Synchronize global data
     * ============================================================ */

    function synchronizeData() {

        /*
         * 若 app 內部資料存在，
         * 確保 hydraulic solver 可以讀到。
         */

        if (
            !Array.isArray(
                window.nodes
            ) &&
            Array.isArray(
                window.nodeData
            )
        ) {

            window.nodes =
                window.nodeData;

        }


        if (
            !Array.isArray(
                window.pipes
            ) &&
            Array.isArray(
                window.pipeData
            )
        ) {

            window.pipes =
                window.pipeData;

        }


        /*
         * Boundary condition
         */

        const bc =
            collectBoundaryConditions();


        if (
            bc &&
            Object.keys(bc).length
        ) {

            window.v3BoundaryConditions =
                bc;

        }

    }


    /* ============================================================
     * Detect hydraulic solver
     *
     * hydraulic.js 可能使用不同命名。
     * ============================================================ */

    function getHydraulicSolver() {

        const candidates = [

            window.V3Hydraulic,

            window.v3Hydraulic,

            window.Hydraulic,

            window.HydraulicSolver,

            window.V3HydraulicSolver

        ];


        for (
            const solver of candidates
        ) {

            if (!solver) {

                continue;

            }


            if (
                typeof solver.calculate ===
                "function"
            ) {

                return solver;

            }


            if (
                typeof solver.solve ===
                "function"
            ) {

                return solver;

            }


            if (
                typeof solver.run ===
                "function"
            ) {

                return solver;

            }

        }


        return null;

    }


    /* ============================================================
     * Run hydraulic solver
     * ============================================================ */

    async function runHydraulicSolver() {

        synchronizeData();


        /*
         * 如果 hydraulic.js 已經執行，
         * 而 window.v3HydraulicSolution 存在，
         * 優先使用現有結果。
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

            APP.hydraulicSolution =
                window.v3HydraulicSolution;


            return (
                window.v3HydraulicSolution
            );

        }


        const solver =
            getHydraulicSolver();


        if (!solver) {

            throw new Error(
                "找不到 hydraulic.js 的 V3 solver。請確認 hydraulic.js 已載入，並且提供 calculate()、solve() 或 run()。"
            );

        }


        let result;


        /*
         * 優先 calculate
         */

        if (
            typeof solver.calculate ===
            "function"
        ) {

            result =
                solver.calculate();

        }

        else if (
            typeof solver.solve ===
            "function"
        ) {

            result =
                solver.solve();

        }

        else {

            result =
                solver.run();

        }


        /*
         * 支援 async solver。
         */

        if (
            result &&
            typeof result.then ===
            "function"
        ) {

            result =
                await result;

        }


        /*
         * solver 若有回傳結果，
         * 同步到 global。
         */

        if (
            result
        ) {

            window.v3HydraulicSolution =
                result;

        }


        /*
         * 最後確認 global。
         */

        if (
            !window.v3HydraulicSolution
        ) {

            throw new Error(
                "hydraulic solver 執行完成，但沒有建立 window.v3HydraulicSolution。"
            );

        }


        if (
            !Array.isArray(
                window
                    .v3HydraulicSolution
                    .pipeResults
            )
        ) {

            throw new Error(
                "window.v3HydraulicSolution.pipeResults 不存在或不是陣列。"
            );

        }


        APP.hydraulicSolution =
            window.v3HydraulicSolution;


        return (
            window.v3HydraulicSolution
        );

    }


    /* ============================================================
     * Run HGL / EGL
     * ============================================================ */

    function runHglEgl() {

        if (
            !window.V3HglEgl
        ) {

            throw new Error(
                "找不到 window.V3HglEgl。請確認 js/hgl-egl.js 已載入。"
            );

        }


        if (
            typeof window
                .V3HglEgl
                .calculate !==
            "function"
        ) {

            throw new Error(
                "window.V3HglEgl.calculate() 不存在。"
            );

        }


        /*
         * 確保 hydraulic result 已經存在。
         */

        if (
            !window.v3HydraulicSolution
        ) {

            throw new Error(
                "尚未建立 window.v3HydraulicSolution。"
            );

        }


        const pipeResults =
            window
                .v3HydraulicSolution
                .pipeResults;


        if (
            !Array.isArray(
                pipeResults
            ) ||
            pipeResults.length === 0
        ) {

            throw new Error(
                "pipeResults 為空，無法進行 HGL/EGL 分析。"
            );

        }


        /*
         * Boundary
         */

        const bc =
            collectBoundaryConditions();


        if (
            bc &&
            Object.keys(bc).length
        ) {

            window.v3BoundaryConditions =
                bc;

        }


        /*
         * Settings
         */

        const settings =
            readHglEglSettings();


        const result =
            window
                .V3HglEgl
                .calculate(
                    settings
                );


        APP.hglEglSolution =
            result;


        return result;

    }


    /* ============================================================
     * Complete calculation pipeline
     * ============================================================ */

    async function calculateAll() {

        if (
            APP.calculating
        ) {

            return null;

        }


        setBusy(
            true
        );


        setStatus(
            "正在進行水理計算……",
            "info"
        );


        try {

            synchronizeData();


            /*
             * Step 1
             *
             * hydraulic solver
             */

            const hydraulic =
                await runHydraulicSolver();


            APP.hydraulicSolution =
                hydraulic;


            setStatus(
                "水理主計算完成，正在建立 HGL / EGL……",
                "info"
            );


            /*
             * Step 2
             *
             * HGL / EGL
             */

            const hglEgl =
                runHglEgl();


            APP.hglEglSolution =
                hglEgl;


            /*
             * Step 3
             *
             * Update UI
             */

            renderAllResults(
                hydraulic,
                hglEgl
            );


            /*
             * Step 4
             *
             * Chart
             */

            if (
                APP.settings
                    .autoDrawChart
            ) {

                drawHglEglChart();

            }


            setStatus(
                "V3 水理計算與 HGL / EGL 分析完成。",
                "success"
            );


            return {

                hydraulic,

                hglEgl

            };

        }

        catch (
            error
        ) {

            console.error(
                "[V3] calculation error:",
                error
            );


            setStatus(
                error &&
                error.message
                    ? error.message
                    : String(error),
                "error"
            );


            showError(
                error
            );


            throw error;

        }

        finally {

            setBusy(
                false
            );

        }

    }


    /* ============================================================
     * Render statistics
     * ============================================================ */

    function renderStatistics(
        result
    ) {

        if (!result) {

            return;

        }


        const stats =
            result.statistics ||
            {};


        const values = {

            pipeCount:
                stats.pipeCount,

            nodeCount:
                stats.nodeCount,

            maxHGL:
                stats.maxHGL,

            minInvert:
                stats.minInvert,

            maxEGL:
                stats.maxEGL,

            maxBackwater:
                stats.maxBackwater

        };


        const mapping = {

            pipeCount:
                [
                    "pipeCount",
                    "statPipeCount"
                ],

            nodeCount:
                [
                    "nodeCount",
                    "statNodeCount"
                ],

            maxHGL:
                [
                    "maxHGL",
                    "statMaxHGL"
                ],

            minInvert:
                [
                    "minInvert",
                    "statMinInvert"
                ],

            maxEGL:
                [
                    "maxEGL",
                    "statMaxEGL"
                ],

            maxBackwater:
                [
                    "maxBackwater",
                    "statMaxBackwater"
                ]

        };


        Object.keys(
            mapping
        ).forEach(
            key => {

                const value =
                    values[key];


                for (
                    const id of
                    mapping[key]
                ) {

                    const element =
                        byId(id);


                    if (!element) {

                        continue;

                    }


                    if (
                        key ===
                        "pipeCount" ||
                        key ===
                        "nodeCount"
                    ) {

                        element.textContent =
                            Number.isFinite(
                                Number(value)
                            )
                                ? String(
                                    value
                                )
                                : "-";

                    }

                    else {

                        element.textContent =
                            formatNumber(
                                value,
                                3
                            );

                    }

                }

            }
        );

    }


    /* ============================================================
     * Render hydraulic result summary
     * ============================================================ */

    function renderHydraulicSummary(
        hydraulic
    ) {

        const container =
            byId(
                "hydraulicSummary"
            );


        if (!container) {

            return;

        }


        if (!hydraulic) {

            container.innerHTML =
                "<div>尚無水理計算成果。</div>";

            return;

        }


        const pipeResults =
            Array.isArray(
                hydraulic.pipeResults
            )
                ? hydraulic.pipeResults
                : [];


        const nodeResults =
            Array.isArray(
                hydraulic.nodes
            )
                ? hydraulic.nodes
                : [];


        const rows =
            pipeResults
                .slice(
                    0,
                    20
                )
                .map(
                    (p, index) => {

                        const id =
                            firstValue(
                                p,
                                [
                                    "pipeId",
                                    "id",
                                    "name",
                                    "code"
                                ],
                                `PIPE_${index + 1}`
                            );


                        const Q =
                            firstNumber(
                                p,
                                [
                                    "Q",
                                    "flow",
                                    "flowRate",
                                    "discharge"
                                ],
                                0
                            );


                        const depth =
                            firstNumber(
                                p,
                                [
                                    "depth",
                                    "normalDepth",
                                    "waterDepth",
                                    "y"
                                ],
                                0
                            );


                        const velocity =
                            firstNumber(
                                p,
                                [
                                    "velocity",
                                    "V",
                                    "flowVelocity"
                                ],
                                0
                            );


                        return `

                            <tr>

                                <td>
                                    ${escapeHtml(id)}
                                </td>

                                <td>
                                    ${formatNumber(Q, 4)}
                                </td>

                                <td>
                                    ${formatNumber(depth, 3)}
                                </td>

                                <td>
                                    ${formatNumber(velocity, 3)}
                                </td>

                            </tr>

                        `;

                    }
                )
                .join("");


        container.innerHTML = `

            <div class="v3-summary">

                <div>
                    管段數：
                    <strong>
                        ${pipeResults.length}
                    </strong>
                </div>

                <div>
                    節點數：
                    <strong>
                        ${nodeResults.length}
                    </strong>
                </div>

            </div>

            <div style="overflow:auto;">

                <table class="table table-sm">

                    <thead>

                        <tr>

                            <th>
                                Pipe
                            </th>

                            <th>
                                Q (m³/s)
                            </th>

                            <th>
                                Depth (m)
                            </th>

                            <th>
                                V (m/s)
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rows}

                    </tbody>

                </table>

            </div>

        `;

    }


    /* ============================================================
     * Render HGL/EGL table
     * ============================================================ */

    function renderHglEglTable(
        result
    ) {

        const container =
            getResultContainer();


        if (!container) {

            return;

        }


        const records =
            result &&
            Array.isArray(
                result.records
            )
                ? result.records
                : [];


        if (
            records.length === 0
        ) {

            container.innerHTML =
                "<div>沒有 HGL/EGL 結果。</div>";

            return;

        }


        const rows =
            records
                .map(
                    p => `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    p.id
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    p.from || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    p.to || "-"
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.length,
                                    2
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.Q,
                                    4
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.depth,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.velocity,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.upstreamInvert,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.downstreamInvert,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.upstreamHGL,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.downstreamHGL,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.upstreamEGL,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.downstreamEGL,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.frictionLoss,
                                    4
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.localLoss,
                                    4
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.totalLoss,
                                    4
                                )}
                            </td>

                        </tr>

                    `
                )
                .join("");


        container.innerHTML = `

            <div class="v3-result-header">

                <h3>
                    HGL / EGL 管段分析
                </h3>

                <div>

                    管段數：
                    <strong>
                        ${records.length}
                    </strong>

                </div>

            </div>


            <div style="overflow:auto;">

                <table
                    class="table table-bordered table-sm"
                    style="min-width:1700px;"
                >

                    <thead>

                        <tr>

                            <th>
                                Pipe
                            </th>

                            <th>
                                Upstream
                            </th>

                            <th>
                                Downstream
                            </th>

                            <th>
                                L (m)
                            </th>

                            <th>
                                Q (m³/s)
                            </th>

                            <th>
                                Depth (m)
                            </th>

                            <th>
                                V (m/s)
                            </th>

                            <th>
                                Up Inv (m)
                            </th>

                            <th>
                                Down Inv (m)
                            </th>

                            <th>
                                Up HGL (m)
                            </th>

                            <th>
                                Down HGL (m)
                            </th>

                            <th>
                                Up EGL (m)
                            </th>

                            <th>
                                Down EGL (m)
                            </th>

                            <th>
                                Manning hf (m)
                            </th>

                            <th>
                                Local hm (m)
                            </th>

                            <th>
                                Total Loss (m)
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rows}

                    </tbody>

                </table>

            </div>

        `;

    }


    /* ============================================================
     * Render profile table
     * ============================================================ */

    function renderProfileTable(
        result
    ) {

        const container =
            byId(
                "profileTable"
            );


        if (!container) {

            return;

        }


        const profile =
            result &&
            Array.isArray(
                result.profile
            )
                ? result.profile
                : [];


        const rows =
            profile
                .map(
                    p => `

                        <tr>

                            <td>
                                ${formatNumber(
                                    p.station,
                                    2
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    p.path || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    p.pipeId || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    p.nodeId || "-"
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    p.type || "-"
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.invert,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.waterSurface,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.HGL,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.EGL,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.depth,
                                    3
                                )}
                            </td>

                            <td>
                                ${formatNumber(
                                    p.velocity,
                                    3
                                )}
                            </td>

                        </tr>

                    `
                )
                .join("");


        container.innerHTML = `

            <div style="overflow:auto;">

                <table
                    class="table table-striped table-sm"
                    style="min-width:1200px;"
                >

                    <thead>

                        <tr>

                            <th>
                                Station (m)
                            </th>

                            <th>
                                Path
                            </th>

                            <th>
                                Pipe
                            </th>

                            <th>
                                Node
                            </th>

                            <th>
                                Type
                            </th>

                            <th>
                                Invert (m)
                            </th>

                            <th>
                                Water Surface (m)
                            </th>

                            <th>
                                HGL (m)
                            </th>

                            <th>
                                EGL (m)
                            </th>

                            <th>
                                Depth (m)
                            </th>

                            <th>
                                Velocity (m/s)
                            </th>

                        </tr>

                    </thead>

                    <tbody>

                        ${rows}

                    </tbody>

                </table>

            </div>

        `;

    }


    /* ============================================================
     * Render all
     * ============================================================ */

    function renderAllResults(
        hydraulic,
        hglEgl
    ) {

        renderStatistics(
            hglEgl
        );


        renderHydraulicSummary(
            hydraulic
        );


        renderHglEglTable(
            hglEgl
        );


        renderProfileTable(
            hglEgl
        );


        /*
         * 若頁面提供專用 statistic elements，
         * 同步更新。
         */

        updateElement(
            "resultModel",
            hglEgl.model
        );


        updateElement(
            "resultNote",
            hglEgl.note
        );

    }


    function updateElement(
        id,
        value
    ) {

        const element =
            byId(id);


        if (!element) {

            return;

        }


        element.textContent =
            value === undefined ||
            value === null
                ? ""
                : String(value);

    }


    /* ============================================================
     * Chart
     * ============================================================ */

    function drawHglEglChart() {

        const result =
            APP.hglEglSolution ||
            window.v3HglEglSolution;


        if (!result) {

            throw new Error(
                "尚未建立 HGL/EGL 分析成果。"
            );

        }


        const target =
            getChartTarget();


        if (!target) {

            /*
             * 頁面沒有 Chart container，
             * 不視為計算錯誤。
             */

            console.warn(
                "[V3] 找不到 HGL/EGL chart container。"
            );


            return null;

        }


        if (
            !window.V3HglEgl ||
            typeof window
                .V3HglEgl
                .drawProfile !==
            "function"
        ) {

            throw new Error(
                "window.V3HglEgl.drawProfile() 不存在。"
            );

        }


        APP.chart =
            window
                .V3HglEgl
                .drawProfile(
                    result,
                    target
                );


        return APP.chart;

    }


    /* ============================================================
     * Export JSON
     * ============================================================ */

    function createDownload(
        content,
        filename,
        mimeType
    ) {

        const blob =
            new Blob(
                [
                    content
                ],
                {
                    type:
                        mimeType
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
            filename;


        document.body.appendChild(
            a
        );


        a.click();


        document.body.removeChild(
            a
        );


        setTimeout(
            function () {

                URL.revokeObjectURL(
                    url
                );

            },
            1000
        );

    }


    function exportJson() {

        const hydraulic =
            window.v3HydraulicSolution;


        const hglEgl =
            window.v3HglEglSolution;


        if (
            !hydraulic &&
            !hglEgl
        ) {

            throw new Error(
                "目前沒有可匯出的計算成果。"
            );

        }


        const data = {

            application: {

                name:
                    "台灣雨水下水道數值水理分析 V3",

                version:
                    APP.version,

                exportedAt:
                    new Date()
                        .toISOString()

            },

            hydraulicSolution:
                hydraulic,

            hglEglSolution:
                hglEgl

        };


        createDownload(

            JSON.stringify(
                data,
                null,
                2
            ),

            "v3-hydraulic-hgl-egl.json",

            "application/json;charset=utf-8"

        );

    }


    /* ============================================================
     * CSV helper
     * ============================================================ */

    function csvEscape(
        value
    ) {

        const text =
            value === null ||
            value === undefined
                ? ""
                : String(value);


        if (
            /[",\r\n]/.test(
                text
            )
        ) {

            return (
                '"' +
                text.replace(
                    /"/g,
                    '""'
                ) +
                '"'
            );

        }


        return text;

    }


    function recordsToCsv(
        records
    ) {

        const header = [

            "Pipe",

            "From",

            "To",

            "Length_m",

            "Diameter_m",

            "Manning_n",

            "Slope",

            "Q_m3s",

            "Depth_m",

            "Area_m2",

            "HydraulicRadius_m",

            "Velocity_ms",

            "VelocityHead_m",

            "Froude",

            "UpstreamInvert_m",

            "DownstreamInvert_m",

            "UpstreamHGL_m",

            "DownstreamHGL_m",

            "UpstreamEGL_m",

            "DownstreamEGL_m",

            "UpstreamWaterSurface_m",

            "DownstreamWaterSurface_m",

            "FrictionLoss_m",

            "LocalLoss_m",

            "TotalLoss_m",

            "UpstreamBackwater_m",

            "DownstreamBackwater_m"

        ];


        const rows = [

            header

        ];


        for (
            const p of records
        ) {

            rows.push([

                p.id,

                p.from,

                p.to,

                p.length,

                p.diameter,

                p.n,

                p.slope,

                p.Q,

                p.depth,

                p.area,

                p.hydraulicRadius,

                p.velocity,

                p.velocityHead,

                p.froude,

                p.upstreamInvert,

                p.downstreamInvert,

                p.upstreamHGL,

                p.downstreamHGL,

                p.upstreamEGL,

                p.downstreamEGL,

                p.upstreamWaterSurface,

                p.downstreamWaterSurface,

                p.frictionLoss,

                p.localLoss,

                p.totalLoss,

                p.upstreamBackwater,

                p.downstreamBackwater

            ]);

        }


        return rows
            .map(
                row =>
                    row
                        .map(
                            csvEscape
                        )
                        .join(",")
            )
            .join("\r\n");

    }


    function exportCsv() {

        const result =
            window.v3HglEglSolution;


        if (!result) {

            throw new Error(
                "目前沒有 HGL/EGL 成果可匯出。"
            );

        }


        const records =
            Array.isArray(
                result.records
            )
                ? result.records
                : [];


        const csv =
            recordsToCsv(
                records
            );


        /*
         * UTF-8 BOM
         * 確保 Excel 正確辨識中文。
         */

        createDownload(

            "\uFEFF" +
            csv,

            "v3-hgl-egl-results.csv",

            "text/csv;charset=utf-8"

        );

    }


    /* ============================================================
     * Export profile CSV
     * ============================================================ */

    function exportProfileCsv() {

        const result =
            window.v3HglEglSolution;


        if (!result) {

            throw new Error(
                "目前沒有縱剖面成果。"
            );

        }


        const profile =
            Array.isArray(
                result.profile
            )
                ? result.profile
                : [];


        const header = [

            "Station_m",

            "Path",

            "Pipe",

            "Node",

            "Type",

            "Invert_m",

            "WaterSurface_m",

            "HGL_m",

            "EGL_m",

            "Depth_m",

            "Velocity_ms",

            "Q_m3s"

        ];


        const rows = [

            header

        ];


        for (
            const p of profile
        ) {

            rows.push([

                p.station,

                p.path,

                p.pipeId,

                p.nodeId,

                p.type,

                p.invert,

                p.waterSurface,

                p.HGL,

                p.EGL,

                p.depth,

                p.velocity,

                p.Q

            ]);

        }


        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                csvEscape
                            )
                            .join(",")
                )
                .join("\r\n");


        createDownload(

            "\uFEFF" +
            csv,

            "v3-hgl-egl-profile.csv",

            "text/csv;charset=utf-8"

        );

    }


    /* ============================================================
     * Print
     * ============================================================ */

    function printResults() {

        window.print();

    }


    /* ============================================================
     * Clear results
     * ============================================================ */

    function clearResults() {

        APP.hydraulicSolution =
            null;


        APP.hglEglSolution =
            null;


        APP.chart =
            null;


        if (
            window.v3HglEglSolution
        ) {

            window.v3HglEglSolution =
                null;

        }


        const containers = [

            "hydraulicSummary",

            "hglEglResults",

            "results",

            "resultPanel",

            "resultContainer",

            "profileTable"

        ];


        for (
            const id of containers
        ) {

            const element =
                byId(id);


            if (
                element
            ) {

                element.innerHTML =
                    "";

            }

        }


        setStatus(
            "已清除計算成果。",
            "info"
        );

    }


    /* ============================================================
     * Button binding
     * ============================================================ */

    function bindButton(
        ids,
        handler
    ) {

        for (
            const id of ids
        ) {

            const button =
                byId(id);


            if (!button) {

                continue;

            }


            button.addEventListener(
                "click",
                function (event) {

                    event.preventDefault();


                    Promise.resolve()
                        .then(
                            handler
                        )
                        .catch(
                            error => {

                                console.error(
                                    error
                                );

                            }
                        );

                }
            );


            return true;

        }


        return false;

    }


    function bindEvents() {

        /*
         * Calculate
         */

        bindButton(

            [
                "calculateBtn",
                "runHydraulicBtn",
                "runCalculationBtn",
                "solveBtn"
            ],

            calculateAll

        );


        /*
         * HGL/EGL chart
         */

        bindButton(

            [
                "drawHglEglBtn",
                "drawProfileBtn",
                "showChartBtn"
            ],

            drawHglEglChart

        );


        /*
         * JSON
         */

        bindButton(

            [
                "exportJsonBtn",
                "downloadJsonBtn"
            ],

            exportJson

        );


        /*
         * CSV

         */

        bindButton(

            [
                "exportCsvBtn",
                "downloadCsvBtn"
            ],

            exportCsv

        );


        /*
         * Profile CSV
         */

        bindButton(

            [
                "exportProfileCsvBtn",
                "downloadProfileCsvBtn"
            ],

            exportProfileCsv

        );


        /*
         * Print
         */

        bindButton(

            [
                "printResultsBtn",
                "printBtn"
            ],

            printResults

        );


        /*
         * Clear
         */

        bindButton(

            [
                "clearResultsBtn",
                "clearBtn"
            ],

            clearResults

        );

    }


    /* ============================================================
     * Auto initialization
     * ============================================================ */

    function init() {

        if (
            APP.initialized
        ) {

            return APP;

        }


        APP.initialized =
            true;


        bindEvents();


        /*
         * 若已有 hydraulic solution，
         * 自動建立 HGL/EGL。
         *
         * 不強制重新跑 hydraulic solver。
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

            try {

                const hglEgl =
                    runHglEgl();


                renderAllResults(
                    window.v3HydraulicSolution,
                    hglEgl
                );


                if (
                    APP.settings
                        .autoDrawChart
                ) {

                    drawHglEglChart();

                }


                setStatus(
                    "已載入既有 V3 水理成果。",
                    "success"
                );

            }

            catch (
                error
            ) {

                console.warn(
                    "[V3] initial HGL/EGL failed:",
                    error
                );

            }

        }


        return APP;

    }


    /* ============================================================
     * Public API
     * ============================================================ */

    window.V3App = {

        version:
            APP.version,

        state:
            APP,

        init,

        calculate:
            calculateAll,

        runHydraulicSolver,

        runHglEgl,

        drawHglEglChart,

        renderAllResults,

        renderStatistics,

        renderHglEglTable,

        renderProfileTable,

        exportJson,

        exportCsv,

        exportProfileCsv,

        printResults,

        clearResults,

        getNodes,

        getPipes,

        getHydraulicSolution,

        getHglEglSolution

    };


    /*
     * 相容舊程式命名
     */

    window.App =
        window.V3App;


    /* ============================================================
     * DOM Ready
     * ============================================================ */

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
