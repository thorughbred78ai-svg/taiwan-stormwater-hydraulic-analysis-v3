/* ================================================================
 * 台灣雨水下水道數值水理分析 V3
 *
 * File:
 *     js/checking.js
 *
 * Purpose:
 *     工程檢核模組
 *
 * 主要資料來源：
 *     window.v3HglEglSolution
 *
 * 功能：
 *     1. 工程檢核參數 UI
 *     2. 流速 0.8 ~ 3.0 m/s 可調
 *     3. 管徑 800 mm 檢核
 *     4. 節點連續誤差
 *     5. 滿管 / Surcharge
 *     6. HGL 超過地面高程
 *     7. HGL 超過外水位 / 邊界水位
 *     8. 逐管段 PASS / WARN / FAIL
 *     9. 節點檢核
 *    10. 全系統檢核摘要
 *
 * 注意：
 *     本模組只做「工程檢核」，
 *     不修改 hydraulic.js 水理計算結果。
 *
 * ================================================================ */

(function (window) {

    "use strict";


    /* ============================================================
     * 1. DEFAULT CONFIG
     *
     * 規範相關值集中在這裡，
     * 不寫入 hydraulic.js。
     * ============================================================ */

    const DEFAULT_CONFIG = {

        velocity: {

            enabled:
                true,

            min:
                0.8,

            max:
                3.0,

            /*
             * 超出上下限後：
             *
             * FAIL
             */

            severity:
                "FAIL",

            label:
                "計畫下水量流速"

        },


        pipeDiameter: {

            enabled:
                true,

            min:
                0.8,

            /*
             * m
             */

            severity:
                "WARN",

            label:
                "雨水管渠最小管徑"

        },


        nodeContinuity: {

            enabled:
                true,

            /*
             * m3/s
             */

            absoluteTolerance:
                0.001,

            /*
             * 相對誤差 %
             */

            relativeTolerance:
                1.0,

            severity:
                "FAIL",

            label:
                "節點連續誤差"

        },


        fullFlow: {

            enabled:
                true,

            /*
             * y/D
             *
             * >= 0.95
             * 視為接近滿管
             */

            warningRatio:
                0.95,

            /*
             * >= 1.0
             * 視為滿管 / surcharge
             */

            fullRatio:
                1.0,

            severity:
                "WARN",

            label:
                "滿管狀態"

        },


        surcharge: {

            enabled:
                true,

            /*
             * HGL >= crown
             *
             * 即視為壓力化 / surcharge。
             */

            severity:
                "FAIL",

            label:
                "Surcharge / 壓力流"

        },


        groundHGL: {

            enabled:
                true,

            /*
             * HGL > ground elevation
             *
             * 可設定允許超高。
             */

            allowableFreeboard:
                0.0,

            severity:
                "FAIL",

            label:
                "HGL 超過地面高程"

        },


        externalWater: {

            enabled:
                true,

            /*
             * HGL > external water level
             *
             * 主要用於：
             *   河川
             *   海水
             *   抽水站
             *   出口水位
             *   邊界水位
             */

            allowableHead:
                0.0,

            severity:
                "WARN",

            label:
                "HGL 超過外水位"

        },


        hglSlope: {

            enabled:
                false,

            severity:
                "WARN",

            label:
                "HGL 坡度"

        },


        missingData: {

            enabled:
                true,

            severity:
                "WARN",

            label:
                "資料完整性"

        }

    };


    /* ============================================================
     * 2. CONFIG STATE
     * ============================================================ */

    let config =
        deepClone(
            DEFAULT_CONFIG
        );


    let lastResult =
        null;


    let resultContainerId =
        "checkingResults";


    let configContainerId =
        "checkingConfig";


    /* ============================================================
     * 3. Utility
     * ============================================================ */

    function deepClone(
        object
    ) {

        return JSON.parse(
            JSON.stringify(
                object
            )
        );

    }


    function num(
        value,
        fallback = 0
    ) {

        const x =
            Number(value);


        return Number.isFinite(x)
            ? x
            : fallback;

    }


    function finite(
        value
    ) {

        return Number.isFinite(
            Number(value)
        );

    }


    function abs(
        value
    ) {

        return Math.abs(
            num(value)
        );

    }


    function max(
        ...values
    ) {

        return Math.max(
            ...values.filter(
                finite
            )
        );

    }


    function min(
        ...values
    ) {

        return Math.min(
            ...values.filter(
                finite
            )
        );

    }


    function fmt(
        value,
        digits = 3
    ) {

        if (
            !finite(value)
        ) {

            return "-";

        }


        return Number(
            value
        ).toFixed(
            digits
        );

    }


    function escapeHTML(
        value
    ) {

        return String(
            value ?? ""
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


    function getElement(
        id
    ) {

        return document.getElementById(
            id
        );

    }


    /* ============================================================
     * 4. Config getter / setter
     * ============================================================ */

    function getConfig() {

        return deepClone(
            config
        );

    }


    function setConfig(
        newConfig
    ) {

        if (
            !newConfig ||
            typeof newConfig !==
            "object"
        ) {

            return getConfig();

        }


        config =
            mergeConfig(
                config,
                newConfig
            );


        window.V3CheckingConfig =
            getConfig();


        return getConfig();

    }


    function mergeConfig(
        base,
        override
    ) {

        const output =
            deepClone(
                base
            );


        Object.keys(
            override
        ).forEach(
            key => {

                if (
                    override[key] &&
                    typeof override[key] ===
                    "object" &&
                    !Array.isArray(
                        override[key]
                    )
                ) {

                    output[key] =
                        mergeConfig(
                            output[key] || {},
                            override[key]
                        );

                } else {

                    output[key] =
                        override[key];

                }

            }
        );


        return output;

    }


    window.V3CheckingConfig =
        getConfig();


    /* ============================================================
     * 5. Status helpers
     * ============================================================ */

    const STATUS_RANK = {

        PASS:
            0,

        WARN:
            1,

        FAIL:
            2

    };


    function worstStatus(
        ...statuses
    ) {

        let result =
            "PASS";


        for (
            const status of statuses
        ) {

            if (
                STATUS_RANK[
                    status
                ] >
                STATUS_RANK[
                    result
                ]
            ) {

                result =
                    status;

            }

        }


        return result;

    }


    function statusClass(
        status
    ) {

        switch (
            status
        ) {

            case "PASS":
                return "v3-check-pass";

            case "WARN":
                return "v3-check-warn";

            case "FAIL":
                return "v3-check-fail";

            default:
                return "v3-check-na";

        }

    }


    function statusText(
        status
    ) {

        switch (
            status
        ) {

            case "PASS":
                return "PASS";

            case "WARN":
                return "WARN";

            case "FAIL":
                return "FAIL";

            default:
                return "N/A";

        }

    }


    /* ============================================================
     * 6. Obtain hydraulic solution
     * ============================================================ */

    function getHydraulicSolution() {

        const solution =
            window.v3HglEglSolution;


        if (
            !solution
        ) {

            throw new Error(
                "找不到 window.v3HglEglSolution，請先執行 hydraulic.js 與 hgl-egl.js。"
            );

        }


        if (
            !Array.isArray(
                solution.pipeResults
            ) &&
            !Array.isArray(
                solution.records
            )
        ) {

            throw new Error(
                "v3HglEglSolution 沒有 pipeResults / records。"
            );

        }


        return solution;

    }


    function getPipeResults(
        solution
    ) {

        if (
            Array.isArray(
                solution.records
            )
        ) {

            return solution.records;

        }


        return solution.pipeResults || [];

    }


    /* ============================================================
     * 7. Node data
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

            return window
                .v3HydraulicSolution
                .nodes;

        }


        return [];

    }


    function nodeId(
        node
    ) {

        if (
            !node
        ) {

            return null;

        }


        const value =
            node.id ??
            node.nodeId ??
            node.name ??
            node.code;


        return value === undefined
            ? null
            : String(value);

    }


    function nodeElevation(
        node
    ) {

        if (
            !node
        ) {

            return NaN;

        }


        const values = [

            node.groundElevation,

            node.groundElev,

            node.surfaceElevation,

            node.ground,

            node.elevation,

            node.z

        ];


        for (
            const value of values
        ) {

            if (
                finite(value)
            ) {

                return Number(
                    value
                );

            }

        }


        return NaN;

    }


    function nodeExternalWaterLevel(
        node
    ) {

        if (
            !node
        ) {

            return NaN;

        }


        const values = [

            node.externalWaterLevel,

            node.externalWater,

            node.tailwater,

            node.tailwaterElevation,

            node.boundaryWaterLevel,

            node.outfallWaterLevel,

            node.waterLevel

        ];


        for (
            const value of values
        ) {

            if (
                finite(value)
            ) {

                return Number(
                    value
                );

            }

        }


        return NaN;

    }


    function buildNodeMap() {

        const map =
            new Map();


        for (
            const node of
            getNodes()
        ) {

            const id =
                nodeId(
                    node
                );


            if (
                id !== null
            ) {

                map.set(
                    id,
                    node
                );

            }

        }


        return map;

    }


    /* ============================================================
     * 8. Boundary / external water data
     * ============================================================ */

    function getBoundaryConditions() {

        return (
            window.v3BoundaryConditions ||
            window.boundaryConditions ||
            {}
        );

    }


    function getExternalWaterLevel(
        nodeIdValue,
        nodeMap
    ) {

        const node =
            nodeMap.get(
                nodeIdValue
            );


        const nodeLevel =
            nodeExternalWaterLevel(
                node
            );


        if (
            finite(nodeLevel)
        ) {

            return nodeLevel;

        }


        const bc =
            getBoundaryConditions();


        if (
            bc.nodes &&
            bc.nodes[nodeIdValue]
        ) {

            const data =
                bc.nodes[
                    nodeIdValue
                ];


            const values = [

                data.externalWaterLevel,

                data.waterLevel,

                data.tailwater,

                data.waterElevation,

                data.HGL,

                data.hgl

            ];


            for (
                const value of
                values
            ) {

                if (
                    finite(value)
                ) {

                    return Number(
                        value
                    );

                }

            }

        }


        const globals = [

            bc.downstreamHGL,

            bc.outletHGL,

            bc.downstreamWaterLevel,

            bc.outletWaterLevel,

            bc.tailwater

        ];


        for (
            const value of
            globals
        ) {

            if (
                finite(value)
            ) {

                return Number(
                    value
                );

            }

        }


        return NaN;

    }


    /* ============================================================
     * 9. Pipe geometry helpers
     * ============================================================ */

    function pipeDiameter(
        pipe
    ) {

        return num(
            pipe.diameter ??
            pipe.D ??
            pipe.pipeDiameter,
            NaN
        );

    }


    function pipeDepth(
        pipe
    ) {

        return num(
            pipe.depth ??
            pipe.waterDepth ??
            pipe.normalDepth ??
            pipe.y,
            NaN
        );

    }


    function pipeVelocity(
        pipe
    ) {

        return num(
            pipe.velocity ??
            pipe.V ??
            pipe.flowVelocity,
            NaN
        );

    }


    function pipeFlow(
        pipe
    ) {

        return num(
            pipe.Q ??
            pipe.flow ??
            pipe.flowRate ??
            pipe.discharge,
            NaN
        );

    }


    function pipeLength(
        pipe
    ) {

        return num(
            pipe.length ??
            pipe.L ??
            pipe.pipeLength,
            NaN
        );

    }


    function pipeUpstream(
        pipe
    ) {

        return (
            pipe.from ??
            pipe.fromNode ??
            pipe.upstream ??
            pipe.upstreamNode ??
            pipe.startNode ??
            null
        );

    }


    function pipeDownstream(
        pipe
    ) {

        return (
            pipe.to ??
            pipe.toNode ??
            pipe.downstream ??
            pipe.downstreamNode ??
            pipe.endNode ??
            null
        );

    }


    function pipeUpInvert(
        pipe
    ) {

        return num(
            pipe.upstreamInvert,
            NaN
        );

    }


    function pipeDownInvert(
        pipe
    ) {

        return num(
            pipe.downstreamInvert,
            NaN
        );

    }


    function pipeHGLUp(
        pipe
    ) {

        return num(
            pipe.upstreamHGL,
            NaN
        );

    }


    function pipeHGLDown(
        pipe
    ) {

        return num(
            pipe.downstreamHGL,
            NaN
        );

    }


    function pipeEGLUp(
        pipe
    ) {

        return num(
            pipe.upstreamEGL,
            NaN
        );

    }


    function pipeEGLDown(
        pipe
    ) {

        return num(
            pipe.downstreamEGL,
            NaN
        );

    }


    /* ============================================================
     * 10. Check velocity
     * ============================================================ */

    function checkVelocity(
        pipe
    ) {

        const rule =
            config.velocity;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                value:
                    pipeVelocity(pipe),

                message:
                    "流速檢核未啟用"

            };

        }


        const velocity =
            pipeVelocity(
                pipe
            );


        if (
            !finite(velocity)
        ) {

            return {

                status:
                    config.missingData.severity,

                value:
                    NaN,

                message:
                    "缺少流速資料"

            };

        }


        if (
            velocity <
            rule.min
        ) {

            return {

                status:
                    rule.severity,

                value:
                    velocity,

                message:
                    `流速 ${fmt(velocity)} m/s < 最小值 ${fmt(rule.min)} m/s`

            };

        }


        if (
            velocity >
            rule.max
        ) {

            return {

                status:
                    rule.severity,

                value:
                    velocity,

                message:
                    `流速 ${fmt(velocity)} m/s > 最大值 ${fmt(rule.max)} m/s`

            };

        }


        return {

            status:
                "PASS",

            value:
                velocity,

            message:
                `流速 ${fmt(velocity)} m/s，位於 ${fmt(rule.min)} ~ ${fmt(rule.max)} m/s`

        };

    }


    /* ============================================================
     * 11. Check diameter
     * ============================================================ */

    function checkDiameter(
        pipe
    ) {

        const rule =
            config.pipeDiameter;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                value:
                    pipeDiameter(pipe),

                message:
                    "最小管徑檢核未啟用"

            };

        }


        const D =
            pipeDiameter(
                pipe
            );


        if (
            !finite(D)
        ) {

            return {

                status:
                    config.missingData.severity,

                value:
                    NaN,

                message:
                    "缺少管徑資料"

            };

        }


        if (
            D <
            rule.min
        ) {

            return {

                status:
                    rule.severity,

                value:
                    D,

                message:
                    `管徑 ${fmt(D * 1000, 0)} mm < 最小值 ${fmt(rule.min * 1000, 0)} mm`

            };

        }


        return {

            status:
                "PASS",

            value:
                D,

            message:
                `管徑 ${fmt(D * 1000, 0)} mm ≥ ${fmt(rule.min * 1000, 0)} mm`

        };

    }


    /* ============================================================
     * 12. Check full flow / depth ratio
     * ============================================================ */

    function checkFullFlow(
        pipe
    ) {

        const rule =
            config.fullFlow;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                ratio:
                    NaN,

                message:
                    "滿管檢核未啟用"

            };

        }


        const D =
            pipeDiameter(
                pipe
            );


        const y =
            pipeDepth(
                pipe
            );


        if (
            !finite(D) ||
            D <= 0 ||
            !finite(y)
        ) {

            return {

                status:
                    config.missingData.severity,

                ratio:
                    NaN,

                message:
                    "缺少管徑或水深資料"

            };

        }


        const ratio =
            y / D;


        if (
            ratio >=
            rule.fullRatio
        ) {

            return {

                status:
                    config.surcharge.enabled
                        ? config.surcharge.severity
                        : rule.severity,

                ratio,

                message:
                    `y/D = ${fmt(ratio)}，已達滿管`

            };

        }


        if (
            ratio >=
            rule.warningRatio
        ) {

            return {

                status:
                    rule.severity,

                ratio,

                message:
                    `y/D = ${fmt(ratio)}，接近滿管`

            };

        }


        return {

            status:
                "PASS",

            ratio,

            message:
                `y/D = ${fmt(ratio)}`

        };

    }


    /* ============================================================
     * 13. Check Surcharge
     *
     * HGL >= pipe crown
     *
     * crown = invert + D
     * ============================================================ */

    function checkSurcharge(
        pipe
    ) {

        const rule =
            config.surcharge;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                message:
                    "Surcharge 檢核未啟用"

            };

        }


        const D =
            pipeDiameter(
                pipe
            );


        const upInvert =
            pipeUpInvert(
                pipe
            );


        const downInvert =
            pipeDownInvert(
                pipe
            );


        const upHGL =
            pipeHGLUp(
                pipe
            );


        const downHGL =
            pipeHGLDown(
                pipe
            );


        const results = [];


        if (
            finite(D) &&
            finite(upInvert) &&
            finite(upHGL)
        ) {

            results.push({

                location:
                    "upstream",

                head:
                    upHGL,

                crown:
                    upInvert + D,

                excess:
                    upHGL -
                    (
                        upInvert + D
                    )

            });

        }


        if (
            finite(D) &&
            finite(downInvert) &&
            finite(downHGL)
        ) {

            results.push({

                location:
                    "downstream",

                head:
                    downHGL,

                crown:
                    downInvert + D,

                excess:
                    downHGL -
                    (
                        downInvert + D
                    )

            });

        }


        if (
            results.length === 0
        ) {

            return {

                status:
                    config.missingData.severity,

                message:
                    "缺少 HGL / 管底 / 管徑資料",

                points:
                    []

            };

        }


        const maxExcess =
            Math.max(
                ...results.map(
                    x =>
                        x.excess
                )
            );


        if (
            maxExcess >= 0
        ) {

            return {

                status:
                    rule.severity,

                excess:
                    maxExcess,

                points:
                    results,

                message:
                    `HGL 已達或超過管頂，最大超高 ${fmt(maxExcess)} m`

            };

        }


        return {

            status:
                "PASS",

            excess:
                maxExcess,

            points:
                results,

            message:
                `HGL 低於管頂 ${fmt(Math.abs(maxExcess))} m`

        };

    }


    /* ============================================================
     * 14. Check HGL vs ground
     * ============================================================ */

    function checkGroundHGL(
        pipe,
        nodeMap
    ) {

        const rule =
            config.groundHGL;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                message:
                    "HGL / 地面高程檢核未啟用"

            };

        }


        const from =
            String(
                pipeUpstream(
                    pipe
                )
            );


        const to =
            String(
                pipeDownstream(
                    pipe
                )
            );


        const fromNode =
            nodeMap.get(
                from
            );


        const toNode =
            nodeMap.get(
                to
            );


        const tests = [];


        const upGround =
            nodeElevation(
                fromNode
            );


        const downGround =
            nodeElevation(
                toNode
            );


        const upHGL =
            pipeHGLUp(
                pipe
            );


        const downHGL =
            pipeHGLDown(
                pipe
            );


        if (
            finite(
                upGround
            ) &&
            finite(
                upHGL
            )
        ) {

            tests.push({

                location:
                    "upstream",

                HGL:
                    upHGL,

                ground:
                    upGround,

                excess:
                    upHGL -
                    upGround

            });

        }


        if (
            finite(
                downGround
            ) &&
            finite(
                downHGL
            )
        ) {

            tests.push({

                location:
                    "downstream",

                HGL:
                    downHGL,

                ground:
                    downGround,

                excess:
                    downHGL -
                    downGround

            });

        }


        if (
            tests.length === 0
        ) {

            return {

                status:
                    config.missingData.severity,

                message:
                    "缺少地面高程或 HGL",

                points:
                    []

            };

        }


        const maxExcess =
            Math.max(
                ...tests.map(
                    x =>
                        x.excess
                )
            );


        if (
            maxExcess >
            rule.allowableFreeboard
        ) {

            return {

                status:
                    rule.severity,

                excess:
                    maxExcess,

                points:
                    tests,

                message:
                    `HGL 超過地面高程 ${fmt(maxExcess)} m`

            };

        }


        return {

            status:
                "PASS",

            excess:
                maxExcess,

            points:
                tests,

            message:
                `HGL 未超過地面高程`

        };

    }


    /* ============================================================
     * 15. Check HGL vs external water
     * ============================================================ */

    function checkExternalWater(
        pipe,
        nodeMap
    ) {

        const rule =
            config.externalWater;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                message:
                    "外水位檢核未啟用"

            };

        }


        const from =
            String(
                pipeUpstream(
                    pipe
                )
            );


        const to =
            String(
                pipeDownstream(
                    pipe
                )
            );


        const tests = [];


        const upExternal =
            getExternalWaterLevel(
                from,
                nodeMap
            );


        const downExternal =
            getExternalWaterLevel(
                to,
                nodeMap
            );


        const upHGL =
            pipeHGLUp(
                pipe
            );


        const downHGL =
            pipeHGLDown(
                pipe
            );


        if (
            finite(
                upExternal
            ) &&
            finite(
                upHGL
            )
        ) {

            tests.push({

                location:
                    "upstream",

                HGL:
                    upHGL,

                external:
                    upExternal,

                excess:
                    upHGL -
                    upExternal

            });

        }


        if (
            finite(
                downExternal
            ) &&
            finite(
                downHGL
            )
        ) {

            tests.push({

                location:
                    "downstream",

                HGL:
                    downHGL,

                external:
                    downExternal,

                excess:
                    downHGL -
                    downExternal

            });

        }


        if (
            tests.length === 0
        ) {

            return {

                status:
                    "PASS",

                message:
                    "未提供外水位資料，跳過外水位檢核",

                points:
                    []

            };

        }


        const maxExcess =
            Math.max(
                ...tests.map(
                    x =>
                        x.excess
                )
            );


        if (
            maxExcess >
            rule.allowableHead
        ) {

            return {

                status:
                    rule.severity,

                excess:
                    maxExcess,

                points:
                    tests,

                message:
                    `HGL 高於外水位 ${fmt(maxExcess)} m`

            };

        }


        return {

            status:
                "PASS",

            excess:
                maxExcess,

            points:
                tests,

            message:
                "HGL 未超過外水位"

        };

    }


    /* ============================================================
     * 16. Pipe check
     * ============================================================ */

    function checkPipe(
        pipe,
        nodeMap
    ) {

        const velocity =
            checkVelocity(
                pipe
            );


        const diameter =
            checkDiameter(
                pipe
            );


        const fullFlow =
            checkFullFlow(
                pipe
            );


        const surcharge =
            checkSurcharge(
                pipe
            );


        const ground =
            checkGroundHGL(
                pipe,
                nodeMap
            );


        const external =
            checkExternalWater(
                pipe,
                nodeMap
            );


        const status =
            worstStatus(

                velocity.status,

                diameter.status,

                fullFlow.status,

                surcharge.status,

                ground.status,

                external.status

            );


        return {

            pipeId:
                pipe.id ??
                pipe.pipeId ??
                "-",

            from:
                pipeUpstream(
                    pipe
                ),

            to:
                pipeDownstream(
                    pipe
                ),

            Q:
                pipeFlow(
                    pipe
                ),

            velocity:
                pipeVelocity(
                    pipe
                ),

            diameter:
                pipeDiameter(
                    pipe
                ),

            depth:
                pipeDepth(
                    pipe
                ),

            HGLUp:
                pipeHGLUp(
                    pipe
                ),

            HGLDown:
                pipeHGLDown(
                    pipe
                ),

            EGLUp:
                pipeEGLUp(
                    pipe
                ),

            EGLDown:
                pipeEGLDown(
                    pipe
                ),

            status,

            checks: {

                velocity,

                diameter,

                fullFlow,

                surcharge,

                ground,

                external

            }

        };

    }


    /* ============================================================
     * 17. Build node continuity data
     * ============================================================ */

    function buildNodeFlowBalance(
        pipes
    ) {

        const map =
            new Map();


        function getNode(
            id
        ) {

            const key =
                String(id);


            if (
                !map.has(
                    key
                )
            ) {

                map.set(
                    key,
                    {

                        nodeId:
                            key,

                        inflow:
                            0,

                        outflow:
                            0,

                        net:
                            0,

                        incomingPipes:
                            [],

                        outgoingPipes:
                            []

                    }
                );

            }


            return map.get(
                key
            );

        }


        for (
            const pipe of
            pipes
        ) {

            const from =
                pipeUpstream(
                    pipe
                );


            const to =
                pipeDownstream(
                    pipe
                );


            const Q =
                Math.abs(
                    pipeFlow(
                        pipe
                    )
                );


            if (
                from !== null &&
                from !== undefined
            ) {

                const node =
                    getNode(
                        from
                    );


                node.outflow +=
                    Q;


                node.outgoingPipes.push(
                    pipe.id ??
                    pipe.pipeId
                );

            }


            if (
                to !== null &&
                to !== undefined
            ) {

                const node =
                    getNode(
                        to
                    );


                node.inflow +=
                    Q;


                node.incomingPipes.push(
                    pipe.id ??
                    pipe.pipeId
                );

            }

        }


        for (
            const node of
            map.values()
        ) {

            node.net =
                node.inflow -
                node.outflow;


            const denominator =
                Math.max(
                    node.inflow,
                    node.outflow,
                    1e-12
                );


            node.relativeError =
                Math.abs(
                    node.net
                ) /
                denominator *
                100;

        }


        return map;

    }


    /* ============================================================
     * 18. Node continuity check
     *
     * 注意：
     *
     * 真正的 source / demand node：
     *
     *     inflow - outflow = lateral inflow
     *
     * 所以若 hydraulic.js 已經提供：
     *
     *     node.lateralInflow
     *
     * 則納入平衡。
     * ============================================================ */

    function getNodeExternalFlow(
        nodeIdValue,
        nodeMap
    ) {

        const node =
            nodeMap.get(
                String(
                    nodeIdValue
                )
            );


        if (
            !node
        ) {

            return 0;

        }


        return num(
            node.lateralInflow ??
            node.inflow ??
            node.designInflow ??
            node.externalInflow ??
            node.Qin ??
            node.sourceFlow,
            0
        );

    }


    function checkNodeContinuity(
        nodeBalance,
        nodeMap
    ) {

        const rule =
            config.nodeContinuity;


        if (
            !rule.enabled
        ) {

            return {

                status:
                    "PASS",

                nodes:
                    []

            };

        }


        const results =
            [];


        for (
            const node of
            nodeBalance.values()
        ) {

            const external =
                getNodeExternalFlow(
                    node.nodeId,
                    nodeMap
                );


            /*
             * 若 node 有明確外加流量，
             *
             * balance =
             * inflow + external - outflow
             *
             * 否則：
             *
             * balance =
             * inflow - outflow
             */

            const hasExternal =
                Math.abs(
                    external
                ) >
                0;


            /* [FIX] 出口節點（無 outgoing pipe）視為平衡 */
            const isOutfall =
                !node.outgoingPipes ||
                node.outgoingPipes.length === 0;

            const effectiveOutflow =
                isOutfall
                    ? node.inflow +
                      Math.max(0, external)
                    : node.outflow;

            const balance =
                hasExternal || isOutfall
                    ? node.inflow +
                      external -
                      effectiveOutflow
                    : node.net;


            const denominator =
                Math.max(
                    Math.abs(
                        node.inflow +
                        (
                            hasExternal
                                ? external
                                : 0
                        )
                    ),
                    Math.abs(
                        effectiveOutflow
                    ),
                    1e-12
                );


            const relative =
                Math.abs(
                    balance
                ) /
                denominator *
                100;


            let status =
                "PASS";


            if (
                Math.abs(balance) >
                rule.absoluteTolerance &&
                relative >
                rule.relativeTolerance
            ) {

                status =
                    rule.severity;

            }


            results.push({

                nodeId:
                    node.nodeId,

                inflow:
                    node.inflow,

                externalInflow:
                    external,

                outflow:
                    effectiveOutflow,

                balance,

                relativeError:
                    relative,

                status

            });

        }


        return {

            status:
                results.reduce(
                    (
                        current,
                        item
                    ) =>
                        worstStatus(
                            current,
                            item.status
                        ),
                    "PASS"
                ),

            nodes:
                results

        };

    }


    /* ============================================================
     * 19. Data completeness check
     * ============================================================ */

    function checkDataCompleteness(
        pipes
    ) {

        if (
            !config.missingData.enabled
        ) {

            return {

                status:
                    "PASS",

                missing:
                    []

            };

        }


        const required = [

            [
                "Q",
                pipeFlow
            ],

            [
                "velocity",
                pipeVelocity
            ],

            [
                "diameter",
                pipeDiameter
            ],

            [
                "depth",
                pipeDepth
            ],

            [
                "upstreamInvert",
                pipeUpInvert
            ],

            [
                "downstreamInvert",
                pipeDownInvert
            ],

            [
                "upstreamHGL",
                pipeHGLUp
            ],

            [
                "downstreamHGL",
                pipeHGLDown
            ]

        ];


        const missing =
            [];


        for (
            const pipe of pipes
        ) {

            for (
                const [
                    name,
                    getter
                ] of required
            ) {

                if (
                    !finite(
                        getter(
                            pipe
                        )
                    )
                ) {

                    missing.push({

                        pipeId:
                            pipe.id ??
                            pipe.pipeId ??
                            "-",

                        field:
                            name

                    });

                }

            }

        }


        return {

            status:
                missing.length > 0
                    ? config.missingData.severity
                    : "PASS",

            missing

        };

    }


    /* ============================================================
     * 20. System check
     * ============================================================ */

    function run(
        options = {}
    ) {

        const solution =
            getHydraulicSolution();


        /*
         * 若使用者在 run 時傳入設定，
         * 套用設定。
         */

        if (
            options.config
        ) {

            setConfig(
                options.config
            );

        }


        const pipes =
            getPipeResults(
                solution
            );


        const nodeMap =
            buildNodeMap();


        /*
         * 管段檢核
         */

        const pipeResults =
            pipes.map(
                pipe =>
                    checkPipe(
                        pipe,
                        nodeMap
                    )
            );


        /*
         * 節點流量平衡
         */

        const nodeBalance =
            buildNodeFlowBalance(
                pipes
            );


        const nodeCheck =
            checkNodeContinuity(
                nodeBalance,
                nodeMap
            );


        /*
         * 資料完整性
         */

        const dataCheck =
            checkDataCompleteness(
                pipes
            );


        /*
         * 系統狀態
         */

        const pipeStatus =
            pipeResults.reduce(
                (
                    current,
                    item
                ) =>
                    worstStatus(
                        current,
                        item.status
                    ),
                "PASS"
            );


        const systemStatus =
            worstStatus(

                pipeStatus,

                nodeCheck.status,

                dataCheck.status

            );


        /*
         * Summary
         */

        const summary = {

            pipeCount:
                pipeResults.length,

            nodeCount:
                nodeCheck.nodes.length,

            pass:
                pipeResults.filter(
                    x =>
                        x.status ===
                        "PASS"
                ).length,

            warn:
                pipeResults.filter(
                    x =>
                        x.status ===
                        "WARN"
                ).length,

            fail:
                pipeResults.filter(
                    x =>
                        x.status ===
                        "FAIL"
                ).length,

            nodePass:
                nodeCheck.nodes.filter(
                    x =>
                        x.status ===
                        "PASS"
                ).length,

            nodeWarn:
                nodeCheck.nodes.filter(
                    x =>
                        x.status ===
                        "WARN"
                ).length,

            nodeFail:
                nodeCheck.nodes.filter(
                    x =>
                        x.status ===
                        "FAIL"
                ).length,

            dataMissing:
                dataCheck.missing.length,

            systemStatus

        };


        const result = {

            timestamp:
                new Date()
                    .toISOString(),

            systemStatus,

            summary,

            config:
                getConfig(),

            pipeResults,

            nodeResults:
                nodeCheck.nodes,

            dataCheck,

            source:
                "window.v3HglEglSolution"

        };


        lastResult =
            result;


        window.v3CheckingSolution =
            result;


        return result;

    }


    /* ============================================================
     * 21. CSS
     * ============================================================ */

    function injectCSS() {

        if (
            document.getElementById(
                "v3-checking-style"
            )
        ) {

            return;

        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            "v3-checking-style";


        style.textContent = `

            .v3-checking {

                font-family:
                    system-ui,
                    -apple-system,
                    BlinkMacSystemFont,
                    "Segoe UI",
                    sans-serif;

                color:
                    #212529;

                line-height:
                    1.5;

            }


            .v3-checking h3 {

                margin:
                    0 0 12px 0;

            }


            .v3-checking-card {

                background:
                    #ffffff;

                border:
                    1px solid #dee2e6;

                border-radius:
                    10px;

                padding:
                    16px;

                margin-bottom:
                    16px;

                box-shadow:
                    0 1px 3px
                    rgba(
                        0,
                        0,
                        0,
                        0.06
                    );

            }


            .v3-checking-grid {

                display:
                    grid;

                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(
                            230px,
                            1fr
                        )
                    );

                gap:
                    12px;

            }


            .v3-checking-field {

                display:
                    flex;

                flex-direction:
                    column;

                gap:
                    4px;

            }


            .v3-checking-field label {

                font-size:
                    0.85rem;

                color:
                    #495057;

            }


            .v3-checking-field input {

                width:
                    100%;

                box-sizing:
                    border-box;

                padding:
                    8px 10px;

                border:
                    1px solid #ced4da;

                border-radius:
                    6px;

            }


            .v3-checking-checkbox {

                display:
                    flex;

                align-items:
                    center;

                gap:
                    8px;

                margin-top:
                    26px;

            }


            .v3-checking-buttons {

                display:
                    flex;

                flex-wrap:
                    wrap;

                gap:
                    8px;

                margin-top:
                    14px;

            }


            .v3-checking-buttons button {

                border:
                    0;

                border-radius:
                    6px;

                padding:
                    9px 15px;

                cursor:
                    pointer;

                background:
                    #0d6efd;

                color:
                    white;

                font-weight:
                    600;

            }


            .v3-checking-buttons button.secondary {

                background:
                    #6c757d;

            }


            .v3-check-summary {

                display:
                    grid;

                grid-template-columns:
                    repeat(
                        auto-fit,
                        minmax(
                            130px,
                            1fr
                        )
                    );

                gap:
                    10px;

            }


            .v3-check-summary-box {

                padding:
                    12px;

                border-radius:
                    8px;

                background:
                    #f8f9fa;

                border:
                    1px solid #e9ecef;

            }


            .v3-check-summary-value {

                font-size:
                    1.45rem;

                font-weight:
                    700;

            }


            .v3-check-table-wrap {

                width:
                    100%;

                overflow-x:
                    auto;

            }


            .v3-check-table {

                width:
                    100%;

                border-collapse:
                    collapse;

                font-size:
                    0.88rem;

                white-space:
                    nowrap;

            }


            .v3-check-table th,
            .v3-check-table td {

                border:
                    1px solid #dee2e6;

                padding:
                    7px 8px;

                text-align:
                    right;

            }


            .v3-check-table th {

                background:
                    #f1f3f5;

                position:
                    sticky;

                top:
                    0;

            }


            .v3-check-table th:first-child,
            .v3-check-table td:first-child {

                text-align:
                    left;

            }


            .v3-check-pass {

                color:
                    #198754;

                font-weight:
                    700;

            }


            .v3-check-warn {

                color:
                    #b58105;

                font-weight:
                    700;

            }


            .v3-check-fail {

                color:
                    #dc3545;

                font-weight:
                    700;

            }


            .v3-check-na {

                color:
                    #6c757d;

            }


            .v3-check-pill {

                display:
                    inline-block;

                padding:
                    3px 8px;

                border-radius:
                    999px;

                font-size:
                    0.78rem;

                font-weight:
                    700;

            }


            .v3-check-pill.PASS {

                color:
                    #146c43;

                background:
                    #d1e7dd;

            }


            .v3-check-pill.WARN {

                color:
                    #997404;

                background:
                    #fff3cd;

            }


            .v3-check-pill.FAIL {

                color:
                    #b02a37;

                background:
                    #f8d7da;

            }


            .v3-check-system-status {

                padding:
                    14px;

                border-radius:
                    8px;

                margin-bottom:
                    15px;

                font-weight:
                    700;

            }


            .v3-check-system-status.PASS {

                color:
                    #146c43;

                background:
                    #d1e7dd;

            }


            .v3-check-system-status.WARN {

                color:
                    #997404;

                background:
                    #fff3cd;

            }


            .v3-check-system-status.FAIL {

                color:
                    #b02a37;

                background:
                    #f8d7da;

            }


            @media (
                max-width: 600px
            ) {

                .v3-checking-card {

                    padding:
                        12px;

                }

                .v3-check-table {

                    font-size:
                        0.78rem;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    /* ============================================================
     * 22. Configuration UI
     * ============================================================ */

    function renderConfigUI(
        container
    ) {

        injectCSS();


        const target =
            typeof container ===
            "string"
                ? getElement(
                    container
                )
                : container;


        if (
            !target
        ) {

            throw new Error(
                "找不到工程檢核參數容器。"
            );

        }


        target.innerHTML = `

            <div class="v3-checking">

                <div class="v3-checking-card">

                    <h3>
                        工程檢核參數
                    </h3>

                    <div class="v3-checking-grid">

                        <div class="v3-checking-field">

                            <label>
                                最小設計流速 Vmin (m/s)
                            </label>

                            <input
                                id="v3CheckVmin"
                                type="number"
                                step="0.01"
                                value="${config.velocity.min}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                最大設計流速 Vmax (m/s)
                            </label>

                            <input
                                id="v3CheckVmax"
                                type="number"
                                step="0.01"
                                value="${config.velocity.max}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                最小管徑 (mm)
                            </label>

                            <input
                                id="v3CheckDmin"
                                type="number"
                                step="1"
                                value="${config.pipeDiameter.min * 1000}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                節點絕對流量誤差 (m³/s)
                            </label>

                            <input
                                id="v3CheckAbsTol"
                                type="number"
                                step="0.0001"
                                value="${config.nodeContinuity.absoluteTolerance}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                節點相對誤差 (%)
                            </label>

                            <input
                                id="v3CheckRelTol"
                                type="number"
                                step="0.1"
                                value="${config.nodeContinuity.relativeTolerance}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                接近滿管警戒 y/D
                            </label>

                            <input
                                id="v3CheckFullWarn"
                                type="number"
                                step="0.01"
                                min="0"
                                max="1"
                                value="${config.fullFlow.warningRatio}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                滿管判定 y/D
                            </label>

                            <input
                                id="v3CheckFullRatio"
                                type="number"
                                step="0.01"
                                min="0"
                                value="${config.fullFlow.fullRatio}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                HGL 可超過地面 (m)
                            </label>

                            <input
                                id="v3CheckGroundAllowance"
                                type="number"
                                step="0.01"
                                value="${config.groundHGL.allowableFreeboard}"
                            >

                        </div>


                        <div class="v3-checking-field">

                            <label>
                                HGL 可超過外水位 (m)
                            </label>

                            <input
                                id="v3CheckExternalAllowance"
                                type="number"
                                step="0.01"
                                value="${config.externalWater.allowableHead}"
                            >

                        </div>

                    </div>


                    <div class="v3-checking-grid"
                         style="margin-top:12px;">

                        <label class="v3-checking-checkbox">

                            <input
                                id="v3CheckVelocityEnabled"
                                type="checkbox"
                                ${config.velocity.enabled ? "checked" : ""}
                            >

                            啟用流速檢核

                        </label>


                        <label class="v3-checking-checkbox">

                            <input
                                id="v3CheckDiameterEnabled"
                                type="checkbox"
                                ${config.pipeDiameter.enabled ? "checked" : ""}
                            >

                            啟用最小管徑檢核

                        </label>


                        <label class="v3-checking-checkbox">

                            <input
                                id="v3CheckContinuityEnabled"
                                type="checkbox"
                                ${config.nodeContinuity.enabled ? "checked" : ""}
                            >

                            啟用節點連續檢核

                        </label>


                        <label class="v3-checking-checkbox">

                            <input
                                id="v3CheckSurchargeEnabled"
                                type="checkbox"
                                ${config.surcharge.enabled ? "checked" : ""}
                            >

                            啟用 Surcharge 檢核

                        </label>


                        <label class="v3-checking-checkbox">

                            <input
                                id="v3CheckGroundEnabled"
                                type="checkbox"
                                ${config.groundHGL.enabled ? "checked" : ""}
                            >

                            啟用 HGL / 地面檢核

                        </label>


                        <label class="v3-checking-checkbox">

                            <input
                                id="v3CheckExternalEnabled"
                                type="checkbox"
                                ${config.externalWater.enabled ? "checked" : ""}
                            >

                            啟用 HGL / 外水位檢核

                        </label>

                    </div>


                    <div class="v3-checking-buttons">

                        <button
                            type="button"
                            id="v3ApplyCheckConfig"
                        >
                            套用參數並重新檢核
                        </button>


                        <button
                            type="button"
                            class="secondary"
                            id="v3ResetCheckConfig"
                        >
                            恢復預設值
                        </button>

                    </div>

                </div>

            </div>

        `;


        const applyButton =
            getElement(
                "v3ApplyCheckConfig"
            );


        const resetButton =
            getElement(
                "v3ResetCheckConfig"
            );


        applyButton.addEventListener(
            "click",
            function () {

                applyConfigFromUI();

            }
        );


        resetButton.addEventListener(
            "click",
            function () {

                config =
                    deepClone(
                        DEFAULT_CONFIG
                    );


                window.V3CheckingConfig =
                    getConfig();


                renderConfigUI(
                    target
                );


                if (
                    lastResult
                ) {

                    renderResults(
                        lastResult
                    );

                }

            }
        );

    }


    /* ============================================================
     * 23. Apply UI config
     * ============================================================ */

    function applyConfigFromUI() {

        const vmin =
            num(
                getElement(
                    "v3CheckVmin"
                )?.value,
                config.velocity.min
            );


        const vmax =
            num(
                getElement(
                    "v3CheckVmax"
                )?.value,
                config.velocity.max
            );


        const dmin =
            num(
                getElement(
                    "v3CheckDmin"
                )?.value,
                config.pipeDiameter.min * 1000
            ) /
            1000;


        const absTol =
            num(
                getElement(
                    "v3CheckAbsTol"
                )?.value,
                config.nodeContinuity.absoluteTolerance
            );


        const relTol =
            num(
                getElement(
                    "v3CheckRelTol"
                )?.value,
                config.nodeContinuity.relativeTolerance
            );


        const fullWarn =
            num(
                getElement(
                    "v3CheckFullWarn"
                )?.value,
                config.fullFlow.warningRatio
            );


        const fullRatio =
            num(
                getElement(
                    "v3CheckFullRatio"
                )?.value,
                config.fullFlow.fullRatio
            );


        const groundAllowance =
            num(
                getElement(
                    "v3CheckGroundAllowance"
                )?.value,
                config.groundHGL.allowableFreeboard
            );


        const externalAllowance =
            num(
                getElement(
                    "v3CheckExternalAllowance"
                )?.value,
                config.externalWater.allowableHead
            );


        setConfig({

            velocity: {

                enabled:
                    Boolean(
                        getElement(
                            "v3CheckVelocityEnabled"
                        )?.checked
                    ),

                min:
                    vmin,

                max:
                    vmax

            },


            pipeDiameter: {

                enabled:
                    Boolean(
                        getElement(
                            "v3CheckDiameterEnabled"
                        )?.checked
                    ),

                min:
                    dmin

            },


            nodeContinuity: {

                enabled:
                    Boolean(
                        getElement(
                            "v3CheckContinuityEnabled"
                        )?.checked
                    ),

                absoluteTolerance:
                    absTol,

                relativeTolerance:
                    relTol

            },


            fullFlow: {

                warningRatio:
                    fullWarn,

                fullRatio:
                    fullRatio

            },


            surcharge: {

                enabled:
                    Boolean(
                        getElement(
                            "v3CheckSurchargeEnabled"
                        )?.checked
                    )

            },


            groundHGL: {

                enabled:
                    Boolean(
                        getElement(
                            "v3CheckGroundEnabled"
                        )?.checked
                    ),

                allowableFreeboard:
                    groundAllowance

            },


            externalWater: {

                enabled:
                    Boolean(
                        getElement(
                            "v3CheckExternalEnabled"
                        )?.checked
                    ),

                allowableHead:
                    externalAllowance

            }

        });


        try {

            const result =
                run();


            renderResults(
                result
            );

        } catch (
            error
        ) {

            renderError(
                error
            );

        }

    }


    /* ============================================================
     * 24. Render summary
     * ============================================================ */

    function renderSummary(
        result
    ) {

        const s =
            result.summary;


        return `

            <div class="v3-checking-card">

                <h3>
                    系統檢核摘要
                </h3>


                <div class="
                    v3-check-system-status
                    ${statusClass(result.systemStatus)}
                ">

                    系統檢核：
                    ${statusText(result.systemStatus)}

                </div>


                <div class="v3-check-summary">

                    <div class="v3-check-summary-box">

                        <div>
                            管段數
                        </div>

                        <div class="v3-check-summary-value">
                            ${s.pipeCount}
                        </div>

                    </div>


                    <div class="v3-check-summary-box">

                        <div>
                            PASS
                        </div>

                        <div
                            class="v3-check-summary-value v3-check-pass"
                        >
                            ${s.pass}
                        </div>

                    </div>


                    <div class="v3-check-summary-box">

                        <div>
                            WARN
                        </div>

                        <div
                            class="v3-check-summary-value v3-check-warn"
                        >
                            ${s.warn}
                        </div>

                    </div>


                    <div class="v3-check-summary-box">

                        <div>
                            FAIL
                        </div>

                        <div
                            class="v3-check-summary-value v3-check-fail"
                        >
                            ${s.fail}
                        </div>

                    </div>


                    <div class="v3-check-summary-box">

                        <div>
                            節點
                        </div>

                        <div class="v3-check-summary-value">
                            ${s.nodeCount}
                        </div>

                    </div>


                    <div class="v3-check-summary-box">

                        <div>
                            缺少資料
                        </div>

                        <div
                            class="v3-check-summary-value
                                   ${s.dataMissing > 0
                                       ? "v3-check-warn"
                                       : "v3-check-pass"}"
                        >
                            ${s.dataMissing}
                        </div>

                    </div>

                </div>

            </div>

        `;

    }


    /* ============================================================
     * 25. Render pipe table
     * ============================================================ */

    function renderPipeTable(
        result
    ) {

        const rows =
            result.pipeResults
                .map(
                    item => {

                        const c =
                            item.checks;


                        return `

                            <tr>

                                <td>
                                    ${escapeHTML(
                                        item.pipeId
                                    )}
                                </td>

                                <td>
                                    ${escapeHTML(
                                        item.from
                                    )}
                                    →
                                    ${escapeHTML(
                                        item.to
                                    )}
                                </td>

                                <td>
                                    ${fmt(
                                        item.Q,
                                        4
                                    )}
                                </td>

                                <td>
                                    ${fmt(
                                        item.diameter * 1000,
                                        0
                                    )}
                                </td>

                                <td>
                                    ${fmt(
                                        item.depth,
                                        3
                                    )}
                                </td>

                                <td>
                                    ${fmt(
                                        item.velocity,
                                        3
                                    )}
                                </td>

                                <td>
                                    ${fmt(
                                        item.HGLUp,
                                        3
                                    )}
                                </td>

                                <td>
                                    ${fmt(
                                        item.HGLDown,
                                        3
                                    )}
                                </td>

                                <td>
                                    <span
                                        class="v3-check-pill ${item.status}"
                                    >
                                        ${item.status}
                                    </span>
                                </td>

                                <td
                                    class="${statusClass(c.velocity.status)}"
                                >
                                    ${c.velocity.status}
                                </td>

                                <td
                                    class="${statusClass(c.diameter.status)}"
                                >
                                    ${c.diameter.status}
                                </td>

                                <td
                                    class="${statusClass(c.fullFlow.status)}"
                                >
                                    ${c.fullFlow.status}
                                </td>

                                <td
                                    class="${statusClass(c.surcharge.status)}"
                                >
                                    ${c.surcharge.status}
                                </td>

                                <td
                                    class="${statusClass(c.ground.status)}"
                                >
                                    ${c.ground.status}
                                </td>

                                <td
                                    class="${statusClass(c.external.status)}"
                                >
                                    ${c.external.status}
                                </td>

                            </tr>

                        `;

                    }
                )
                .join("");


        return `

            <div class="v3-checking-card">

                <h3>
                    逐管段工程檢核成果
                </h3>

                <div class="v3-check-table-wrap">

                    <table class="v3-check-table">

                        <thead>

                            <tr>

                                <th>
                                    管段
                                </th>

                                <th>
                                    節點
                                </th>

                                <th>
                                    Q<br>
                                    m³/s
                                </th>

                                <th>
                                    D<br>
                                    mm
                                </th>

                                <th>
                                    y<br>
                                    m
                                </th>

                                <th>
                                    V<br>
                                    m/s
                                </th>

                                <th>
                                    HGL上游<br>
                                    m
                                </th>

                                <th>
                                    HGL下游<br>
                                    m
                                </th>

                                <th>
                                    總評定
                                </th>

                                <th>
                                    流速
                                </th>

                                <th>
                                    管徑
                                </th>

                                <th>
                                    滿管
                                </th>

                                <th>
                                    Surcharge
                                </th>

                                <th>
                                    HGL/地面
                                </th>

                                <th>
                                    HGL/外水位
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            ${
                                rows ||
                                `
                                <tr>
                                    <td colspan="15">
                                        無管段資料
                                    </td>
                                </tr>
                                `
                            }

                        </tbody>

                    </table>

                </div>

            </div>

        `;

    }


    /* ============================================================
     * 26. Render node table
     * ============================================================ */

    function renderNodeTable(
        result
    ) {

        const rows =
            result.nodeResults
                .map(
                    item => `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    item.nodeId
                                )}
                            </td>

                            <td>
                                ${fmt(
                                    item.inflow,
                                    5
                                )}
                            </td>

                            <td>
                                ${fmt(
                                    item.externalInflow,
                                    5
                                )}
                            </td>

                            <td>
                                ${fmt(
                                    item.outflow,
                                    5
                                )}
                            </td>

                            <td>
                                ${fmt(
                                    item.balance,
                                    6
                                )}
                            </td>

                            <td>
                                ${fmt(
                                    item.relativeError,
                                    3
                                )} %
                            </td>

                            <td>

                                <span
                                    class="v3-check-pill ${item.status}"
                                >
                                    ${item.status}
                                </span>

                            </td>

                        </tr>

                    `
                )
                .join("");


        return `

            <div class="v3-checking-card">

                <h3>
                    節點連續方程檢核
                </h3>

                <div style="
                    margin-bottom:10px;
                    color:#495057;
                    font-size:0.9rem;
                ">

                    絕對容許誤差：
                    ${fmt(
                        config.nodeContinuity.absoluteTolerance,
                        6
                    )}
                    m³/s

                    ／

                    相對容許誤差：
                    ${fmt(
                        config.nodeContinuity.relativeTolerance,
                        2
                    )}
                    %

                </div>

                <div class="v3-check-table-wrap">

                    <table class="v3-check-table">

                        <thead>

                            <tr>

                                <th>
                                    節點
                                </th>

                                <th>
                                    入流
                                </th>

                                <th>
                                    外加流量
                                </th>

                                <th>
                                    出流
                                </th>

                                <th>
                                    Balance
                                </th>

                                <th>
                                    相對誤差
                                </th>

                                <th>
                                    檢核
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            ${
                                rows ||
                                `
                                <tr>
                                    <td colspan="7">
                                        無節點資料
                                    </td>
                                </tr>
                                `
                            }

                        </tbody>

                    </table>

                </div>

            </div>

        `;

    }


    /* ============================================================
     * 27. Render messages
     * ============================================================ */

    function renderDataWarning(
        result
    ) {

        if (
            !result.dataCheck ||
            result.dataCheck.missing.length ===
            0
        ) {

            return "";

        }


        const rows =
            result.dataCheck.missing
                .slice(
                    0,
                    50
                )
                .map(
                    item =>
                        `<li>
                            ${escapeHTML(item.pipeId)}
                            —
                            ${escapeHTML(item.field)}
                        </li>`
                )
                .join("");


        return `

            <div class="v3-checking-card">

                <h3>
                    資料完整性提醒
                </h3>

                <div class="v3-check-warn">

                    下列資料缺失：

                </div>

                <ul>

                    ${rows}

                </ul>

            </div>

        `;

    }


    /* ============================================================
     * 28. Render results
     * ============================================================ */

    function renderResults(
        result,
        container
    ) {

        injectCSS();


        const target =
            container
                ? (
                    typeof container ===
                    "string"
                        ? getElement(
                            container
                        )
                        : container
                )
                : getElement(
                    resultContainerId
                );


        if (
            !target
        ) {

            return;

        }


        target.innerHTML = `

            <div class="v3-checking">

                ${renderSummary(result)}

                ${renderPipeTable(result)}

                ${renderNodeTable(result)}

                ${renderDataWarning(result)}

            </div>

        `;

    }


    /* ============================================================
     * 29. Render error
     * ============================================================ */

    function renderError(
        error,
        container
    ) {

        const target =
            container
                ? (
                    typeof container ===
                    "string"
                        ? getElement(
                            container
                        )
                        : container
                )
                : getElement(
                    resultContainerId
                );


        if (
            !target
        ) {

            return;

        }


        target.innerHTML = `

            <div class="v3-checking">

                <div class="
                    v3-check-system-status
                    FAIL
                ">

                    工程檢核無法執行：

                    ${escapeHTML(
                        error?.message ||
                        error
                    )}

                </div>

            </div>

        `;

    }


    /* ============================================================
     * 30. Run + render
     * ============================================================ */

    function runAndRender(
        options = {}
    ) {

        try {

            const result =
                run(
                    options
                );


            renderResults(
                result,
                options.container
            );


            return result;

        } catch (
            error
        ) {

            renderError(
                error,
                options.container
            );


            console.error(
                "[V3Checking]",
                error
            );


            return null;

        }

    }


    /* ============================================================
     * 31. Initialize UI
     * ============================================================ */

    function init(
        options = {}
    ) {

        injectCSS();


        if (
            options.resultContainer
        ) {

            resultContainerId =
                typeof options.resultContainer ===
                "string"
                    ? options.resultContainer
                    : resultContainerId;

        }


        if (
            options.configContainer
        ) {

            configContainerId =
                typeof options.configContainer ===
                "string"
                    ? options.configContainer
                    : configContainerId;

        }


        const configContainer =
            options.configContainer
                ? (
                    typeof options.configContainer ===
                    "string"
                        ? getElement(
                            options.configContainer
                        )
                        : options.configContainer
                )
                : getElement(
                    configContainerId
                );


        if (
            configContainer
        ) {

            renderConfigUI(
                configContainer
            );

        }


        /*
         * 若已經有 HGL/EGL 結果，
         * 自動執行一次。
         */

        if (
            window.v3HglEglSolution
        ) {

            runAndRender({

                container:
                    options.resultContainer ||
                    resultContainerId

            });

        }


        return {

            config:
                getConfig(),

            result:
                lastResult

        };

    }


    /* ============================================================
     * 32. Export CSV
     * ============================================================ */

    function exportCSV(
        result = lastResult
    ) {

        if (
            !result
        ) {

            result =
                run();

        }


        const rows = [

            [

                "Pipe",

                "From",

                "To",

                "Q_m3s",

                "Diameter_mm",

                "Depth_m",

                "Velocity_ms",

                "HGL_Up_m",

                "HGL_Down_m",

                "EGL_Up_m",

                "EGL_Down_m",

                "Overall",

                "Velocity",

                "Diameter",

                "FullFlow",

                "Surcharge",

                "HGL_Ground",

                "HGL_External"

            ]

        ];


        for (
            const p of
            result.pipeResults
        ) {

            const c =
                p.checks;


            rows.push([

                p.pipeId,

                p.from,

                p.to,

                p.Q,

                p.diameter * 1000,

                p.depth,

                p.velocity,

                p.HGLUp,

                p.HGLDown,

                p.EGLUp,

                p.EGLDown,

                p.status,

                c.velocity.status,

                c.diameter.status,

                c.fullFlow.status,

                c.surcharge.status,

                c.ground.status,

                c.external.status

            ]);

        }


        const csv =
            rows
                .map(
                    row =>
                        row
                            .map(
                                value =>
                                    `"${String(
                                        value ?? ""
                                    ).replace(
                                        /"/g,
                                        '""'
                                    )}"`
                            )
                            .join(",")
                )
                .join("\n");


        const blob =
            new Blob(
                [
                    "\uFEFF" +
                    csv
                ],
                {
                    type:
                        "text/csv;charset=utf-8;"
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
            "V3_工程檢核成果.csv";


        a.click();


        URL.revokeObjectURL(
            url
        );

    }


    /* ============================================================
     * 33. Public API
     * ============================================================ */

    window.V3Checking = {

        defaults:
            deepClone(
                DEFAULT_CONFIG
            ),

        getConfig,

        setConfig,

        run,

        runAndRender,

        init,

        renderConfigUI,

        renderResults,

        exportCSV,

        checkVelocity,

        checkDiameter,

        checkFullFlow,

        checkSurcharge,

        checkGroundHGL,

        checkExternalWater,

        checkNodeContinuity,

        checkPipe

    };


    /*
     * 相容舊命名
     */

    window.Checking =
        window.V3Checking;


})(window);
