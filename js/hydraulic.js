/*
 * ============================================================
 * 台灣雨水下水道數值水理分析 V3
 * js/hydraulic.js
 *
 * 功能：
 * 1. Manning 非滿流水理
 * 2. 圓管部分充滿幾何計算
 * 3. 滿管流量
 * 4. 正常水深迭代
 * 5. 臨界水深迭代
 * 6. 管段水理狀態判斷
 * 7. 管網流量基本計算
 *
 * 單位：
 * 長度   m
 * 面積   m2
 * 流量   m3/s
 * 流速   m/s
 * 高程   m
 * 粗糙係數 n 無因次
 * ============================================================
 */

"use strict";

const V3_HYDRAULIC = {

    G: 9.81,

    TOLERANCE: 1e-7,

    MAX_ITERATIONS: 200

};


/* ============================================================
 * 基本工具
 * ============================================================ */

function hNum(value, fallback = 0) {

    const n = Number(value);

    return Number.isFinite(n)
        ? n
        : fallback;
}


function hClamp(value, min, max) {

    return Math.max(
        min,
        Math.min(max, value)
    );
}


/* ============================================================
 * 圓管幾何
 *
 * theta：
 * 水面所對應的圓心角，0 ~ 2π
 *
 * theta = 2π：
 * 滿管
 * ============================================================ */

function circularGeometry(
    diameter,
    depth
) {

    const D = hNum(diameter);
    const y = hNum(depth);

    if (D <= 0) {

        return {

            theta: 0,
            area: 0,
            wettedPerimeter: 0,
            hydraulicRadius: 0,
            topWidth: 0

        };
    }

    const R = D / 2;

    const depthClamped =
        hClamp(
            y,
            0,
            D
        );


    /* 水深為 0 */

    if (depthClamped <= 0) {

        return {

            theta: 0,
            area: 0,
            wettedPerimeter: 0,
            hydraulicRadius: 0,
            topWidth: 0

        };
    }


    /* 滿管 */

    if (depthClamped >= D) {

        const area =
            Math.PI * R * R;

        const wettedPerimeter =
            2 * Math.PI * R;

        return {

            theta:
                2 * Math.PI,

            area,

            wettedPerimeter,

            hydraulicRadius:
                area /
                wettedPerimeter,

            topWidth:
                D

        };
    }


    /*
     * 圓管部分充滿：
     *
     * alpha = acos((R-y)/R)
     *
     * theta = 2 alpha
     */

    const alpha =
        Math.acos(
            hClamp(
                (R - depthClamped) / R,
                -1,
                1
            )
        );

    const theta =
        2 * alpha;


    const area =
        0.5 *
        R *
        R *
        (
            theta -
            Math.sin(theta)
        );


    const wettedPerimeter =
        R * theta;


    const hydraulicRadius =
        wettedPerimeter > 0
            ? area / wettedPerimeter
            : 0;


    const topWidth =
        2 *
        R *
        Math.sin(alpha);


    return {

        theta,

        area,

        wettedPerimeter,

        hydraulicRadius,

        topWidth

    };
}


/* ============================================================
 * Manning
 *
 * Q = (1/n) A R^(2/3) S^(1/2)
 * ============================================================ */

function manningDischarge(
    area,
    hydraulicRadius,
    slope,
    n
) {

    const A =
        hNum(area);

    const R =
        hNum(hydraulicRadius);

    const S =
        hNum(slope);

    const roughness =
        hNum(n);


    if (
        A <= 0 ||
        R <= 0 ||
        S <= 0 ||
        roughness <= 0
    ) {

        return 0;
    }


    return (
        (1 / roughness) *
        A *
        Math.pow(
            R,
            2 / 3
        ) *
        Math.sqrt(S)
    );
}


/* ============================================================
 * Manning 流速
 * ============================================================ */

function manningVelocity(
    area,
    hydraulicRadius,
    slope,
    n
) {

    const Q =
        manningDischarge(
            area,
            hydraulicRadius,
            slope,
            n
        );


    if (area <= 0) {
        return 0;
    }


    return Q / area;
}


