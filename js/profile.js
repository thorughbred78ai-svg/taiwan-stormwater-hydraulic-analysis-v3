/*
 * ============================================================
 * 台灣雨水下水道數值水理分析 V3
 * js/profile.js
 *
 * HGL / EGL / Ground / Invert 縱剖面
 * ============================================================
 */

"use strict";


const V3_PROFILE = {

    marginLeft: 90,

    marginRight: 40,

    marginTop: 70,

    marginBottom: 80,

    gridColor:
        "#e2e8f0",

    textColor:
        "#334155",

    groundColor:
        "#64748b",

    invertColor:
        "#0f766e",

    hglColor:
        "#2563eb",

    eglColor:
        "#dc2626",

    surchargeColor:
        "#f59e0b",

    overflowColor:
        "#ef4444"

};


/* ============================================================
 * 取得主要分析路徑
 * ============================================================ */

function getProfilePath() {

    if (
        typeof pipes === "undefined" ||
        !pipes.length
    ) {

        return [];
    }


    /*
     * 優先使用使用者指定的 profilePath。
     */

    if (
        Array.isArray(
            window.profilePath
        ) &&
        window.profilePath.length
    ) {

        return window.profilePath
            .map(
                id =>
                    pipes.find(
                        p =>
                            p.id === id
                    )
            )
            .filter(Boolean);
    }


    /*
     * 自動尋找：
     *
     * 一條沒有 incoming pipe
     * 的起始管段。
     */

    const downstreamIds =
        new Set(
            pipes.map(
                p => p.to
            )
        );


    let first =
        pipes.find(
            p =>
                !downstreamIds.has(
                    p.from
                )
        );


    if (!first) {
        first = pipes[0];
    }


    const path = [];

    const used =
        new Set();


    let current =
        first;


    while (
        current &&
        !used.has(
            current.id
        )
    ) {

        path.push(
            current
        );

        used.add(
            current.id
        );


        current =
            pipes.find(
                p =>
                    p.from ===
                    path[
                        path.length - 1
                    ].to &&
                    !used.has(
                        p.id
                    )
            );
    }


    return path;
}


/* ============================================================
 * 建立縱剖面資料
 * ============================================================ */

function buildProfileData(
    solution = null
) {

    const path =
        getProfilePath();


    if (!path.length) {
        return [];
    }


    const data = [];


    let station = 0;


    const firstNode =
        findNode(
            path[0].from
        );


    if (firstNode) {

        data.push(
            createProfileNode(
                firstNode,
                station,
                solution
            )
        );
    }


    path.forEach(
        pipe => {

            station +=
                Number(
                    pipe.length || 0
                );


            const node =
                findNode(
                    pipe.to
                );


            if (!node) {
                return;
            }


            data.push(
                createProfileNode(
                    node,
                    station,
                    solution
                )
            );
        }
    );


    return data;
}


/* ============================================================
 * 節點資料
 * ============================================================ */

function createProfileNode(
    node,
    station,
    solution
) {

    const energy =
        solution &&
        solution.nodeEnergy

            ? solution.nodeEnergy[
                node.id
            ]

            : null;


    let HGL =
        null;

    let EGL =
        null;


    if (energy) {

        HGL =
            Number(
                energy.HGL
            );

        EGL =
            Number(
                energy.EGL
            );
    }


    const ground =
        Number(
            node.ground ??
            node.groundElevation ??
            node.invert ??
            0
        );


    const invert =
        Number(
            node.invert ??
            node.invertElevation ??
            0
        );


    return {

        id:
            node.id,

        station,

        ground,

        invert,

        HGL,

        EGL,

        freeboard:
            HGL === null
                ? null
                : ground - HGL,

        overflow:
            HGL !== null &&
            HGL > ground,

        surcharge:
            HGL !== null &&
            HGL > invert

    };
}


/* ============================================================
 * 取得縱剖面範圍
 * ============================================================ */

