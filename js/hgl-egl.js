/* ================================================================
 * 台灣雨水下水道數值水理分析 V3
 *
 * File:
 *     js/hgl-egl.js
 *
 * Purpose:
 *     讀取 window.v3HydraulicSolution.pipeResults
 *
 *     建立：
 *       1. 管底高程
 *       2. 正常水深
 *       3. 水面高程
 *       4. HGL
 *       5. EGL
 *       6. Manning 摩阻損失
 *       7. 局部損失
 *       8. 下游邊界
 *       9. 下游回水 / 能量線反算
 *      10. 縱剖面 station
 *
 * Notes:
 *     本模組屬 V3 穩態 / 準穩態能量線後處理。
 *
 *     不宣稱為：
 *       - Saint-Venant Dynamic Wave
 *       - 完整 GVF Standard Step Method
 *       - 完整 Pressurized-Pipe Dynamic Solver
 *
 * ================================================================ */

(function (window) {

    "use strict";


    /* ============================================================
     * Constants
     * ============================================================ */

    const G = 9.80665;

    const EPS = 1.0e-10;


    /* ============================================================
     * Default settings
     * ============================================================ */

    const DEFAULTS = {

        gravity:
            G,

        /*
         * Darcy / energy local-loss coefficient.
         *
         * 這不是規範固定值。
         * 由工程資料提供時優先使用 pipeResults / pipes 的值。
         */

        defaultKEntrance:
            0.0,

        defaultKExit:
            0.0,

        defaultKMinor:
            0.0,

        /*
         * 下游邊界。
         *
         * 可由：
         *
         * pipeResults
         * nodes
         * window.v3BoundaryConditions
         *
         * 提供。
         */

        downstreamBoundaryElevation:
            null,

        downstreamBoundaryDepth:
            null,

        downstreamBoundaryHGL:
            null,

        /*
         * 若沒有外部邊界，
         * 使用求解結果的 normal depth / depth
         * 建立 fallback hydraulic grade。
         */

        useSolvedDepthAsFallback:
            true,

        /*
         * 是否將 velocity head 納入 EGL。
         */

        includeVelocityHead:
            true,

        /*
         * Chart
         */

        chartHeight:
            430,

        chartLineWidth:
            2.5,

        fillGround:
            true,

        /*
         * 回水反算：
         *
         * HGL_upstream =
         *     HGL_downstream
         *     + hf
         *     + hm
         *     + velocity-head correction
         *
         * 這是穩態能量線後處理，
         * 並非完整 GVF。
         */

        propagateBackwater:
            true

    };


    /* ============================================================
     * Utility
     * ============================================================ */

    function num(value, fallback = 0) {

        const x =
            Number(value);

        return Number.isFinite(x)
            ? x
            : fallback;
    }


    function positive(value, fallback = 0) {

        const x =
            num(value, fallback);

        return x > 0
            ? x
            : fallback;
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
                    Number(object[key])
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


    function idOf(
        object,
        keys
    ) {

        const value =
            firstValue(
                object,
                keys,
                null
            );


        return value === null
            ? null
            : String(value);

    }


    function clamp(
        value,
        min,
        max
    ) {

        return Math.max(
            min,
            Math.min(
                max,
                value
            )
        );

    }


    /* ============================================================
     * Find node
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


        return [];

    }


    function getPipeResults() {

        const solution =
            window.v3HydraulicSolution;


        if (
            solution &&
            Array.isArray(
                solution.pipeResults
            )
        ) {

            return solution.pipeResults;

        }


        return [];

    }


    /* ============================================================
     * Build dictionaries
     * ============================================================ */

    function buildPipeDictionary(
        pipeResults,
        pipes
    ) {

        const map =
            new Map();


        for (
            const pipe of pipes
        ) {

            const id =
                idOf(
                    pipe,
                    [
                        "id",
                        "pipeId",
                        "name",
                        "code"
                    ]
                );


            if (id) {

                map.set(
                    id,
                    pipe
                );

            }

        }


        for (
            const result of pipeResults
        ) {

            const id =
                idOf(
                    result,
                    [
                        "pipeId",
                        "id",
                        "pipe",
                        "name",
                        "code"
                    ]
                );


            if (!id) {

                continue;

            }


            const original =
                map.get(id) || {};


            map.set(
                id,
                {
                    ...original,
                    ...result
                }
            );

        }


        return map;

    }


    function buildNodeDictionary(
        nodes
    ) {

        const map =
            new Map();


        for (
            const node of nodes
        ) {

            const id =
                idOf(
                    node,
                    [
                        "id",
                        "nodeId",
                        "name",
                        "code"
                    ]
                );


            if (id) {

                map.set(
                    id,
                    node
                );

            }

        }


        return map;

    }


    /* ============================================================
     * Extract pipe geometry
     * ============================================================ */

    function normalizePipe(
        pipe
    ) {

        const from =
            idOf(
                pipe,
                [
                    "from",
                    "fromNode",
                    "upstream",
                    "upstreamNode",
                    "startNode"
                ]
            );


        const to =
            idOf(
                pipe,
                [
                    "to",
                    "toNode",
                    "downstream",
                    "downstreamNode",
                    "endNode"
                ]
            );


        const length =
            positive(
                firstNumber(
                    pipe,
                    [
                        "length",
                        "L",
                        "pipeLength"
                    ],
                    0
                )
            );


        const diameter =
            positive(
                firstNumber(
                    pipe,
                    [
                        "diameter",
                        "D",
                        "pipeDiameter"
                    ],
                    0
                )
            );


        const n =
            positive(
                firstNumber(
                    pipe,
                    [
                        "n",
                        "manningN",
                        "roughness"
                    ],
                    0.013
                ),
                0.013
            );


        const slope =
            firstNumber(
                pipe,
                [
                    "slope",
                    "S",
                    "bedSlope",
                    "invertSlope"
                ],
                0
            );


        return {

            id:
                idOf(
                    pipe,
                    [
                        "pipeId",
                        "id",
                        "name",
                        "code"
                    ]
                ),

            from,

            to,

            length,

            diameter,

            n,

            slope

        };

    }


    /* ============================================================
     * Circular pipe geometry
     * ============================================================ */

    function circularGeometry(
        diameter,
        depth
    ) {

        const D =
            positive(
                diameter
            );


        const y =
            clamp(
                positive(depth),
                0,
                D
            );


        if (
            D <= EPS ||
            y <= EPS
        ) {

            return {

                area: 0,

                wettedPerimeter: 0,

                hydraulicRadius: 0,

                topWidth: 0,

                hydraulicDepth: 0

            };

        }


        /*
         * theta = central angle of wetted portion
         */

        const ratio =
            clamp(
                (D / 2 - y) /
                (D / 2),
                -1,
                1
            );


        const theta =
            2 *
            Math.acos(
                ratio
            );


        const area =
            D * D / 8 *
            (
                theta -
                Math.sin(theta)
            );


        const wettedPerimeter =
            D * theta / 2;


        const hydraulicRadius =
            wettedPerimeter > EPS
                ? area /
                  wettedPerimeter
                : 0;


        const topWidth =
            2 *
            Math.sqrt(
                Math.max(
                    0,
                    D * y - y * y
                )
            );


        const hydraulicDepth =
            topWidth > EPS
                ? area / topWidth
                : 0;


        return {

            area,

            wettedPerimeter,

            hydraulicRadius,

            topWidth,

            hydraulicDepth,

            theta

        };

    }


    /* ============================================================
     * Manning velocity
     * ============================================================ */

    function manningVelocity(
        n,
        radius,
        slope
    ) {

        if (
            n <= EPS ||
            radius <= EPS ||
            slope <= EPS
        ) {

            return 0;

        }


        return (
            1 / n
        ) *
        Math.pow(
            radius,
            2 / 3
        ) *
        Math.sqrt(
            slope
        );

    }


    /* ============================================================
     * Calculate velocity head
     * ============================================================ */

    function velocityHead(
        velocity,
        gravity
    ) {

        return (
            velocity *
            velocity
        ) /
        (
            2 *
            gravity
        );

    }


    /* ============================================================
     * Manning friction loss
     *
     * hf = S_f * L
     *
     * 若 solver 已提供 headloss / frictionLoss，
     * 優先使用 solver 結果。
     * ============================================================ */

    function calculateFrictionLoss(
        pipe,
        result,
        geometry
    ) {

        const direct =
            firstNumber(
                result,
                [
                    "frictionLoss",
                    "frictionHeadLoss",
                    "headLoss",
                    "hf",
                    "hfManning"
                ],
                NaN
            );


        if (
            Number.isFinite(
                direct
            ) &&
            direct >= 0
        ) {

            return direct;

        }


        const slope =
            positive(
                firstNumber(
                    result,
                    [
                        "frictionSlope",
                        "Sf",
                        "hydraulicSlope"
                    ],
                    NaN
                ),
                NaN
            );


        if (
            Number.isFinite(
                slope
            ) &&
            pipe.length > 0
        ) {

            return (
                slope *
                pipe.length
            );

        }


        /*
         * 若沒有 Sf，
         * 用 Manning 反算。
         */

        const Q =
            Math.abs(
                firstNumber(
                    result,
                    [
                        "Q",
                        "flow",
                        "flowRate",
                        "discharge"
                    ],
                    0
                )
            );


        if (
            Q <= EPS ||
            geometry.area <= EPS ||
            geometry.hydraulicRadius <= EPS ||
            pipe.length <= 0 ||
            pipe.n <= EPS
        ) {

            return 0;

        }


        const Sf =
            Math.pow(
                Q *
                pipe.n /
                (
                    geometry.area *
                    Math.pow(
                        geometry.hydraulicRadius,
                        2 / 3
                    )
                ),
                2
            );


        return (
            Math.max(
                0,
                Sf
            ) *
            pipe.length
        );

    }


    /* ============================================================
     * Local loss
     *
     * K_total * V² / 2g
     *
     * 支援：
     *   K
     *   minorLossCoefficient
     *   entranceK
     *   exitK
     *   bendK
     *   junctionK
     * ============================================================ */

    function calculateLocalLoss(
        pipe,
        result,
        settings,
        velocity
    ) {

        const direct =
            firstNumber(
                result,
                [
                    "localLoss",
                    "minorLoss",
                    "minorHeadLoss",
                    "hm"
                ],
                NaN
            );


        if (
            Number.isFinite(
                direct
            ) &&
            direct >= 0
        ) {

            return direct;

        }


        const K =
            firstNumber(
                result,
                [
                    "K",
                    "k",
                    "minorK",
                    "lossCoefficient",
                    "minorLossCoefficient"
                ],
                NaN
            );


        const entranceK =
            firstNumber(
                result,
                [
                    "entranceK",
                    "Kentrance"
                ],
                settings.defaultKEntrance
            );


        const exitK =
            firstNumber(
                result,
                [
                    "exitK",
                    "Kexit"
                ],
                settings.defaultKExit
            );


        const bendK =
            firstNumber(
                result,
                [
                    "bendK",
                    "Kbend"
                ],
                0
            );


        const junctionK =
            firstNumber(
                result,
                [
                    "junctionK",
                    "Kjunction"
                ],
                0
            );


        const totalK =
            Number.isFinite(K)
                ? K
                : (
                    entranceK +
                    exitK +
                    bendK +
                    junctionK +
                    settings.defaultKMinor
                );


        if (
            totalK <= 0
        ) {

            return 0;

        }


        return (
            totalK *
            velocityHead(
                velocity,
                settings.gravity
            )
        );

    }


    /* ============================================================
     * Node invert elevation
     * ============================================================ */

    function nodeInvert(
        node
    ) {

        return firstNumber(
            node,
            [
                "invert",
                "invertElevation",
                "invertElev",
                "bottomElevation",
                "elevation",
                "z"
            ],
            NaN
        );

    }


    /* ============================================================
     * Pipe upstream / downstream invert
     * ============================================================ */

    function pipeInvertElevations(
        pipe,
        nodeMap
    ) {

        const fromNode =
            nodeMap.get(
                pipe.from
            );


        const toNode =
            nodeMap.get(
                pipe.to
            );


        let upstream =
            nodeInvert(
                fromNode
            );


        let downstream =
            nodeInvert(
                toNode
            );


        /*
         * 若 node 沒有 invert，
         * 使用 pipe 自帶資料。
         */

        if (
            !Number.isFinite(
                upstream
            )
        ) {

            upstream =
                firstNumber(
                    pipe,
                    [
                        "upstreamInvert",
                        "fromInvert",
                        "invertUp"
                    ],
                    NaN
                );

        }


        if (
            !Number.isFinite(
                downstream
            )
        ) {

            downstream =
                firstNumber(
                    pipe,
                    [
                        "downstreamInvert",
                        "toInvert",
                        "invertDown"
                    ],
                    NaN
                );

        }


        /*
         * 如果只有 upstream + slope + length，
         * 推算 downstream。
         */

        if (
            Number.isFinite(upstream) &&
            !Number.isFinite(downstream)
        ) {

            downstream =
                upstream -
                pipe.slope *
                pipe.length;

        }


        /*
         * 如果只有 downstream + slope + length，
         * 反算 upstream。
         */

        if (
            !Number.isFinite(upstream) &&
            Number.isFinite(downstream)
        ) {

            upstream =
                downstream +
                pipe.slope *
                pipe.length;

        }


        return {

            upstream,

            downstream

        };

    }


    /* ============================================================
     * Boundary condition
     * ============================================================ */

    function getBoundaryConditions() {

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


        return {};

    }


    function getNodeBoundary(
        nodeId
    ) {

        const bc =
            getBoundaryConditions();


        const nodeBC =
            bc.nodes &&
            bc.nodes[nodeId]
                ? bc.nodes[nodeId]
                : null;


        if (
            !nodeBC
        ) {

            return null;

        }


        return {

            elevation:
                firstNumber(
                    nodeBC,
                    [
                        "elevation",
                        "waterElevation",
                        "waterLevel",
                        "HGL"
                    ],
                    NaN
                ),

            hgl:
                firstNumber(
                    nodeBC,
                    [
                        "HGL",
                        "hgl",
                        "hydraulicGrade"
                    ],
                    NaN
                ),

            depth:
                firstNumber(
                    nodeBC,
                    [
                        "depth",
                        "waterDepth"
                    ],
                    NaN
                )

        };

    }


    /* ============================================================
     * Calculate pipe record
     * ============================================================ */

    function calculatePipeRecord(
        pipe,
        result,
        nodeMap,
        settings
    ) {

        const normalized =
            normalizePipe(
                {
                    ...pipe,
                    ...result
                }
            );


        const inv =
            pipeInvertElevations(
                normalized,
                nodeMap
            );


        const Q =
            firstNumber(
                result,
                [
                    "Q",
                    "flow",
                    "flowRate",
                    "discharge"
                ],
                0
            );


        const depth =
            positive(
                firstNumber(
                    result,
                    [
                        "depth",
                        "normalDepth",
                        "waterDepth",
                        "y"
                    ],
                    0
                )
            );


        const D =
            normalized.diameter;


        const geometry =
            circularGeometry(
                D,
                depth
            );


        let velocity =
            firstNumber(
                result,
                [
                    "velocity",
                    "V",
                    "flowVelocity"
                ],
                NaN
            );


        if (
            !Number.isFinite(
                velocity
            ) &&
            geometry.area > EPS
        ) {

            velocity =
                Math.abs(Q) /
                geometry.area;

        }


        velocity =
            Number.isFinite(
                velocity
            )
                ? Math.abs(
                    velocity
                )
                : 0;


        const velocityHeadValue =
            velocityHead(
                velocity,
                settings.gravity
            );


        const frictionLoss =
            calculateFrictionLoss(
                normalized,
                result,
                geometry
            );


        const localLoss =
            calculateLocalLoss(
                normalized,
                /*
                 * [FIX] K 係數（entranceK / exitK / bendK / junctionK）
                 * 存在於輸入管段 pipe，而非水理成果 result；
                 * 原本只傳 result，導致所有局部損失恆為 0。
                 * result 放後面，若成果內已有 localLoss 仍優先採用。
                 */
                { ...pipe, ...result },
                settings,
                velocity
            );


        /*
         * Froude
         */

        const froude =
            geometry.hydraulicDepth > EPS &&
            velocity > 0
                ? velocity /
                  Math.sqrt(
                      settings.gravity *
                      geometry.hydraulicDepth
                  )
                : firstNumber(
                    result,
                    [
                        "froude",
                        "Fr"
                    ],
                    0
                );


        /*
         * Downstream velocity head
         * 可用於能量線傳遞。
         */

        return {

            id:
                normalized.id,

            from:
                normalized.from,

            to:
                normalized.to,

            length:
                normalized.length,

            diameter:
                normalized.diameter,

            n:
                normalized.n,

            slope:
                normalized.slope,

            Q,

            depth,

            area:
                geometry.area,

            wettedPerimeter:
                geometry.wettedPerimeter,

            hydraulicRadius:
                geometry.hydraulicRadius,

            hydraulicDepth:
                geometry.hydraulicDepth,

            velocity,

            velocityHead:
                velocityHeadValue,

            froude,

            upstreamInvert:
                inv.upstream,

            downstreamInvert:
                inv.downstream,

            frictionLoss,

            localLoss,

            totalLoss:
                frictionLoss +
                localLoss,

            upstreamHGL:
                NaN,

            downstreamHGL:
                NaN,

            upstreamEGL:
                NaN,

            downstreamEGL:
                NaN,

            upstreamWaterSurface:
                NaN,

            downstreamWaterSurface:
                NaN,

            upstreamBackwater:
                0,

            downstreamBackwater:
                0

        };

    }


    /* ============================================================
     * Build network
     * ============================================================ */

    function buildNetwork(
        records
    ) {

        const outgoing =
            new Map();


        const incoming =
            new Map();


        const nodes =
            new Set();


        for (
            const p of records
        ) {

            nodes.add(
                p.from
            );

            nodes.add(
                p.to
            );


            if (
                !outgoing.has(
                    p.from
                )
            ) {

                outgoing.set(
                    p.from,
                    []
                );

            }


            if (
                !incoming.has(
                    p.to
                )
            ) {

                incoming.set(
                    p.to,
                    []
                );

            }


            outgoing
                .get(
                    p.from
                )
                .push(
                    p
                );


            incoming
                .get(
                    p.to
                )
                .push(
                    p
                );

        }


        return {

            outgoing,

            incoming,

            nodes

        };

    }


    /* ============================================================
     * Identify downstream terminal nodes
     * ============================================================ */

    function findOutletNodes(
        network
    ) {

        const outlets =
            [];


        for (
            const nodeId of
            network.nodes
        ) {

            const outgoing =
                network.outgoing.get(
                    nodeId
                ) || [];


            if (
                outgoing.length === 0
            ) {

                outlets.push(
                    nodeId
                );

            }

        }


        return outlets;

    }


    /* ============================================================
     * Determine initial HGL
     *
     * Priority:
     *
     * 1. Explicit boundary HGL
     * 2. Boundary water elevation
     * 3. Existing node HGL
     * 4. Pipe solved downstream water surface
     * 5. invert + depth
     * ============================================================ */

    function initialNodeHGL(
        nodeId,
        nodeMap,
        records,
        settings
    ) {

        const bc =
            getNodeBoundary(
                nodeId
            );


        if (
            bc &&
            Number.isFinite(
                bc.hgl
            )
        ) {

            return bc.hgl;

        }


        if (
            bc &&
            Number.isFinite(
                bc.elevation
            )
        ) {

            return bc.elevation;

        }


        const node =
            nodeMap.get(
                nodeId
            );


        const existing =
            firstNumber(
                node,
                [
                    "HGL",
                    "hgl",
                    "hydraulicGrade",
                    "waterSurface",
                    "waterElevation"
                ],
                NaN
            );


        if (
            Number.isFinite(
                existing
            )
        ) {

            return existing;

        }


        /*
         * 找到流入此節點的最後一支管段。
         */

        const candidates =
            records.filter(
                p =>
                    p.to === nodeId
            );


        if (
            candidates.length > 0
        ) {

            const p =
                candidates[
                    candidates.length - 1
                ];


            if (
                Number.isFinite(
                    p.downstreamInvert
                ) &&
                p.depth >= 0
            ) {

                return (
                    p.downstreamInvert +
                    p.depth
                );

            }

        }


        /*
         * 若有 node invert + boundary depth。
         */

        const invert =
            nodeInvert(
                node
            );


        if (
            Number.isFinite(
                invert
            ) &&
            bc &&
            Number.isFinite(
                bc.depth
            )
        ) {

            return (
                invert +
                bc.depth
            );

        }


        return NaN;

    }


    /* ============================================================
     * Establish outlet HGL
     * ============================================================ */

    function establishOutletHGL(
        records,
        nodeMap,
        network,
        settings,
        nodeHGL
    ) {

        const outlets =
            findOutletNodes(
                network
            );


        /*
         * 若沒有 outlet，
         * 代表 network 可能是循環網路。
         */

        for (
            const outlet of outlets
        ) {

            let hgl =
                initialNodeHGL(
                    outlet,
                    nodeMap,
                    records,
                    settings
                );


            /*
             * 最後 fallback：
             *
             * invert + solved depth
             */

            if (
                !Number.isFinite(
                    hgl
                )
            ) {

                const candidates =
                    records.filter(
                        p =>
                            p.to === outlet
                    );


                if (
                    candidates.length
                ) {

                    const p =
                        candidates[
                            candidates.length - 1
                        ];


                    if (
                        Number.isFinite(
                            p.downstreamInvert
                        ) &&
                        settings.useSolvedDepthAsFallback
                    ) {

                        hgl =
                            p.downstreamInvert +
                            p.depth;

                    }

                }

            }


            if (
                Number.isFinite(
                    hgl
                )
            ) {

                nodeHGL.set(
                    outlet,
                    hgl
                );

            }

        }


        /*
         * 如果使用者提供全域 outlet HGL，
         * 套用到沒有明確值的出口。
         */

        const bc =
            getBoundaryConditions();


        const globalHGL =
            firstNumber(
                bc,
                [
                    "downstreamHGL",
                    "outletHGL",
                    "waterLevel",
                    "waterElevation"
                ],
                NaN
            );


        if (
            Number.isFinite(
                globalHGL
            )
        ) {

            for (
                const outlet of outlets
            ) {

                if (
                    !Number.isFinite(
                        nodeHGL.get(
                            outlet
                        )
                    )
                ) {

                    nodeHGL.set(
                        outlet,
                        globalHGL
                    );

                }

            }

        }

    }


    /* ============================================================
     * Backwater / energy propagation
     *
     * Downstream -> upstream
     *
     * EGL_up =
     *     EGL_down
     *     + hf
     *     + hm
     *
     * HGL =
     *     EGL - V²/2g
     *
     * 為避免 branch 匯流造成不合理重複計算：
     *
     * downstream HGL 已知時，
     * upstream HGL 由該 pipe 反算。
     *
     * 多支管匯流：
     *     取 downstream node HGL
     *     並依各 incoming pipe loss 回推。
     *
     * ============================================================ */

    function propagateBackwater(
        records,
        network,
        nodeHGL,
        settings
    ) {

        if (
            !settings.propagateBackwater
        ) {

            return;

        }


        const maxIterations =
            Math.max(
                20,
                records.length *
                5
            );


        for (
            let iteration = 0;
            iteration < maxIterations;
            iteration++
        ) {

            let changed =
                false;


            /*
             * 從下游節點往上游。
             */

            for (
                const pipe of records
            ) {

                if (
                    !Number.isFinite(
                        nodeHGL.get(
                            pipe.to
                        )
                    )
                ) {

                    continue;

                }


                const downstreamHGL =
                    nodeHGL.get(
                        pipe.to
                    );


                /*
                 * 下游 EGL
                 */

                const downstreamVelocityHead =
                    settings.includeVelocityHead
                        ? pipe.velocityHead
                        : 0;


                const downstreamEGL =
                    downstreamHGL +
                    downstreamVelocityHead;


                /*
                 * upstream EGL
                 */

                const upstreamEGL =
                    downstreamEGL +
                    pipe.totalLoss;


                /*
                 * upstream HGL
                 */

                const upstreamVelocityHead =
                    settings.includeVelocityHead
                        ? pipe.velocityHead
                        : 0;


                const upstreamHGL =
                    upstreamEGL -
                    upstreamVelocityHead;


                if (
                    !Number.isFinite(
                        nodeHGL.get(
                            pipe.from
                        )
                    )
                ) {

                    nodeHGL.set(
                        pipe.from,
                        upstreamHGL
                    );


                    changed =
                        true;

                } else {

                    /*
                     * 多支管時，
                     * 取較高 energy requirement。
                     */

                    const existing =
                        nodeHGL.get(
                            pipe.from
                        );


                    if (
                        upstreamHGL >
                        existing
                    ) {

                        /*
                         * 避免數值微小擾動造成
                         * 無止境迭代。
                         */

                        if (
                            Math.abs(
                                upstreamHGL -
                                existing
                            ) >
                            1e-8
                        ) {

                            nodeHGL.set(
                                pipe.from,
                                upstreamHGL
                            );


                            changed =
                                true;

                        }

                    }

                }

            }


            if (
                !changed
            ) {

                break;

            }

        }

    }


    /* ============================================================
     * Apply HGL to pipe
     * ============================================================ */

    function applyHGL(
        records,
        nodeHGL,
        settings
    ) {

        for (
            const p of records
        ) {

            const upHGL =
                nodeHGL.get(
                    p.from
                );


            const downHGL =
                nodeHGL.get(
                    p.to
                );


            p.upstreamHGL =
                Number.isFinite(
                    upHGL
                )
                    ? upHGL
                    : NaN;


            p.downstreamHGL =
                Number.isFinite(
                    downHGL
                )
                    ? downHGL
                    : NaN;


            /*
             * Water surface elevation
             *
             * HGL 在開放渠道／非滿流時，
             * 可視為水面高程。
             *
             * 壓力流時需依壓力水頭定義解讀。
             */

            p.upstreamWaterSurface =
                Number.isFinite(
                    p.upstreamInvert
                ) &&
                p.depth >= 0
                    ? p.upstreamInvert +
                      p.depth
                    : p.upstreamHGL;


            p.downstreamWaterSurface =
                Number.isFinite(
                    p.downstreamInvert
                ) &&
                p.depth >= 0
                    ? p.downstreamInvert +
                      p.depth
                    : p.downstreamHGL;


            /*
             * EGL
             */

            p.upstreamEGL =
                Number.isFinite(
                    p.upstreamHGL
                )
                    ? p.upstreamHGL +
                      (
                          settings.includeVelocityHead
                              ? p.velocityHead
                              : 0
                      )
                    : NaN;


            p.downstreamEGL =
                Number.isFinite(
                    p.downstreamHGL
                )
                    ? p.downstreamHGL +
                      (
                          settings.includeVelocityHead
                              ? p.velocityHead
                              : 0
                      )
                    : NaN;


            /*
             * 回水水頭
             *
             * 定義為：
             *
             * calculated HGL
             * - local invert based normal water level
             */

            const localUpNormal =
                Number.isFinite(
                    p.upstreamInvert
                )
                    ? p.upstreamInvert +
                      p.depth
                    : NaN;


            const localDownNormal =
                Number.isFinite(
                    p.downstreamInvert
                )
                    ? p.downstreamInvert +
                      p.depth
                    : NaN;


            p.upstreamBackwater =
                Number.isFinite(
                    p.upstreamHGL
                ) &&
                Number.isFinite(
                    localUpNormal
                )
                    ? p.upstreamHGL -
                      localUpNormal
                    : 0;


            p.downstreamBackwater =
                Number.isFinite(
                    p.downstreamHGL
                ) &&
                Number.isFinite(
                    localDownNormal
                )
                    ? p.downstreamHGL -
                      localDownNormal
                    : 0;

        }

    }


    /* ============================================================
     * Build longitudinal profile
     *
     * 每一管段：
     *
     * station 0       station L
     *
     * upstream        downstream
     *
     * 建立：
     *   invert
     *   HGL
     *   EGL
     *   water surface
     *
     * ============================================================ */

    function buildProfile(
        records,
        network
    ) {

        const profile =
            [];


        /*
         * 尋找沒有 incoming pipe 的 upstream source。
         */

        const sources =
            [];


        for (
            const nodeId of
            network.nodes
        ) {

            const incoming =
                network.incoming.get(
                    nodeId
                ) || [];


            if (
                incoming.length === 0
            ) {

                sources.push(
                    nodeId
                );

            }

        }


        /*
         * 如果網路沒有 source，
         * 從第一支管開始。
         */

        if (
            sources.length === 0 &&
            records.length > 0
        ) {

            sources.push(
                records[0].from
            );

        }


        /*
         * 對每一個 source 建立 path。
         */

        const visited =
            new Set();


        for (
            const source of sources
        ) {

            const queue = [

                {
                    node:
                        source,

                    station:
                        0,

                    path:
                        []

                }

            ];


            while (
                queue.length
            ) {

                const state =
                    queue.shift();


                const outgoing =
                    network.outgoing.get(
                        state.node
                    ) || [];


                /*
                 * 沒有 outgoing：
                 * 將節點作為終點。
                 */

                if (
                    outgoing.length === 0
                ) {

                    continue;

                }


                for (
                    const pipe of outgoing
                ) {

                    /*
                     * branch path key
                     */

                    const key =
                        (
                            state.node +
                            "->" +
                            pipe.to +
                            ":" +
                            pipe.id
                        );


                    if (
                        visited.has(
                            key
                        )
                    ) {

                        continue;

                    }


                    visited.add(
                        key
                    );


                    const startStation =
                        state.station;


                    const endStation =
                        startStation +
                        pipe.length;


                    const nodeUpHGL =
                        pipe.upstreamHGL;


                    const nodeDownHGL =
                        pipe.downstreamHGL;


                    /*
                     * 管底線
                     */

                    profile.push({

                        path:
                            state.path
                                .concat(
                                    pipe.id
                                )
                                .join(
                                    " > "
                                ),

                        pipeId:
                            pipe.id,

                        nodeId:
                            pipe.from,

                        station:
                            startStation,

                        type:
                            "upstream",

                        invert:
                            pipe.upstreamInvert,

                        HGL:
                            nodeUpHGL,

                        EGL:
                            pipe.upstreamEGL,

                        waterSurface:
                            pipe.upstreamWaterSurface,

                        depth:
                            pipe.depth,

                        velocity:
                            pipe.velocity,

                        Q:
                            pipe.Q

                    });


                    profile.push({

                        path:
                            state.path
                                .concat(
                                    pipe.id
                                )
                                .join(
                                    " > "
                                ),

                        pipeId:
                            pipe.id,

                        nodeId:
                            pipe.to,

                        station:
                            endStation,

                        type:
                            "downstream",

                        invert:
                            pipe.downstreamInvert,

                        HGL:
                            nodeDownHGL,

                        EGL:
                            pipe.downstreamEGL,

                        waterSurface:
                            pipe.downstreamWaterSurface,

                        depth:
                            pipe.depth,

                        velocity:
                            pipe.velocity,

                        Q:
                            pipe.Q

                    });


                    queue.push({

                        node:
                            pipe.to,

                        station:
                            endStation,

                        path:
                            state.path
                                .concat(
                                    pipe.id
                                )

                    });

                }

            }

        }


        /*
         * 若沒有建立 path，
         * 直接依 pipeResults 建立。
         */

        if (
            profile.length === 0
        ) {

            let station =
                0;


            for (
                const pipe of records
            ) {

                profile.push({

                    path:
                        pipe.id,

                    pipeId:
                        pipe.id,

                    nodeId:
                        pipe.from,

                    station,

                    type:
                        "upstream",

                    invert:
                        pipe.upstreamInvert,

                    HGL:
                        pipe.upstreamHGL,

                    EGL:
                        pipe.upstreamEGL,

                    waterSurface:
                        pipe.upstreamWaterSurface,

                    depth:
                        pipe.depth,

                    velocity:
                        pipe.velocity,

                    Q:
                        pipe.Q

                });


                station +=
                    pipe.length;


                profile.push({

                    path:
                        pipe.id,

                    pipeId:
                        pipe.id,

                    nodeId:
                        pipe.to,

                    station,

                    type:
                        "downstream",

                    invert:
                        pipe.downstreamInvert,

                    HGL:
                        pipe.downstreamHGL,

                    EGL:
                        pipe.downstreamEGL,

                    waterSurface:
                        pipe.downstreamWaterSurface,

                    depth:
                        pipe.depth,

                    velocity:
                        pipe.velocity,

                    Q:
                        pipe.Q

                });

            }

        }


        return profile;

    }


    /* ============================================================
     * Calculate
     * ============================================================ */

    function calculate(
        userSettings = {}
    ) {

        const settings =
            {
                ...DEFAULTS,
                ...userSettings
            };


        const solution =
            window.v3HydraulicSolution;


        if (
            !solution
        ) {

            throw new Error(
                "找不到 window.v3HydraulicSolution。請先執行 hydraulic.js。"
            );

        }


        const pipeResults =
            getPipeResults();


        if (
            pipeResults.length === 0
        ) {

            throw new Error(
                "window.v3HydraulicSolution.pipeResults 為空，沒有可供 HGL/EGL 分析的管段成果。"
            );

        }


        const pipes =
            getPipes();


        const nodes =
            getNodes();


        const pipeMap =
            buildPipeDictionary(
                pipeResults,
                pipes
            );


        const nodeMap =
            buildNodeDictionary(
                nodes
            );


        const records =
            [];


        /*
         * 以 pipeResults 為主。
         */

        for (
            const result of pipeResults
        ) {

            const id =
                idOf(
                    result,
                    [
                        "pipeId",
                        "id",
                        "pipe",
                        "name",
                        "code"
                    ]
                );


            const original =
                id
                    ? pipeMap.get(id)
                    : result;


            const record =
                calculatePipeRecord(
                    original || result,
                    result,
                    nodeMap,
                    settings
                );


            if (
                !record.id
            ) {

                record.id =
                    id ||
                    `PIPE_${records.length + 1}`;

            }


            records.push(
                record
            );

        }


        const network =
            buildNetwork(
                records
            );


        const nodeHGL =
            new Map();


        /*
         * 第一階段：
         * 尋找已知節點 HGL。
         */

        for (
            const nodeId of
            network.nodes
        ) {

            const hgl =
                initialNodeHGL(
                    nodeId,
                    nodeMap,
                    records,
                    settings
                );


            if (
                Number.isFinite(
                    hgl
                )
            ) {

                nodeHGL.set(
                    nodeId,
                    hgl
                );

            }

        }


        /*
         * 第二階段：
         * outlet boundary。
         */

        establishOutletHGL(
            records,
            nodeMap,
            network,
            settings,
            nodeHGL
        );


        /*
         * 第三階段：
         * 下游 → 上游回水傳遞。
         */

        propagateBackwater(
            records,
            network,
            nodeHGL,
            settings
        );


        /*
         * 第四階段：
         * 寫回 pipe。
         */

        applyHGL(
            records,
            nodeHGL,
            settings
        );


        /*
         * 第五階段：
         * 縱剖面。
         */

        const profile =
            buildProfile(
                records,
                network
            );


        /*
         * Statistics
         */

        const maxHGL =
            Math.max(
                ...records
                    .map(
                        p =>
                            Number.isFinite(
                                p.upstreamHGL
                            )
                                ? p.upstreamHGL
                                : -Infinity
                    )
                    .filter(
                        Number.isFinite
                    ),
                -Infinity
            );


        const minInvert =
            Math.min(
                ...records
                    .flatMap(
                        p => [
                            p.upstreamInvert,
                            p.downstreamInvert
                        ]
                    )
                    .filter(
                        Number.isFinite
                    ),
                Infinity
            );


        const maxEGL =
            Math.max(
                ...records
                    .flatMap(
                        p => [
                            p.upstreamEGL,
                            p.downstreamEGL
                        ]
                    )
                    .filter(
                        Number.isFinite
                    ),
                -Infinity
            );


        const result = {

            records,

            pipeResults:
                records,

            profile,

            nodeHGL,

            statistics: {

                pipeCount:
                    records.length,

                nodeCount:
                    network.nodes.size,

                maxHGL,

                minInvert,

                maxEGL,

                maxBackwater:
                    Math.max(
                        ...records.map(
                            p =>
                                Math.max(
                                    p.upstreamBackwater,
                                    p.downstreamBackwater
                                )
                        ),
                        0
                    )

            },

            settings,

            model:
                "V3 steady-state energy / HGL-EGL post-processing",

            note:
                "HGL/EGL includes Manning friction and optional local losses. Downstream-to-upstream propagation is a steady energy-line backwater calculation, not a full Saint-Venant dynamic-wave or GVF standard-step solver."

        };


        /*
         * Global result
         */

        window.v3HglEglSolution =
            result;


        return result;

    }


    /* ============================================================
     * Chart
     * ============================================================ */

    let profileChart =
        null;


    function drawProfile(
        result,
        canvasOrId
    ) {

        if (
            !result
        ) {

            result =
                window.v3HglEglSolution;

        }


        if (
            !result
        ) {

            throw new Error(
                "尚未建立 HGL/EGL 分析成果。"
            );

        }


        const target =
            typeof canvasOrId === "string"
                ? document.getElementById(
                    canvasOrId
                )
                : canvasOrId;


        if (
            !target
        ) {

            throw new Error(
                "找不到 HGL/EGL Chart Canvas。"
            );

        }


        /*
         * 若 target 是 div，
         * 自動建立 canvas。
         */

        let canvas =
            target;


        if (
            target.tagName !==
            "CANVAS"
        ) {

            target.innerHTML =
                "";


            canvas =
                document.createElement(
                    "canvas"
                );


            canvas.style.width =
                "100%";


            canvas.style.height =
                "430px";


            target.appendChild(
                canvas
            );

        }


        if (
            typeof Chart ===
            "undefined"
        ) {

            throw new Error(
                "找不到 Chart.js。請確認 index.html 已載入 Chart.js。"
            );

        }


        if (
            profileChart
        ) {

            profileChart.destroy();

        }


        const profile =
            result.profile;


        const labels =
            profile.map(
                p =>
                    Number(
                        p.station
                    ).toFixed(1)
            );


        const invert =
            profile.map(
                p =>
                    Number.isFinite(
                        p.invert
                    )
                        ? p.invert
                        : null
            );


        const hgl =
            profile.map(
                p =>
                    Number.isFinite(
                        p.HGL
                    )
                        ? p.HGL
                        : null
            );


        const egl =
            profile.map(
                p =>
                    Number.isFinite(
                        p.EGL
                    )
                        ? p.EGL
                        : null
            );


        const waterSurface =
            profile.map(
                p =>
                    Number.isFinite(
                        p.waterSurface
                    )
                        ? p.waterSurface
                        : null
            );


        const datasets = [

            {

                label:
                    "管底高程",

                data:
                    invert,

                borderColor:
                    "#6c757d",

                backgroundColor:
                    "rgba(108,117,125,0.10)",

                borderWidth:
                    2,

                pointRadius:
                    2,

                tension:
                    0

            },


            {

                label:
                    "HGL 水力坡線",

                data:
                    hgl,

                borderColor:
                    "#0d6efd",

                backgroundColor:
                    "rgba(13,110,253,0.10)",

                borderWidth:
                    3,

                pointRadius:
                    3,

                tension:
                    0.1

            },


            {

                label:
                    "EGL 能量線",

                data:
                    egl,

                borderColor:
                    "#dc3545",

                backgroundColor:
                    "rgba(220,53,69,0.08)",

                borderWidth:
                    2,

                borderDash:
                    [
                        7,
                        5
                    ],

                pointRadius:
                    2,

                tension:
                    0.1

            },


            {

                label:
                    "水面線",

                data:
                    waterSurface,

                borderColor:
                    "#20c997",

                backgroundColor:
                    "rgba(32,201,151,0.08)",

                borderWidth:
                    2,

                borderDash:
                    [
                        3,
                        3
                    ],

                pointRadius:
                    2,

                tension:
                    0.1

            }

        ];


        profileChart =
            new Chart(
                canvas,
                {

                    type:
                        "line",

                    data: {

                        labels,

                        datasets

                    },

                    options: {

                        responsive:
                            true,

                        maintainAspectRatio:
                            false,

                        interaction: {

                            mode:
                                "index",

                            intersect:
                                false

                        },

                        plugins: {

                            title: {

                                display:
                                    true,

                                text:
                                    "雨水下水道 HGL / EGL 縱剖面"

                            },

                            legend: {

                                position:
                                    "bottom"

                            },

                            tooltip: {

                                callbacks: {

                                    afterBody:
                                        function (
                                            context
                                        ) {

                                            const index =
                                                context[
                                                    0
                                                ].dataIndex;


                                            const p =
                                                profile[
                                                    index
                                                ];


                                            if (
                                                !p
                                            ) {

                                                return "";

                                            }


                                            return [

                                                `Node: ${p.nodeId || "-"}`,

                                                `Pipe: ${p.pipeId || "-"}`,

                                                `Q: ${Number(
                                                    p.Q || 0
                                                ).toFixed(4)} m³/s`,

                                                `V: ${Number(
                                                    p.velocity || 0
                                                ).toFixed(3)} m/s`,

                                                `Depth: ${Number(
                                                    p.depth || 0
                                                ).toFixed(3)} m`

                                            ];

                                        }

                                }

                            }

                        },

                        scales: {

                            x: {

                                title: {

                                    display:
                                        true,

                                    text:
                                        "沿程距離 Station (m)"

                                }

                            },

                            y: {

                                title: {

                                    display:
                                        true,

                                    text:
                                        "高程 / 水頭 (m)"

                                }

                            }

                        }

                    }

                }
            );


        return profileChart;

    }


    /* ============================================================
     * Public API
     * ============================================================ */

    window.V3HglEgl = {

        defaults:
            DEFAULTS,

        calculate,

        buildProfile,

        drawProfile,

        circularGeometry,

        calculateFrictionLoss,

        calculateLocalLoss,

        velocityHead,

        getPipeResults

    };


    /*
     * 相容舊程式命名
     */

    window.HGL_EGL =
        window.V3HglEgl;


})(window);
