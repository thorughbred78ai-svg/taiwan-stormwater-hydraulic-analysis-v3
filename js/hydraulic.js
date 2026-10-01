/*
 * ================================================================
 * hydraulic.js
 * 台灣雨水下水道數值水理分析 V3.1
 *
 * ------------------------------------------------
 * 核心：
 *
 *   節點連續方程
 *       ΣQin + Qlocal - ΣQout = 0
 *
 *   管段 Manning：
 *
 *       Q = (1/n) A R^(2/3) S_f^(1/2)
 *
 *   非滿流：
 *       y < D
 *
 *   滿管：
 *       y >= D
 *
 *   壓力 / surcharge：
 *       Q > Qfull 時進入滿管 / 超載狀態
 *
 *   匯流：
 *       多支 incoming pipes
 *       →
 *       同一節點
 *       →
 *       continuity balance
 *
 * ------------------------------------------------
 *
 * 本版本定位：
 *
 *   Steady / quasi-steady network solver
 *
 * 並非完整 Saint-Venant dynamic wave solver。
 *
 * V4 可進一步加入：
 *
 *   ∂A/∂t + ∂Q/∂x = q
 *   ∂Q/∂t + ∂(Q²/A)/∂x
 *       + gA ∂H/∂x
 *       = gA(S0-Sf)
 *
 * ------------------------------------------------
 *
 * 單位：
 *
 *   Q       m3/s
 *   length  m
 *   D       m
 *   y       m
 *   H       m
 *   V       m/s
 *   slope   dimensionless
 *
 * ================================================================
 */


/* ================================================================
 * 0. 全域設定
 * ================================================================ */

const V3_HYDRAULIC_CONFIG = {

    g:
        9.80665,

    defaultN:
        0.013,

    minimumDepth:
        0.0001,

    minimumSlope:
        0.000001,

    flowTolerance:
        0.00001,

    nodeBalanceTolerance:
        0.0001,

    headTolerance:
        0.001,

    maxNetworkIterations:
        500,

    maxDepthIterations:
        100,

    relaxation:
        0.55,

    headRelaxation:
        0.45,

    maxFlowChange:
        0.02,

    fullPipeRatio:
        0.98,

    surchargeTolerance:
        0.001
};


/* ================================================================
 * 1. 基本工具
 * ================================================================ */

function hydNum(
    value,
    fallback = 0
) {

    const n =
        Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}


function hydFinite(
    value
) {

    return Number.isFinite(
        Number(value)
    );
}