function profileExtent(
    data
) {

    const values = [];


    data.forEach(
        p => {

            [
                p.ground,
                p.invert,
                p.HGL,
                p.EGL
            ]
            .forEach(
                v => {

                    if (
                        Number.isFinite(v)
                    ) {

                        values.push(v);
                    }
                }
            );
        }
    );


    if (!values.length) {

        return {

            min: 0,

            max: 10

        };
    }


    let min =
        Math.min(
            ...values
        );

    let max =
        Math.max(
            ...values
        );


    const range =
        Math.max(
            max - min,
            1
        );


    const padding =
        range * 0.12;


    return {

        min:
            min - padding,

        max:
            max + padding

    };
}


/* ============================================================
 * 繪製主圖
 * ============================================================ */

function drawV3Profile(
    solution = null,
    canvasId = "profileCanvas"
) {

    const canvas =
        document.getElementById(
            canvasId
        );


    if (!canvas) {

        console.warn(
            "找不到 profileCanvas"
        );

        return;
    }


    const ctx =
        canvas.getContext(
            "2d"
        );


    const width =
        canvas.clientWidth ||
        1000;


    const height =
        canvas.clientHeight ||
        520;


    /*
     * 支援高 DPI。
     */

    const dpr =
        window.devicePixelRatio ||
        1;


    canvas.width =
        width * dpr;

    canvas.height =
        height * dpr;


    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );


    ctx.clearRect(
        0,
        0,
        width,
        height
    );


    const data =
        buildProfileData(
            solution
        );


    if (!data.length) {

        drawEmptyProfile(
            ctx,
            width,
            height
        );

        return;
    }


    const extent =
        profileExtent(
            data
        );


    const left =
        V3_PROFILE.marginLeft;

    const right =
        width -
        V3_PROFILE.marginRight;

    const top =
        V3_PROFILE.marginTop;

    const bottom =
        height -
        V3_PROFILE.marginBottom;


    const maxStation =
        Math.max(
            ...data.map(
                p =>
                    p.station
            ),
            1
        );


    function X(
        station
    ) {

        return (
            left +
            station /
            maxStation *
            (
                right -
                left
            )
        );
    }


    function Y(
        elevation
    ) {

        return (
            bottom -
            (
                elevation -
                extent.min
            ) /
            (
                extent.max -
                extent.min
            ) *
            (
                bottom -
                top
            )
        );
    }


    /*
     * 背景
     */

    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    drawProfileTitle(
        ctx,
        width
    );


    drawElevationGrid(
        ctx,
        left,
        right,
        top,
        bottom,
        extent,
        Y
    );


    /*
     * Ground
     */

    drawProfileSeries(
        ctx,
        data,
        p => p.ground,
        X,
        Y,
        V3_PROFILE.groundColor,
        2,
        false
    );


    /*
     * Pipe Invert
     */

    drawProfileSeries(
        ctx,
        data,
        p => p.invert,
        X,
        Y,
        V3_PROFILE.invertColor,
        5,
        false
    );


    /*
     * HGL
     */

    drawProfileSeries(
        ctx,
        data,
        p => p.HGL,
        X,
        Y,
        V3_PROFILE.hglColor,
        3,
        true
    );


    /*
     * EGL
     */

    drawProfileSeries(
        ctx,
        data,
        p => p.EGL,
        X,
        Y,
        V3_PROFILE.eglColor,
        2,
        true
    );


    /*
     * 節點
     */

    drawProfileNodes(
        ctx,
        data,
        X,
        Y,
        bottom
    );


    /*
     * 樁號
     */

    drawStationAxis(
        ctx,
        data,
        X,
        bottom,
        width
    );


    /*
     * 圖例
     */

    drawProfileLegend(
        ctx,
        left + 10,
        top + 5
    );
}


/* ============================================================
 * 空圖
 * ============================================================ */

function drawEmptyProfile(
    ctx,
    width,
    height
) {

    ctx.fillStyle =
        "#ffffff";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );


    ctx.fillStyle =
        "#64748b";

    ctx.font =
        "16px Microsoft JhengHei, sans-serif";


    ctx.fillText(
        "尚無縱剖面資料，請先執行 V3 水理分析。",
        40,
        70
    );
}