/* ============================================================
 * 依管徑求滿管 Manning 流量
 * ============================================================ */

function fullPipeCapacity(
    diameter,
    slope,
    n
) {

    const geometry =
        circularGeometry(
            diameter,
            diameter
        );


    return manningDischarge(
        geometry.area,
        geometry.hydraulicRadius,
        slope,
        n
    );
}


/* ============================================================
 * 正常水深方程
 *
 * f(y) = ManningQ(y) - Qtarget
 * ============================================================ */

function solveNormalDepth(
    diameter,
    slope,
    n,
    Q
) {

    const D =
        hNum(diameter);

    const S =
        hNum(slope);

    const roughness =
        hNum(n);

    const targetQ =
        Math.abs(
            hNum(Q)
        );


    if (
        D <= 0 ||
        S <= 0 ||
        roughness <= 0
    ) {

        return {

            depth: 0,

            velocity: 0,

            area: 0,

            hydraulicRadius: 0,

            topWidth: 0,

            discharge: 0,

            fullFlow: 0,

            ratio: 0,

            status:
                "INVALID_INPUT",

            iterations: 0

        };
    }


    const fullQ =
        fullPipeCapacity(
            D,
            S,
            roughness
        );


    /*
     * 流量大於滿管能力：
     *
     * 這裡不直接把水深設成 > D。
     * V3 後續應交給壓力流模組。
     */

    if (
        targetQ >=
        fullQ * 0.999999
    ) {

        const geometry =
            circularGeometry(
                D,
                D
            );


        const velocity =
            geometry.area > 0
                ? targetQ /
                  geometry.area
                : 0;


        return {

            depth: D,

            velocity,

            area:
                geometry.area,

            hydraulicRadius:
                geometry.hydraulicRadius,

            topWidth:
                geometry.topWidth,

            discharge:
                fullQ,

            requestedDischarge:
                targetQ,

            fullFlow:
                fullQ,

            ratio:
                fullQ > 0
                    ? targetQ / fullQ
                    : Infinity,

            status:
                targetQ > fullQ
                    ? "PRESSURE_FLOW_REQUIRED"
                    : "FULL_FLOW",

            iterations: 0

        };
    }


    /*
     * 二分法：
     *
     * 0 < y < D
     */

    let low =
        Math.max(
            D * 1e-8,
            1e-9
        );

    let high =
        D *
        (
            1 -
            1e-8
        );


    let mid =
        (low + high) / 2;

    let iterations = 0;


    for (
        iterations = 1;
        iterations <=
        V3_HYDRAULIC.MAX_ITERATIONS;
        iterations++
    ) {

        mid =
            (low + high) / 2;


        const geometry =
            circularGeometry(
                D,
                mid
            );


        const q =
            manningDischarge(
                geometry.area,
                geometry.hydraulicRadius,
                S,
                roughness
            );


        if (
            Math.abs(
                q - targetQ
            )
            <
            V3_HYDRAULIC.TOLERANCE
        ) {

            break;
        }


        if (q < targetQ) {

            low = mid;

        } else {

            high = mid;
        }
    }


    const geometry =
        circularGeometry(
            D,
            mid
        );


    const discharge =
        manningDischarge(
            geometry.area,
            geometry.hydraulicRadius,
            S,
            roughness
        );


    const velocity =
        geometry.area > 0
            ? targetQ /
              geometry.area
            : 0;


    return {

        depth:
            mid,

        velocity,

        area:
            geometry.area,

        hydraulicRadius:
            geometry.hydraulicRadius,

        topWidth:
            geometry.topWidth,

        discharge,

        requestedDischarge:
            targetQ,

        fullFlow:
            fullQ,

        ratio:
            fullQ > 0
                ? targetQ / fullQ
                : 0,

        status:
            "NORMAL_FLOW",

        iterations
    };
}


/* ============================================================
 * 臨界水深
 *
 * Fr = 1
 *
 * Q² T / (g A³) = 1
 *
 * ============================================================ */