function hydClamp(
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


function hydSign(
    value
) {

    return value >= 0
        ? 1
        : -1;
}


/* ================================================================
 * 2. 管段幾何
 * ================================================================ */

/**
 * 圓管面積
 */
function circularArea(
    diameter
) {

    const D =
        hydNum(
            diameter
        );

    if (D <= 0) {
        return 0;
    }

    return (
        Math.PI *
        D *
        D /
        4
    );
}


/**
 * 圓管滿管周長
 */
function circularFullPerimeter(
    diameter
) {

    const D =
        hydNum(
            diameter
        );

    return D > 0
        ? Math.PI * D
        : 0;
}


/**
 * 圓管部分充滿幾何
 *
 * y < D
 */
function circularGeometry(
    depth,
    diameter
) {

    const D =
        hydNum(
            diameter
        );

    if (D <= 0) {

        return {

            area: 0,

            perimeter: 0,

            hydraulicRadius: 0,

            topWidth: 0,

            depth: 0,

            full: false
        };
    }


    const y =
        hydClamp(
            hydNum(depth),
            0,
            D
        );


    /*
     * 空管
     */

    if (y <= 0) {

        return {

            area: 0,

            perimeter: 0,

            hydraulicRadius: 0,

            topWidth: 0,

            depth: 0,

            full: false
        };
    }


    /*
     * 滿管
     */

    if (
        y >= D
    ) {

        const A =
            circularArea(D);

        const P =
            circularFullPerimeter(D);

        return {

            area:
                A,

            perimeter:
                P,

            hydraulicRadius:
                A / P,

            topWidth:
                D,

            depth:
                D,

            full:
                true
        };
    }


    const R =
        D / 2;


    /*
     * 中心角：
     *
     * theta =
     * 2 acos(1 - y/R)
     */

    const theta =
        2 *
        Math.acos(
            hydClamp(
                1 -
                y / R,
                -1,
                1
            )
        );


    /*
     * 面積
     */

    const A =
        (
            R * R /
            2
        ) *
        (
            theta -
            Math.sin(theta)
        );


    /*
     * 濕周
     */

    const P =
        R * theta;


    /*
     * 水面寬
     */

    const T =
        2 *
        Math.sqrt(
            Math.max(
                0,
                R * R -
                Math.pow(
                    R - y,
                    2
                )
            )
        );


    return {

        area:
            A,

        perimeter:
            P,

        hydraulicRadius:
            P > 0
                ? A / P
                : 0,

        topWidth:
            T,

        depth:
            y,

        full:
            false
    };
}


/* ================================================================
 * 3. Manning
 * ================================================================ */

/**
 * Manning：
 *
 * Q = 1/n A R^(2/3) S^(1/2)
 */
function manningQ(
    area,
    hydraulicRadius,
    slope,
    n
) {

    const A =
        hydNum(area);

    const R =
        hydNum(
            hydraulicRadius
        );

    const S =
        hydNum(slope);

    const N =
        hydNum(
            n,
            V3_HYDRAULIC_CONFIG.defaultN
        );


    if (
        A <= 0 ||
        R <= 0 ||
        S <= 0 ||
        N <= 0
    ) {

        return 0;
    }


    return (
        1 / N *
        A *
        Math.pow(
            R,
            2 / 3
        ) *
        Math.sqrt(S)
    );
}


/**
 * Manning velocity
 */
function manningVelocity(
    Q,
    area
) {

    const A =
        hydNum(area);

    if (A <= 0) {
        return 0;
    }

    return (
        Q / A
    );
}


/**
 * 滿管容量
 */
function fullPipeCapacity(
    pipe
) {

    const D =
        getPipeDiameter(
            pipe
        );

    const S =
        getPipeSlope(
            pipe
        );

    const n =
        getPipeManningN(
            pipe
        );


    const A =
        circularArea(D);

    const R =
        D / 4;


    return manningQ(
        A,
        R,
        S,
        n
    );
}


/* ================================================================
 * 4. 管段資料取得
 * ================================================================ */

function getPipeDiameter(
    pipe
) {

    return hydNum(
        pipe?.diameter ??
        pipe?.D ??
        pipe?.pipeDiameter
    );
}


function getPipeLength(
    pipe
) {

    return hydNum(
        pipe?.length ??
        pipe?.L
    );
}


function getPipeSlope(
    pipe
) {

    let S =
        hydNum(
            pipe?.slope ??
            pipe?.S
        );


    /*
     * 如果沒有直接輸入坡度，
     * 嘗試由上下游管底反算。
     */

    if (
        S === 0 &&
        typeof nodes !==
        "undefined"
    ) {

        const from =
            findNodeById(
                pipe.from
            );

        const to =
            findNodeById(
                pipe.to
            );


        if (
            from &&
            to &&
            getPipeLength(pipe) > 0
        ) {

            S =
                (
                    hydNum(
                        from.invert
                    ) -
                    hydNum(
                        to.invert
                    )
                ) /
                getPipeLength(
                    pipe
                );
        }
    }


    return S;
}


function getPipeManningN(
    pipe
) {

    return hydNum(
        pipe?.n ??
        pipe?.manningN,
        V3_HYDRAULIC_CONFIG.defaultN
    );
}


function findNodeById(
    id
) {

    if (
        typeof nodes ===
        "undefined" ||
        !Array.isArray(nodes)
    ) {

        return null;
    }


    return nodes.find(
        node =>
            String(
                node.id
            ) ===
            String(id)
    ) || null;
}


function findPipeById(
    id
) {

    if (
        typeof pipes ===
        "undefined" ||
        !Array.isArray(pipes)
    ) {

        return null;
    }


    return pipes.find(
        pipe =>
            String(
                pipe.id
            ) ===
            String(id)
    ) || null;
}


/* ================================================================
 * 5. 正常水深
 * ================================================================ */

/**
 * 由 Q 求正常水深
 *
 * Q(y) = Qtarget
 */
function solveNormalDepth(
    Q,
    pipe
) {

    const targetQ =
        Math.abs(
            hydNum(Q)
        );


    const D =
        getPipeDiameter(
            pipe
        );

    const S =
        Math.abs(
            getPipeSlope(
                pipe
            )
        );

    const n =
        getPipeManningN(
            pipe
        );


    if (
        targetQ <=
        V3_HYDRAULIC_CONFIG.flowTolerance
    ) {

        return {

            depth:
                0,

            area:
                0,

            hydraulicRadius:
                0,

            topWidth:
                0,

            velocity:
                0,

            froude:
                0,

            regime:
                "dry",

            full:
                false,

            capacity:
                fullPipeCapacity(
                    pipe
                )
        };
    }


    if (
        D <= 0
    ) {

        return {

            depth:
                0,

            area:
                0,

            hydraulicRadius:
                0,

            topWidth:
                0,

            velocity:
                0,

            froude:
                0,

            regime:
                "invalid",

            full:
                false,

            capacity:
                0
        };
    }


    const Qfull =
        fullPipeCapacity(
            pipe
        );


    /*
     * ------------------------------------------------------------
     * 滿管切換
     * ------------------------------------------------------------
     */

    if (
        targetQ >=
        Qfull
    ) {

        const A =
            circularArea(
                D
            );


        const V =
            targetQ /
            A;


        return {

            depth:
                D,

            area:
                A,

            hydraulicRadius:
                D / 4,

            topWidth:
                D,

            velocity:
                V,

            froude:
                calculateFroude(
                    V,
                    A,
                    D
                ),

            regime:
                "full",

            full:
                true,

            surcharge:
                targetQ >
                Qfull,

            capacity:
                Qfull
        };
    }


    /*
     * ------------------------------------------------------------
     * 非滿流二分法
     * ------------------------------------------------------------
     */

    let low =
        V3_HYDRAULIC_CONFIG.minimumDepth;


    let high =
        D -
        V3_HYDRAULIC_CONFIG.minimumDepth;


    let mid =
        D * 0.5;


    for (
        let i = 0;
        i <
        V3_HYDRAULIC_CONFIG.maxDepthIterations;
        i++
    ) {

        mid =
            (
                low +
                high
            ) / 2;


        const geom =
            circularGeometry(
                mid,
                D
            );


        const q =
            manningQ(
                geom.area,
                geom.hydraulicRadius,
                S,
                n
            );


        if (
            Math.abs(
                q -
                targetQ
            ) <=
            V3_HYDRAULIC_CONFIG.flowTolerance
        ) {

            break;
        }


        if (
            q <
            targetQ
        ) {

            low =
                mid;

        } else {

            high =
                mid;
        }
    }


    const geom =
        circularGeometry(
            mid,
            D
        );


    const V =
        geom.area > 0
            ? targetQ /
              geom.area
            : 0;


    const Fr =
        calculateFroude(
            V,
            geom.area,
            geom.topWidth
        );


    return {

        depth:
            mid,

        area:
            geom.area,

        hydraulicRadius:
            geom.hydraulicRadius,

        topWidth:
            geom.topWidth,

        velocity:
            V,

        froude:
            Fr,

        regime:
            Fr < 1
                ? "subcritical"
                : Fr > 1
                    ? "supercritical"
                    : "critical",

        full:
            false,

        surcharge:
            false,

        capacity:
            Qfull
    };
}


/* ================================================================
 * 6. Froude
 * ================================================================ */

function calculateFroude(
    velocity,
    area,
    topWidth
) {

    const V =
        Math.abs(
            hydNum(velocity)
        );

    const A =
        hydNum(area);

    const T =
        hydNum(topWidth);


    if (
        A <= 0 ||
        T <= 0
    ) {

        return 0;
    }


    const hydraulicDepth =
        A / T;


    return (
        V /
        Math.sqrt(
            V3_HYDRAULIC_CONFIG.g *
            hydraulicDepth
        )
    );
}


/* ================================================================
 * 7. 單一管段 hydraulic state
 * ================================================================ */

function calculatePipeHydraulics(
    pipe,
    Q
) {

    const flow =
        hydNum(Q);


    const depth =
        solveNormalDepth(
            flow,
            pipe
        );


    const result = {

        pipeId:
            pipe.id,

        from:
            pipe.from,

        to:
            pipe.to,

        Q:
            flow,

        Qabs:
            Math.abs(flow),

        direction:
            hydSign(flow),

        length:
            getPipeLength(
                pipe
            ),

        diameter:
            getPipeDiameter(
                pipe
            ),

        slope:
            getPipeSlope(
                pipe
            ),

        n:
            getPipeManningN(
                pipe
            ),

        depth:
            depth.depth,

        area:
            depth.area,

        hydraulicRadius:
            depth.hydraulicRadius,

        topWidth:
            depth.topWidth,

        velocity:
            depth.velocity,

        froude:
            depth.froude,

        regime:
            depth.regime,

        full:
            depth.full,

        surcharge:
            depth.surcharge || false,

        Qfull:
            depth.capacity
    };


    return result;
}


/* ================================================================
 * 8. 節點外加流量
 * ================================================================ */

function getNodeExternalInflow(
    node
) {

    if (!node) {
        return 0;
    }


    /*
     * 支援多種欄位名稱
     */

    const candidates = [

        node.inflow,

        node.externalInflow,

        node.localInflow,

        node.runoff,

        node.designFlow,

        node.Qin,

        node.Q
    ];


    for (
        const value of candidates
    ) {

        if (
            hydFinite(value)
        ) {

            return hydNum(value);
        }
    }


    return 0;
}


/* ================================================================
 * 9. 節點出流 / 入流
 * ================================================================ */

function getIncomingPipes(
    nodeId
) {

    return pipes.filter(
        pipe =>
            String(
                pipe.to
            ) ===
            String(nodeId)
    );
}


function getOutgoingPipes(
    nodeId
) {

    return pipes.filter(
        pipe =>
            String(
                pipe.from
            ) ===
            String(nodeId)
    );
}


/* ================================================================
 * 10. 節點連續方程
 *
 *     Σ Qin + Qlocal - Σ Qout = residual
 * ================================================================ */

function calculateNodeContinuity(
    nodeId,
    flowState
) {

    const node =
        findNodeById(
            nodeId
        );


    const incoming =
        getIncomingPipes(
            nodeId
        );


    const outgoing =
        getOutgoingPipes(
            nodeId
        );


    let Qin =
        0;


    let Qout =
        0;


    incoming.forEach(
        pipe => {

            const Q =
                hydNum(
                    flowState[
                        pipe.id
                    ]
            );


            Qin +=
                Math.max(
                    0,
                    Q
                );
        }
    );


    outgoing.forEach(
        pipe => {

            const Q =
                hydNum(
                    flowState[
                        pipe.id
                    ]
                );


            Qout +=
                Math.max(
                    0,
                    Q
                );
        }
    );


    const Qlocal =
        getNodeExternalInflow(
            node
        );

    /*
     * [FIX] 出口節點（無 outgoing pipe）：
     * 水流離開系統，Qout 視為 Qin + Qlocal，
     * 否則出口節點永遠被判定為不平衡。
     */
    if (
        outgoing.length === 0
    ) {

        Qout =
            Qin +
            Math.max(0, Qlocal);
    }



    const residual =
        Qin +
        Qlocal -
        Qout;


    return {

        nodeId,

        Qin,

        Qout,

        Qlocal,

        residual,

        balanced:
            Math.abs(
                residual
            ) <=
            V3_HYDRAULIC_CONFIG
                .nodeBalanceTolerance
    };
}


/* ================================================================
 * 11. 拓樸排序
 * ================================================================ */

function calculateNodeTopology() {

    const result =
        [];


    const visited =
        new Set();


    function visit(
        nodeId
    ) {

        const id =
            String(
                nodeId
            );


        if (
            visited.has(id)
        ) {

            return;
        }


        visited.add(id);


        getOutgoingPipes(
            nodeId
        ).forEach(
            pipe => {

                visit(
                    pipe.to
                );
            }
        );


        result.push(
            nodeId
        );
    }


    nodes.forEach(
        node => {

            visit(
                node.id
            );
        }
    );


    /*
     * result 是 downstream-first。
     * reverse 後為 upstream-first。
     */

    return result.reverse();
}


/* ================================================================
 * 12. 找根節點 / 入流節點
 * ================================================================ */

function findNetworkSources() {

    return nodes.filter(
        node =>
            getIncomingPipes(
                node.id
            ).length === 0
    );
}


function findNetworkOutfalls() {

    return nodes.filter(
        node =>
            getOutgoingPipes(
                node.id
            ).length === 0
    );
}


/* ================================================================
 * 13. 初始流量分配
 * ================================================================ */

function initializeFlowState() {

    const state =
        {};


    pipes.forEach(
        pipe => {

            let Q =
                hydNum(
                    pipe.Q ??
                    pipe.flow ??
                    pipe.designFlow
                );


            /*
             * 若管段沒有 Q，
             * 先設 0，後續由節點平衡調整。
             */

            if (
                !hydFinite(Q)
            ) {

                Q =
                    0;
            }


            state[
                pipe.id
            ] =
                Q;
        }
    );


    /* [FIX] 依拓樸順序累加，保留中間節點外部入流 */

    accumulateFlowTopological(
        state
    );


    return state;
}



/* ================================================================
 * 13b. [FIX] 依拓樸順序累加流量
 *
 * 節點可用流量 = 節點外部入流 + 所有上游管段流量，
 * 再依管段輸水能力（或指定流量）分配到下游管段。
 * 舊版只從來源節點分配，中間節點的外部入流會被覆蓋。
 * ================================================================ */

function accumulateFlowTopological(flowState) {

    const indegree = {};

    nodes.forEach(node => {
        indegree[node.id] = getIncomingPipes(node.id).length;
    });

    const queue = nodes
        .filter(node => indegree[node.id] === 0)
        .map(node => node.id);

    const order = [];
    const seen = new Set();

    while (queue.length > 0) {

        const id = queue.shift();

        if (seen.has(id)) { continue; }

        seen.add(id);
        order.push(id);

        getOutgoingPipes(id).forEach(pipe => {
            indegree[pipe.to]--;
            if (indegree[pipe.to] <= 0) { queue.push(pipe.to); }
        });
    }

    /* 迴圈（非 DAG）剩餘節點也處理，避免漏算 */
    nodes.forEach(node => {
        if (!seen.has(node.id)) { order.push(node.id); }
    });

    const specifiedQ = pipe =>
        pipe.designFlow ?? pipe.Q ?? pipe.flow;

    order.forEach(nodeId => {

        const node = findNodeById(nodeId);

        let available = Math.max(0, getNodeExternalInflow(node));

        getIncomingPipes(nodeId).forEach(pipe => {
            available += Math.max(0, hydNum(flowState[pipe.id]));
        });

        const outgoing = getOutgoingPipes(nodeId);

        if (outgoing.length === 0) { return; }

        const specified = outgoing.filter(pipe =>
            hydFinite(specifiedQ(pipe)) && hydNum(specifiedQ(pipe)) > 0
        );

        if (specified.length === outgoing.length) {

            const total = specified.reduce(
                (s, p) => s + hydNum(specifiedQ(p)), 0
            );

            const ratio =
                total > available && total > 0 ? available / total : 1;

            outgoing.forEach(pipe => {
                flowState[pipe.id] = hydNum(specifiedQ(pipe)) * ratio;
            });

            return;
        }

        const capacities = outgoing.map(pipe => ({
            pipe,
            capacity: Math.max(fullPipeCapacity(pipe), 0.000001)
        }));

        const capacityTotal = capacities.reduce((s, c) => s + c.capacity, 0);

        capacities.forEach(c => {
            flowState[c.pipe.id] =
                capacityTotal > 0
                    ? available * c.capacity / capacityTotal
                    : available / outgoing.length;
        });
    });

    return flowState;
}


/* ================================================================
 * 14. 下游流量分配
 *
 * 匯流系統的基本流量守恆：
 *
 * node Q =
 * local inflow +
 * incoming flow
 *
 * 若有多個 outgoing pipes：
 *
 * 依管段輸水能力比例分配。
 * ================================================================ */

function distributeFlowDownstream(
    startNodeId,
    initialFlow,
    flowState
) {

    const queue =
        [];


    queue.push({

        nodeId:
            startNodeId,

        flow:
            initialFlow
    });


    const visited =
        new Set();


    while (
        queue.length > 0
    ) {

        const item =
            queue.shift();


        const nodeId =
            item.nodeId;


        const availableQ =
            Math.max(
                0,
                hydNum(
                    item.flow
                )
            );


        const outgoing =
            getOutgoingPipes(
                nodeId
            );


        if (
            outgoing.length === 0
        ) {

            continue;
        }


        /*
         * 若使用者已指定各管段設計流量，
         * 優先保留。
         */

        const specified =
            outgoing.filter(
                pipe =>
                    hydFinite(
                        pipe.designFlow ??
                        pipe.Q ??
                        pipe.flow
                    )
            );


        if (
            specified.length ===
            outgoing.length
        ) {

            let specifiedTotal =
                specified.reduce(
                    (
                        sum,
                        pipe
                    ) =>
                        sum +
                        Math.max(
                            0,
                            hydNum(
                                pipe.designFlow ??
                                pipe.Q ??
                                pipe.flow
                            )
                        ),
                    0
                );


            /*
             * 若指定流量超過可用流量，
             * 按比例縮放。
             */

            const ratio =
                specifiedTotal >
                availableQ &&
                specifiedTotal > 0
                    ? availableQ /
                      specifiedTotal
                    : 1;


            outgoing.forEach(
                pipe => {

                    const base =
                        Math.max(
                            0,
                            hydNum(
                                pipe.designFlow ??
                                pipe.Q ??
                                pipe.flow
                            )
                        );


                    const q =
                        base *
                        ratio;


                    flowState[
                        pipe.id
                    ] =
                        q;


                    queue.push({

                        nodeId:
                            pipe.to,

                        flow:
                            q
                    });
                }
            );


            continue;
        }


        /*
         * 沒有完整指定時：
         *
         * 依目前管段滿管能力比例分配。
         */

        const capacities =
            outgoing.map(
                pipe => ({

                    pipe,

                    capacity:
                        Math.max(
                            fullPipeCapacity(
                                pipe
                            ),
                            0.000001
                        )
                })
            );


        const capacityTotal =
            capacities.reduce(
                (
                    sum,
                    item
                ) =>
                    sum +
                    item.capacity,
                0
            );


        capacities.forEach(
            item => {

                const q =
                    capacityTotal > 0
                        ? availableQ *
                          (
                              item.capacity /
                              capacityTotal
                          )
                        : availableQ /
                          outgoing.length;


                flowState[
                    item.pipe.id
                ] =
                    q;


                queue.push({

                    nodeId:
                        item.pipe.to,

                    flow:
                        q
                });
            }
        );
    }
}


/* ================================================================
 * 15. 匯流節點流量
 * ================================================================ */

function calculateNodeAvailableFlow(
    nodeId,
    flowState
) {

    const node =
        findNodeById(
            nodeId
        );


    const incoming =
        getIncomingPipes(
            nodeId
        );


    let incomingQ =
        0;


    incoming.forEach(
        pipe => {

            incomingQ +=
                Math.max(
                    0,
                    hydNum(
                        flowState[
                            pipe.id
                        ]
                    )
                );
        }
    );


    return (
        incomingQ +
        getNodeExternalInflow(
            node
        )
    );
}


/* ================================================================
 * 16. 重新分配匯流後流量
 * ================================================================ */

function redistributeAtNode(
    nodeId,
    flowState
) {

    const outgoing =
        getOutgoingPipes(
            nodeId
        );


    if (
        outgoing.length === 0
    ) {

        return;
    }


    const availableQ =
        calculateNodeAvailableFlow(
            nodeId,
            flowState
        );


    if (
        availableQ <=
        V3_HYDRAULIC_CONFIG.flowTolerance
    ) {

        outgoing.forEach(
            pipe => {

                flowState[
                    pipe.id
                ] =
                    0;
            }
        );


        return;
    }


    /*
     * 若全部 outgoing 都有指定設計流量，
     * 按指定比例。
     */

    const specified =
        outgoing.filter(
            pipe =>
                hydFinite(
                    pipe.designFlow ??
                    pipe.Q ??
                    pipe.flow
                )
        );


    if (
        specified.length ===
        outgoing.length
    ) {

        let total =
            specified.reduce(
                (
                    sum,
                    pipe
                ) =>
                    sum +
                    Math.max(
                        0,
                        hydNum(
                            pipe.designFlow ??
                            pipe.Q ??
                            pipe.flow
                        )
                    ),
                0
            );


        if (
            total > 0
        ) {

            outgoing.forEach(
                pipe => {

                    const base =
                        Math.max(
                            0,
                            hydNum(
                                pipe.designFlow ??
                                pipe.Q ??
                                pipe.flow
                            )
                        );


                    flowState[
                        pipe.id
                    ] =
                        availableQ *
                        base /
                        total;
                }
            );


            return;
        }
    }


    /*
     * 否則依輸水能力比例。
     */

    const capacity =
        outgoing.map(
            pipe => ({

                pipe,

                capacity:
                    Math.max(
                        fullPipeCapacity(
                            pipe
                        ),
                        0.000001
                    )
            })
        );


    const totalCapacity =
        capacity.reduce(
            (
                sum,
                item
            ) =>
                sum +
                item.capacity,
            0
        );


    capacity.forEach(
        item => {

            flowState[
                item.pipe.id
            ] =
                availableQ *
                item.capacity /
                totalCapacity;
        }
    );
}


/* ================================================================
 * 17. 全網路節點連續方程迭代
 * ================================================================ */

function solveNetworkContinuity(
    options = {}
) {

    if (
        typeof nodes ===
        "undefined" ||
        typeof pipes ===
        "undefined"
    ) {

        throw new Error(
            "nodes / pipes 未建立"
        );
    }


    if (
        nodes.length === 0
    ) {

        throw new Error(
            "nodes 為空"
        );
    }


    if (
        pipes.length === 0
    ) {

        throw new Error(
            "pipes 為空"
        );
    }


    const config = {

        ...V3_HYDRAULIC_CONFIG,

        ...options
    };


    /*
     * ------------------------------------------------------------
     * 1. 初始流量
     * ------------------------------------------------------------
     */

    const flowState =
        initializeFlowState();


    let converged =
        false;


    let maxResidual =
        Infinity;


    let maxFlowDelta =
        Infinity;


    let iteration =
        0;


    /*
     * ------------------------------------------------------------
     * 2. 網路迭代
     * ------------------------------------------------------------
     */

    for (
        iteration = 1;
        iteration <=
        config.maxNetworkIterations;
        iteration++
    ) {

        const oldState =
            {
                ...flowState
            };


        /*
         * 按 upstream → downstream
         * 逐節點處理。
         */

        /* [FIX] 穩態網路：依拓樸順序一次累加即為精確解 */

        accumulateFlowTopological(
            flowState
        );


        /*
         * Relaxation
         */

        pipes.forEach(
            pipe => {

                const oldQ =
                    hydNum(
                        oldState[
                            pipe.id
                        ]
                    );


                const newQ =
                    hydNum(
                        flowState[
                            pipe.id
                        ]
                    );


                flowState[
                    pipe.id
                ] =
                    oldQ *
                    (
                        1 -
                        config.relaxation
                    ) +
                    newQ *
                    config.relaxation;
            }
        );


        /*
         * --------------------------------------------------------
         * 節點 residual
         * --------------------------------------------------------
         */

        maxResidual =
            0;


        nodes.forEach(
            node => {

                const balance =
                    calculateNodeContinuity(
                        node.id,
                        flowState
                    );


                maxResidual =
                    Math.max(
                        maxResidual,
                        Math.abs(
                            balance.residual
                        )
                    );
            }
        );


        /*
         * 最大管段流量變化
         */

        maxFlowDelta =
            0;


        pipes.forEach(
            pipe => {

                const oldQ =
                    hydNum(
                        oldState[
                            pipe.id
                        ]
                    );


                const newQ =
                    hydNum(
                        flowState[
                            pipe.id
                        ]
                    );


                maxFlowDelta =
                    Math.max(
                        maxFlowDelta,
                        Math.abs(
                            newQ -
                            oldQ
                        )
                    );
            }
        );


        if (
            maxResidual <=
            config.nodeBalanceTolerance &&
            maxFlowDelta <=
            config.flowTolerance
        ) {

            converged =
                true;

            break;
        }
    }


    /*
     * ------------------------------------------------------------
     * 3. 建立管段成果
     * ------------------------------------------------------------
     */

    const pipeResults =
        [];


    pipes.forEach(
        pipe => {

            const Q =
                hydNum(
                    flowState[
                        pipe.id
                    ]
                );


            const result =
                calculatePipeHydraulics(
                    pipe,
                    Q
                );


            pipeResults.push(
                result
            );
        }
    );


    /*
     * ------------------------------------------------------------
     * 4. 節點成果
     * ------------------------------------------------------------
     */

    const nodeResults =
        [];


    nodes.forEach(
        node => {

            const balance =
                calculateNodeContinuity(
                    node.id,
                    flowState
                );


            const incoming =
                getIncomingPipes(
                    node.id
                );


            const outgoing =
                getOutgoingPipes(
                    node.id
                );


            nodeResults.push({

                nodeId:
                    node.id,

                Qin:
                    balance.Qin,

                Qout:
                    balance.Qout,

                Qlocal:
                    balance.Qlocal,

                residual:
                    balance.residual,

                balanced:
                    balance.balanced,

                incomingPipes:
                    incoming.map(
                        pipe =>
                            pipe.id
                    ),

                outgoingPipes:
                    outgoing.map(
                        pipe =>
                            pipe.id
                    )
            });
        }
    );


    /*
     * ------------------------------------------------------------
     * 5. 系統摘要
     * ------------------------------------------------------------
     */

    const fullPipes =
        pipeResults.filter(
            result =>
                result.full
        );


    const surchargePipes =
        pipeResults.filter(
            result =>
                result.surcharge
        );


    const supercriticalPipes =
        pipeResults.filter(
            result =>
                result.froude > 1
        );


    const subcriticalPipes =
        pipeResults.filter(
            result =>
                result.froude < 1 &&
                result.froude > 0
        );


    const result = {

        solver:
            "V3.1 steady network continuity + Manning",

        converged,

        iterations:
            iteration,

        maxResidual,

        maxFlowDelta,

        flowState,

        pipeResults,

        nodeResults,

        statistics: {

            pipeCount:
                pipeResults.length,

            nodeCount:
                nodeResults.length,

            fullPipeCount:
                fullPipes.length,

            surchargePipeCount:
                surchargePipes.length,

            supercriticalCount:
                supercriticalPipes.length,

            subcriticalCount:
                subcriticalPipes.length
        },

        sources:
            findNetworkSources()
                .map(
                    node =>
                        node.id
                ),

        outfalls:
            findNetworkOutfalls()
                .map(
                    node =>
                        node.id
                )
    };


    /*
     * ------------------------------------------------------------
     * 6. 全域供 V3 使用
     * ------------------------------------------------------------
     */

    window.v3HydraulicSolution =
        result;


    /*
     * 與舊版 hydraulicResults 相容
     */

    window.hydraulicResults =
        pipeResults;


    return result;
}


/* ================================================================
 * 18. 以設計流量執行單管分析
 * ================================================================ */

function runSinglePipeHydraulic(
    pipe
) {

    const Q =
        hydNum(
            pipe.designFlow ??
            pipe.Q ??
            pipe.flow
        );


    return calculatePipeHydraulics(
        pipe,
        Q
    );
}


/* ================================================================
 * 19. 取得完整水理成果
 * ================================================================ */

function getHydraulicResults() {

    if (
        window.v3HydraulicSolution
    ) {

        return (
            window
                .v3HydraulicSolution
                .pipeResults
        );
    }


    if (
        window.hydraulicResults
    ) {

        return window.hydraulicResults;
    }


    return [];
}


/* ================================================================
 * 20. 供 hgl-egl.js 使用的 API
 * ================================================================ */

function getHydraulicResultForPipe(
    pipeId
) {

    const results =
        getHydraulicResults();


    return (
        results.find(
            result =>
                String(
                    result.pipeId
                ) ===
                String(pipeId)
        ) ||
        null
    );
}


/* ================================================================
 * 21. 重新由 HGL 水位計算流量
 *
 * 這是 V3.1 → HGL/EGL 的重要介面。
 *
 * headSlope =
 *
 *     (Hup - Hdown) / L
 *
 * 若水頭坡度 > 0：
 *     使用 Manning 求 Q
 *
 * 若 Hup <= Hdown：
 *     標記為 backwater / pressure condition
 *
 * 此函式不直接處理完整 Saint-Venant。
 * ================================================================ */

function calculateFlowFromHydraulicHead(
    pipe,
    Hup,
    Hdown
) {

    const L =
        getPipeLength(
            pipe
        );


    const D =
        getPipeDiameter(
            pipe
        );


    const n =
        getPipeManningN(
            pipe
        );


    if (
        L <= 0 ||
        D <= 0
    ) {

        return {

            Q:
                0,

            hydraulicSlope:
                0,

            regime:
                "invalid"
        };
    }


    const hydraulicSlope =
        (
            hydNum(Hup) -
            hydNum(Hdown)
        ) /
        L;


    /*
     * 正水頭坡度：
     * Manning。
     */

    if (
        hydraulicSlope >
        V3_HYDRAULIC_CONFIG.minimumSlope
    ) {

        const A =
            circularArea(
                D
            );


        const R =
            D / 4;


        const Qfull =
            manningQ(
                A,
                R,
                hydraulicSlope,
                n
            );


        return {

            Q:
                Qfull,

            hydraulicSlope,

            regime:
                "full-manning",

            full:
                true
        };
    }


    /*
     * 水頭坡度 <= 0
     *
     * 代表回水 / 壓力 / 邊界控制，
     * 不用單純正常流公式硬算。
     */

    return {

        Q:
            0,

        hydraulicSlope,

        regime:
            "backwater",

        full:
            false
    };
}


/* ================================================================
 * 22. HGL 迭代介面
 *
 * hgl-egl.js 可使用這個函式。
 *
 * 輸入：
 *
 *   pipe
 *   Hup
 *   Hdown
 *
 * 回傳：
 *
 *   Q
 *   depth
 *   velocity
 *   regime
 * ================================================================ */

function hydraulicStateFromHGL(
    pipe,
    Hup,
    Hdown
) {

    const hydraulic =
        getHydraulicResultForPipe(
            pipe.id
        );


    /*
     * 若 network solver 已經算過，
     * 優先使用 network result。
     */

    if (
        hydraulic
    ) {

        return {

            ...hydraulic,

            Hup:
                Hup,

            Hdown:
                Hdown
        };
    }


    /*
     * 否則由水頭差估算。
     */

    const flow =
        calculateFlowFromHydraulicHead(
            pipe,
            Hup,
            Hdown
        );


    return {

        pipeId:
            pipe.id,

        Q:
            flow.Q,

        Hup,

        Hdown,

        regime:
            flow.regime
    };
}


/* ================================================================
 * 23. Manning 計算工具輸出
 * ================================================================ */

function getManningCapacity(
    pipe
) {

    return {

        Qfull:
            fullPipeCapacity(
                pipe
            ),

        diameter:
            getPipeDiameter(
                pipe
            ),

        slope:
            getPipeSlope(
                pipe
            ),

        n:
            getPipeManningN(
                pipe
            )
    };
}


/* ================================================================
 * 24. 系統檢核摘要
 * ================================================================ */

function hydraulicSummary(
    solution
) {

    if (!solution) {

        return null;
    }


    const pipeResults =
        solution.pipeResults ||
        [];


    const nodeResults =
        solution.nodeResults ||
        [];


    const maxVelocity =
        pipeResults.length > 0
            ? Math.max(
                ...pipeResults.map(
                    result =>
                        Math.abs(
                            hydNum(
                                result.velocity
                            )
                        )
                )
            )
            : 0;


    const minVelocity =
        pipeResults.length > 0
            ? Math.min(
                ...pipeResults.map(
                    result =>
                        Math.abs(
                            hydNum(
                                result.velocity
                            )
                        )
                )
            )
            : 0;


    const maxFroude =
        pipeResults.length > 0
            ? Math.max(
                ...pipeResults.map(
                    result =>
                        hydNum(
                            result.froude
                        )
                )
            )
            : 0;


    return {

        converged:
            solution.converged,

        iterations:
            solution.iterations,

        maxResidual:
            solution.maxResidual,

        maxFlowDelta:
            solution.maxFlowDelta,

        maxVelocity,

        minVelocity,

        maxFroude,

        fullPipeCount:
            solution.statistics
                ?.fullPipeCount || 0,

        surchargePipeCount:
            solution.statistics
                ?.surchargePipeCount || 0,

        unbalancedNodeCount:
            nodeResults.filter(
                node =>
                    !node.balanced
            ).length
    };
}


/* ================================================================
 * 25. 匯出至全域
 * ================================================================ */

window.V3Hydraulic = {

    solveNetwork:
        solveNetworkContinuity,

    solveNormalDepth,

    calculatePipe:
        calculatePipeHydraulics,

    calculateNodeContinuity,

    calculateFlowFromHydraulicHead,

    hydraulicStateFromHGL,

    getHydraulicResultForPipe,

    getResults:
        getHydraulicResults,

    getManningCapacity,

    fullPipeCapacity,

    circularGeometry,

    manningQ,

    manningVelocity,

    calculateFroude,

    summary:
        hydraulicSummary
};


/* ================================================================
 * 26. 相容舊版 API
 * ================================================================ */

window.solveHydraulicNetwork =
    solveNetworkContinuity;


window.runHydraulicAnalysis =
    solveNetworkContinuity;


window.calculateHydraulic =
    calculatePipeHydraulics;


/* ================================================================
 * END hydraulic.js
 * ================================================================ */