/* ============================================================
 * 標題
 * ============================================================ */

function drawProfileTitle(
    ctx,
    width
) {

    ctx.fillStyle =
        "#1e293b";

    ctx.font =
        "bold 20px Microsoft JhengHei, sans-serif";


    ctx.fillText(
        "雨水下水道 HGL / EGL 縱剖面",
        25,
        30
    );
}


/* ============================================================
 * 高程格線
 * ============================================================ */

function drawElevationGrid(
    ctx,
    left,
    right,
    top,
    bottom,
    extent,
    Y
) {

    const step =
        chooseGridStep(
            extent.max -
            extent.min
        );


    const start =
        Math.ceil(
            extent.min /
            step
        ) *
        step;


    ctx.font =
        "11px Arial";


    for (
        let z =
            start;
        z <= extent.max;
        z += step
    ) {

        const y =
            Y(z);


        ctx.strokeStyle =
            V3_PROFILE.gridColor;

        ctx.lineWidth =
            1;


        ctx.beginPath();

        ctx.moveTo(
            left,
            y
        );

        ctx.lineTo(
            right,
            y
        );

        ctx.stroke();


        ctx.fillStyle =
            V3_PROFILE.textColor;


        ctx.fillText(
            z.toFixed(2),
            10,
            y + 4
        );
    }
}


/* ============================================================
 * 自動選擇格網間距
 * ============================================================ */

function chooseGridStep(
    range
) {

    if (range <= 2) {
        return 0.2;
    }

    if (range <= 5) {
        return 0.5;
    }

    if (range <= 10) {
        return 1;
    }

    if (range <= 25) {
        return 2;
    }

    if (range <= 50) {
        return 5;
    }

    return 10;
}


/* ============================================================
 * 畫線
 * ============================================================ */

function drawProfileSeries(
    ctx,
    data,
    getter,
    X,
    Y,
    color,
    width,
    dashed
) {

    ctx.strokeStyle =
        color;

    ctx.lineWidth =
        width;


    if (dashed) {

        ctx.setLineDash(
            [7, 5]
        );

    } else {

        ctx.setLineDash([]);
    }


    ctx.beginPath();


    let started = false;


    data.forEach(
        p => {

            const value =
                getter(p);


            if (
                value === null ||
                !Number.isFinite(
                    Number(value)
                )
            ) {

                started = false;

                return;
            }


            const x =
                X(
                    p.station
                );

            const y =
                Y(
                    Number(value)
                );


            if (!started) {

                ctx.moveTo(
                    x,
                    y
                );

                started = true;

            } else {

                ctx.lineTo(
                    x,
                    y
                );
            }
        }
    );


    ctx.stroke();

    ctx.setLineDash([]);
}


/* ============================================================
 * 節點
 * ============================================================ */

function drawProfileNodes(
    ctx,
    data,
    X,
    Y,
    bottom
) {

    data.forEach(
        p => {

            const x =
                X(
                    p.station
                );


            /*
             * 管底節點
             */

            const invertY =
                Y(
                    p.invert
                );


            ctx.fillStyle =
                V3_PROFILE.invertColor;


            ctx.beginPath();

            ctx.arc(
                x,
                invertY,
                4,
                0,
                Math.PI * 2
            );

            ctx.fill();


            /*
             * HGL 節點
             */

            if (
                p.HGL !== null
            ) {

                const hglY =
                    Y(
                        p.HGL
                    );


                ctx.fillStyle =
                    p.overflow
                        ? V3_PROFILE.overflowColor
                        : V3_PROFILE.hglColor;


                ctx.beginPath();

                ctx.arc(
                    x,
                    hglY,
                    4,
                    0,
                    Math.PI * 2
                );

                ctx.fill();
            }


            /*
             * 節點名稱
             */

            ctx.fillStyle =
                V3_PROFILE.textColor;

            ctx.font =
                "11px Arial";


            ctx.fillText(
                p.id,
                x - 10,
                bottom + 20
            );


            /*
             * 溢淹標記
             */

            if (
                p.overflow
            ) {

                ctx.fillStyle =
                    V3_PROFILE.overflowColor;

                ctx.font =
                    "bold 11px Microsoft JhengHei";


                ctx.fillText(
                    "溢淹",
                    x - 12,
                    Y(
                        p.ground
                    ) - 10
                );
            }
        }
    );
}


