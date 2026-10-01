/**
 * V3 Boundary Condition Module
 */

let boundaryCondition = {

    type: "FIXED_WATER_LEVEL",

    nodeId: "",

    waterLevel: null,

    tailwaterDepth: null
};


/**
 * 設定固定水位
 */
function setFixedWaterLevel(
    nodeId,
    waterLevel
) {

    boundaryCondition = {

        type:
            "FIXED_WATER_LEVEL",

        nodeId,

        waterLevel:
            Number(waterLevel),

        tailwaterDepth:
            null
    };
}


/**
 * 自由出流
 */
function setFreeOutfall(
    nodeId
) {

    boundaryCondition = {

        type:
            "FREE_OUTFALL",

        nodeId,

        waterLevel:
            null,

        tailwaterDepth:
            null
    };
}


/**
 * 正常水深邊界
 */
function setNormalDepthBoundary(
    nodeId
) {

    boundaryCondition = {

        type:
            "NORMAL_DEPTH",

        nodeId,

        waterLevel:
            null,

        tailwaterDepth:
            null
    };
}


/**
 * 取得邊界節點
 */
function getBoundaryNode() {

    if (
        !boundaryCondition.nodeId
    ) {
        return null;
    }

    return findNode(
        boundaryCondition.nodeId
    );
}
