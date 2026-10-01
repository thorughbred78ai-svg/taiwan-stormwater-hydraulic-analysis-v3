/*
 * V3 Hydraulic Loss Module
 *
 * 單位：
 * Q       : m3/s
 * velocity: m/s
 * L       : m
 * D       : m
 * g       : m/s2
 */

const GRAVITY = 9.81;


/**
 * Manning 沿程水頭損失
 *
 * hf = S_f * L
 *
 * 對正常流：
 *
 * Sf = Q^2 n^2 / (A^2 R^(4/3))
 */
function manningFrictionSlope(
    Q,
    area,
    hydraulicRadius,
    n
) {

    if (
        Q <= 0 ||
        area <= 0 ||
        hydraulicRadius <= 0 ||
        n <= 0
    ) {
        return 0;
    }

    return (
        Math.pow(Q * n / area, 2) /
        Math.pow(hydraulicRadius, 4 / 3)
    );
}


/**
 * 沿程損失
 */
function calculateFrictionLoss(
    Q,
    area,
    hydraulicRadius,
    n,
    length
) {

    const Sf =
        manningFrictionSlope(
            Q,
            area,
            hydraulicRadius,
            n
        );

    return {
        Sf,
        hf: Sf * length
    };
}


/**
 * 速度水頭
 */
function velocityHead(
    velocity
) {

    if (!Number.isFinite(velocity)) {
        return 0;
    }

    return (
        velocity * velocity /
        (2 * GRAVITY)
    );
}


/**
 * 局部損失
 *
 * hL = K V² / 2g
 */
function calculateLocalLoss(
    K,
    velocity
) {

    K =
        Number(K) || 0;

    return (
        K *
        velocityHead(
            velocity
        )
    );
}


/**
 * 總能量損失
 */
function calculateTotalLoss(
    frictionLoss,
    localLoss
) {

    return (
        frictionLoss +
        localLoss
    );
}