/* ============================================================
 * 樁號
 * ============================================================ */

function drawStationAxis(
    ctx,
    data,
    X,
    bottom,
    width
) {

    ctx.strokeStyle =
        "#94a3b8";

    ctx.lineWidth =
        1;


    ctx.beginPath();

    ctx.moveTo(
        V3_PROFILE.marginLeft,
        bottom
    );

    ctx.lineTo(
        width -
        V3_PROFILE.marginRight,
        bottom
    );

    ctx.stroke();


    ctx.fillStyle =
        V3_PROFILE.textColor;

    ctx.font =
        "10px Arial";


    data.forEach(
        p => {

            const x =
                X(
                    p.station
                );


            ctx.beginPath();

            ctx.moveTo(
                x,
                bottom
            );

            ctx.lineTo(
                x,
                bottom + 6
            );

            ctx.stroke();


            ctx.fillText(
                p.station.toFixed(0),
                x - 10,
                bottom + 42
            );
        }
    );


    ctx.font =
        "12px Microsoft JhengHei";


    ctx.fillText(
        "距離 / 樁號 (m)",
        width / 2 - 45,
        bottom + 65
    );
}


/* ============================================================
 * 圖例
 * ============================================================ */

function drawProfileLegend(
    ctx,
    x,
    y
) {

    const items = [

        {
            name: "地面線",
            color:
                V3_PROFILE.groundColor,
            width: 2
        },

        {
            name: "管底",
            color:
                V3_PROFILE.invertColor,
            width: 5
        },

        {
            name: "HGL",
            color:
                V3_PROFILE.hglColor,
            width: 3
        },

        {
            name: "EGL",
            color:
                V3_PROFILE.eglColor,
            width: 2
        }

    ];


    items.forEach(
        (item, i) => {

            const yy =
                y +
                i * 23;


            ctx.strokeStyle =
                item.color;

            ctx.lineWidth =
                item.width;


            ctx.beginPath();

            ctx.moveTo(
                x,
                yy
            );

            ctx.lineTo(
                x + 30,
                yy
            );

            ctx.stroke();


            ctx.fillStyle =
                V3_PROFILE.textColor;

            ctx.font =
                "12px Microsoft JhengHei";


            ctx.fillText(
                item.name,
                x + 38,
                yy + 4
            );
        }
    );
}


/* ============================================================
 * 匯出 SVG
 *
 * 提供後續工程報表使用。
 * ============================================================ */

function exportProfileCSV(
    solution = null
) {

    const data =
        buildProfileData(
            solution
        );


    const rows = [

        [
            "Node",
            "Station_m",
            "Ground_m",
            "Invert_m",
            "HGL_m",
            "EGL_m",
            "Freeboard_m",
            "Surcharge",
            "Overflow"
        ]

    ];


    data.forEach(
        p => {

            rows.push([

                p.id,

                p.station,

                p.ground,

                p.invert,

                p.HGL ?? "",

                p.EGL ?? "",

                p.freeboard ?? "",

                p.surcharge
                    ? "YES"
                    : "NO",

                p.overflow
                    ? "YES"
                    : "NO"

            ]);
        }
    );


    return rows
        .map(
            row =>
                row
                    .map(
                        value =>
                            csvEscape(
                                value
                            )
                    )
                    .join(",")
        )
        .join("\n");
}


function csvEscape(
    value
) {

    const text =
        String(
            value ?? ""
        );


    if (
        /[",\n]/.test(text)
    ) {

        return `"${text.replace(
            /"/g,
            '""'
        )}"`;
    }


    return text;
}