function solveCriticalDepth(
    diameter,
    Q
) {

    const D =
        hNum(diameter);

    const targetQ =
        Math.abs(
            hNum(Q)
        );


    if (
        D <= 0 ||
        targetQ <= 0
    ) {

        return {

            depth: 0,

            froude: 0,

            status:
                "INVALID_INPUT"

        };
    }


    let low =
        Math.max(
            D * 1e-8,
            1e-8
        );

    let high =
        D *
        (
            1 -
            1e-8
        );


    let mid =
        (low + high) / 2;


    for (
        let i = 0;
        i < V3_HYDRAULIC.MAX_ITERATIONS;
        i++
    ) {

        mid =
            (low + high) / 2;


        const geometry =
            circularGeometry(
                D,
                mid
            );


        const A =
            geometry.area;

        const T =
            geometry.topWidth;


        if (
            A <= 0 ||
            T <= 0
        ) {

            low = mid;

            continue;
        }


        const residual =
            (
                targetQ *
                targetQ *
                T
            ) /
            (
                V3_HYDRAULIC.G *
                Math.pow(A, 3)
            )
            - 1;


        if (
            Math.abs(residual)
            <
            1e-8
        ) {

            break;
        }


        /*
         * 水深增加：
         * A 增加，Fr² 降低。
         */

        if (residual > 0) {

            low = mid;

        } else {

            high = mid;
        }
    }


    const geometry =
        circularGeometry(
            D,
            mid
        );


    const velocity =
        geometry.area > 0
            ? targetQ /
              geometry.area
            : 0;


    const froude =
        geometry.topWidth > 0 &&
        geometry.area > 0

            ? velocity /
              Math.sqrt(
                  V3_HYDRAULIC.G *
                  geometry.area /
                  geometry.topWidth
              )

            : 0;


    return {

        depth:
            mid,

        velocity,

        area:
            geometry.area,

        hydraulicRadius:
            geometry.hydraulicRadius,

        topWidth:
            geometry.topWidth,

        froude,

        status:
            Math.abs(
                froude - 1
            ) < 0.01

                ? "CRITICAL"
                : "CALCULATED"

    };
}


/* ============================================================
 * 管段水理分析
 * ============================================================ */

function analyzePipeHydraulics(
    pipe,
    Q
) {

    const diameter =
        hNum(
            pipe.diameter
        );

    const slope =
        hNum(
            pipe.slope
        );

    const n =
        hNum(
            pipe.n,
            0.013
        );

    const length =
        hNum(
            pipe.length
        );


    const result =
        solveNormalDepth(
            diameter,
            slope,
            n,
            Q
        );


    const critical =
        solveCriticalDepth(
            diameter,
            Q
        );


    let regime =
        "SUBCRITICAL";


    if (
        result.velocity >
        0 &&
        critical.depth >
        0
    ) {

        regime =
            result.depth >
            critical.depth
                ? "SUBCRITICAL"
                : "SUPERCRITICAL";
    }


    return {

        pipeId:
            pipe.id,

        from:
            pipe.from,

        to:
            pipe.to,

        length,

        diameter,

        slope,

        n,

        Q:
            Math.abs(Q),

        depth:
            result.depth,

        area:
            result.area,

        hydraulicRadius:
            result.hydraulicRadius,

        topWidth:
            result.topWidth,

        velocity:
            result.velocity,

        fullFlow:
            result.fullFlow,

        capacityRatio:
            result.fullFlow > 0
                ? Math.abs(Q) /
                  result.fullFlow
                : Infinity,

        criticalDepth:
            critical.depth,

        froude:
            critical.froude,

        regime,

        status:
            result.status,

        iterations:
            result.iterations,

        fullFlowRequired:
            result.status ===
            "PRESSURE_FLOW_REQUIRED"
    };
}


/* ============================================================
 * 節點入流累積
 *
 * 假設 flowIn 已經由 Rational Method 或其他模組
 * 建立於節點上。
 * ============================================================ */

