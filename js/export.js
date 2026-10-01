/*
 * ============================================================
 * export.js
 * 台灣雨水下水道數值水理分析 V3
 *
 * 匯出：
 * 1. CSV
 * 2. JSON
 * 3. HTML 工程成果報表
 * 4. V3 完整專案資料
 * ============================================================
 */


/* ============================================================
 * 基本下載工具
 * ========================================================== */

function downloadTextFile(
    filename,
    content,
    mimeType = "text/plain;charset=utf-8"
) {

    const blob =
        new Blob(
            [content],
            {
                type: mimeType
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


    URL.revokeObjectURL(
        url
    );
}


/* ============================================================
 * CSV
 * ========================================================== */

function csvEscape(
    value
) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    const text =
        String(value);


    if (
        text.includes(",") ||
        text.includes('"') ||
        text.includes("\n")
    ) {

        return '"' +
            text.replace(
                /"/g,
                '""'
            ) +
            '"';
    }


    return text;
}


function arrayToCSV(
    rows
) {

    if (
        !Array.isArray(rows) ||
        rows.length === 0
    ) {

        return "";
    }


    const keys =
        Array.from(
            new Set(
                rows.flatMap(
                    row =>
                        Object.keys(
                            row
                        )
                )
            )
        );


    const header =
        keys.map(
            csvEscape
        ).join(",");


    const body =
        rows.map(
            row => {

                return keys
                    .map(
                        key =>
                            csvEscape(
                                row[key]
                            )
                    )
                    .join(",");
            }
        ).join("\n");


    /*
     * UTF-8 BOM
     * 讓 Excel 正確辨識中文
     */

    return (
        "\uFEFF" +
        header +
        "\n" +
        body
    );
}


/* ============================================================
 * 管段成果 CSV
 * ========================================================== */

function exportPipeCSV() {

    if (
        !window.v3Solution
    ) {

        alert(
            "尚未有 V3 分析結果。"
        );

        return;
    }


    const rows =
        window.v3Solution
            .checkingResults
            ?.pipeResults ||
        window.v3Solution
            .hglEglResults ||
        window.v3Solution
            .pipeResults ||
        [];


    const csv =
        arrayToCSV(
            rows
        );


    downloadTextFile(
        "V3_管段水理分析.csv",
        csv,
        "text/csv;charset=utf-8"
    );
}


/* ============================================================
 * 節點成果 CSV
 * ========================================================== */

function exportNodeCSV() {

    if (
        !window.v3Solution
    ) {

        alert(
            "尚未有 V3 分析結果。"
        );

        return;
    }


    const rows =
        window.v3Solution
            .checkingResults
            ?.nodeResults ||
        window.v3Solution
            .nodeResults ||
        [];


    const csv =
        arrayToCSV(
            rows
        );


    downloadTextFile(
        "V3_節點水理分析.csv",
        csv,
        "text/csv;charset=utf-8"
    );
}


/* ============================================================
 * 完整 V3 JSON
 * ========================================================== */

function exportProjectJSON() {

    if (
        !window.v3Solution
    ) {

        alert(
            "尚未有 V3 分析結果。"
        );

        return;
    }


    const output = {

        application:
            "台灣雨水下水道數值水理分析 V3",

        creator:
            "HHHuang",

        version:
            "3.0",

        exportedAt:
            new Date()
                .toISOString(),

        project:
            window.projectData ||
            {},

        nodes:
            typeof nodes !== "undefined"
                ? nodes
                : [],

        pipes:
            typeof pipes !== "undefined"
                ? pipes
                : [],

        boundaryCondition:
            typeof boundaryCondition !== "undefined"
                ? boundaryCondition
                : {},

        solution:
            window.v3Solution
    };


    const json =
        JSON.stringify(
            output,
            null,
            2
        );


    downloadTextFile(
        "V3_雨水下水道完整分析.json",
        json,
        "application/json;charset=utf-8"
    );
}


/* ============================================================
 * 工程報表 HTML
 * ========================================================== */

function generateEngineeringReportHTML() {

    const solution =
        window.v3Solution;


    if (!solution) {

        return `
            <html>
            <body>
                <h1>尚未執行分析</h1>
            </body>
            </html>
        `;
    }


    const checking =
        solution.checkingResults ||
        {};


    const project =
        window.projectData ||
        {};


    const pipeResults =
        checking.pipeResults ||
        solution.hglEglResults ||
        [];


    const nodeResults =
        checking.nodeResults ||
        solution.nodeResults ||
        [];


    const generated =
        new Date()
            .toLocaleString(
                "zh-TW"
            );


    return `

<!DOCTYPE html>

<html lang="zh-Hant">

<head>

<meta charset="UTF-8">

<title>
台灣雨水下水道數值水理分析 V3
</title>

<style>

body {

    font-family:
        "Microsoft JhengHei",
        Arial,
        sans-serif;

    margin: 40px;

    color: #263238;

}

h1 {

    color: #0f4c81;

}

h2 {

    border-bottom:
        2px solid #0f4c81;

    padding-bottom: 8px;

}

.info {

    background: #f1f5f9;

    padding: 15px;

    margin-bottom: 20px;

}

table {

    border-collapse:
        collapse;

    width: 100%;

    margin-bottom: 30px;

}

th,
td {

    border:
        1px solid #cbd5e1;

    padding:
        7px;

    text-align:
        center;

}

th {

    background:
        #e2e8f0;

}

.pass {

    color:
        #15803d;

}

.warning {

    color:
        #b45309;

}

.fail {

    color:
        #dc2626;

}

.footer {

    margin-top:
        40px;

    font-size:
        12px;

    color:
        #64748b;

}

</style>

</head>

<body>

<h1>
台灣雨水下水道數值水理分析 V3
</h1>

<div class="info">

<p>
<strong>創建者：</strong>
HHHuang
</p>

<p>
<strong>專案：</strong>
${project.name || "未命名工程"}
</p>

<p>
<strong>產出時間：</strong>
${generated}
</p>

<p>
<strong>版本：</strong>
V3.0
</p>

</div>


<h2>
一、系統檢核摘要
</h2>

<p>
管段檢核：
${checking.summary?.total || 0}
項
</p>

<p class="pass">
正常：
${checking.summary?.pass || 0}
</p>

<p class="warning">
警告：
${checking.summary?.warning || 0}
</p>

<p class="fail">
不符合：
${checking.summary?.fail || 0}
</p>


<h2>
二、管段 HGL / EGL
</h2>

<table>

<thead>

<tr>

<th>管段</th>
<th>Q</th>
<th>流速</th>
<th>水深</th>
<th>HGL 上游</th>
<th>HGL 下游</th>
<th>EGL 上游</th>
<th>EGL 下游</th>
<th>狀態</th>

</tr>

</thead>

<tbody>

${pipeResults.map(
    r => `

<tr>

<td>
${r.pipeId || ""}
</td>

<td>
${Number(
    r.Q || 0
).toFixed(4)}
</td>

<td>
${Number(
    r.velocity || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.depth || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.upstreamHGL || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.downstreamHGL || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.upstreamEGL || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.downstreamEGL || 0
).toFixed(3)}
</td>

<td>
${r.status || ""}
</td>

</tr>

`
).join("")}

</tbody>

</table>


<h2>
三、節點水位檢核
</h2>

<table>

<thead>

<tr>

<th>節點</th>
<th>管底</th>
<th>地面</th>
<th>HGL</th>
<th>EGL</th>
<th>水深</th>
<th>自由高</th>
<th>頂托</th>
<th>溢淹</th>
<th>狀態</th>

</tr>

</thead>

<tbody>

${nodeResults.map(
    r => `

<tr>

<td>
${r.nodeId || ""}
</td>

<td>
${Number(
    r.invert || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.ground || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.HGL || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.EGL || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.depth || 0
).toFixed(3)}
</td>

<td>
${Number(
    r.freeboard || 0
).toFixed(3)}
</td>

<td>
${r.surcharge ? "是" : "否"}
</td>

<td>
${r.overflow ? "是" : "否"}
</td>

<td>
${r.status || ""}
</td>

</tr>

`
).join("")}

</tbody>

</table>


<div class="footer">

本報表由「台灣雨水下水道數值水理分析 V3」
自動產生。

</div>

</body>

</html>

`;
}


/* ============================================================
 * 下載 HTML 報表
 * ========================================================== */

function exportEngineeringReport() {

    const html =
        generateEngineeringReportHTML();


    downloadTextFile(
        "V3_雨水下水道工程分析報表.html",
        html,
        "text/html;charset=utf-8"
    );
}


/* ============================================================
 * 匯出全部
 * ========================================================== */

function exportAllV3Results() {

    exportPipeCSV();

    setTimeout(
        () => {
            exportNodeCSV();
        },
        200
    );


    setTimeout(
        () => {
            exportProjectJSON();
        },
        400
    );


    setTimeout(
        () => {
            exportEngineeringReport();
        },
        600
    );
}
