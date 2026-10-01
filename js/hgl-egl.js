/**
 * V3 HGL / EGL Solver
 *
 * 以已知下游邊界條件，
 * 反向計算上游節點能量。
 */


/**
 * 建立管段水理狀態
 */
function buildPipeHydraulicState(
    pipe,
    hydraulic
) {

    const from =
        findNode(pipe.from);

    const to =
        findNode(pipe.to);

    if (!from || !to) {
        return null;
    }

    const velocity =
        hydraulic.velocity;

    const area =
        hydraulic.area;

    const Rh =
        hydraulic.hydraulicRadius;

    const friction =
        calculateFrictionLoss(
            hydraulic.Q,
            area,
            Rh,
            pipe.n,
            pipe.length
        );

    const local =
        calculateLocalLoss(
            pipe.K,
            velocity
        );

    return {

        pipeId:
            pipe.id,

        from:
            pipe.from,

        to:
            pipe.to,

        Q:
            hydraulic.Q,

        depth:
            hydraulic.depth,

        area,

        hydraulicRadius:
            Rh,

        velocity,

        velocityHead:
            velocityHead(
                velocity
            ),

        frictionSlope:
            friction.Sf,

        frictionLoss:
            friction.hf,

        localLoss:
            local,

        totalLoss:
            calculateTotalLoss(
                friction.hf,
                local
            ),

        invertUp:
            Number(
                from.invert
            ),

        invertDown:
            Number(
                to.invert
            )
    };
}


/**
 * 由下游 EGL 反推上游 EGL
 */
function solveUpstreamEnergy(
    downstreamEGL,
    pipeState
) {

    return (
        downstreamEGL +
        pipeState.totalLoss
    );
}


/**
 * EGL → HGL
 */
function calculateHGL(
    EGL,
    velocity
) {

    return (
        EGL -
        velocityHead(
            velocity
        )
    );
}


/**
 * HGL → 水深
 *
 * HGL = invert + depth
 */
function calculateDepthFromHGL(
    HGL,
    invert
) {

    return (
        HGL - invert
    );
}