function calculateNetworkFlows(
    nodeList,
    pipeList
) {

    const nodeFlow =
        {};


    nodeList.forEach(
        node => {

            nodeFlow[node.id] =
                hNum(
                    node.designFlow,
                    0
                );
        }
    );


    /*
     * 依拓樸順序反覆累積。
     *
     * V3 正式版後續可改為
     * Topological Sort。
     */

    let changed = true;

    let iteration = 0;


    while (
        changed &&
        iteration < 100
    ) {

        changed = false;

        iteration++;


        pipeList.forEach(
            pipe => {

                const q =
                    hNum(
                        nodeFlow[
                            pipe.from
                        ],
                        0
                    );


                if (
                    q <= 0
                ) {
                    return;
                }


                const old =
                    hNum(
                        nodeFlow[
                            pipe.to
                        ],
                        0
                    );


                /*
                 * 注意：
                 *
                 * 真正管網模型必須避免
                 * 重複累加。
                 *
                 * 因此此函式主要提供
                 * 簡化案例與樹狀管網使用。
                 */

                if (
                    pipe._flowTransferred
                ) {
                    return;
                }


                nodeFlow[
                    pipe.to
                ] =
                    old + q;


                pipe._flowTransferred =
                    true;


                changed = true;
            }
        );
    }


    /*
     * 清除暫存旗標
     */

    pipeList.forEach(
        pipe => {

            delete pipe._flowTransferred;

        }
    );


    return nodeFlow;
}


/* ============================================================
 * 對現有全域資料執行管網水理
 * ============================================================ */

function calculateNetworkHydraulic() {

    if (
        typeof pipes === "undefined"
    ) {

        throw new Error(
            "找不到 pipes 資料"
        );
    }


    if (
        typeof nodes === "undefined"
    ) {

        throw new Error(
            "找不到 nodes 資料"
        );
    }


    /*
     * 優先使用管段已指定 Q。
     *
     * 若沒有 Q：
     * 使用 upstream node designFlow。
     */

    const results = [];


    pipes.forEach(
        pipe => {

            let Q =
                hNum(
                    pipe.Q,
                    NaN
                );


            if (
                !Number.isFinite(Q)
            ) {

                const from =
                    nodes.find(
                        n =>
                            n.id ===
                            pipe.from
                    );


                Q =
                    from
                        ? hNum(
                            from.designFlow,
                            0
                        )
                        : 0;
            }


            const result =
                analyzePipeHydraulics(
                    pipe,
                    Q
                );


            results.push(
                result
            );
        }
    );


    /*
     * 與前面 V3 架構相容
     */

    window.hydraulicResults =
        results;


    return results;
}


/* ============================================================
 * 計算單一管段滿管能力
 * ============================================================ */

function getPipeCapacity(
    pipe
) {

    return fullPipeCapacity(
        hNum(pipe.diameter),
        hNum(pipe.slope),
        hNum(
            pipe.n,
            0.013
        )
    );
}


/* ============================================================
 * V3 檢核
 * ============================================================ */

function checkHydraulicResults(
    results
) {

    return results.map(
        r => {

            const warnings = [];


            if (
                r.fullFlowRequired
            ) {

                warnings.push(
                    "設計流量超過 Manning 滿管能力，需進入滿管/壓力流分析。"
                );
            }


            if (
                r.capacityRatio >=
                0.9
            ) {

                warnings.push(
                    "管段容量使用率達 90% 以上。"
                );
            }


            if (
                r.velocity < 0.6
            ) {

                warnings.push(
                    "流速低於目前工程檢核門檻，請依採用設計準則確認。"
                );
            }


            if (
                r.velocity > 3.0
            ) {

                warnings.push(
                    "流速偏高，請依採用設計準則確認。"
                );
            }


            return {

                pipeId:
                    r.pipeId,

                capacityRatio:
                    r.capacityRatio,

                velocity:
                    r.velocity,

                status:
                    warnings.length
                        ? "CHECK"
                        : "OK",

                warnings
            };
        }
    );
}
