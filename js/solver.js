function bisection(
    fn,
    low,
    high,
    tolerance = 1e-6,
    maxIteration = 100
) {

    let fLow =
        fn(low);

    let fHigh =
        fn(high);


    if (
        !Number.isFinite(fLow) ||
        !Number.isFinite(fHigh)
    ) {

        return {

            value: NaN,

            converged: false,

            iterations: 0
        };
    }


    /*
     * 已經命中
     */

    if (
        Math.abs(fLow)
        < tolerance
    ) {

        return {

            value: low,

            converged: true,

            iterations: 0
        };
    }


    if (
        Math.abs(fHigh)
        < tolerance
    ) {

        return {

            value: high,

            converged: true,

            iterations: 0
        };
    }


    /*
     * 沒有夾住根
     */

    if (
        fLow * fHigh > 0
    ) {

        return {

            value: NaN,

            converged: false,

            iterations: 0
        };
    }


    let mid = low;


    for (
        let i = 1;
        i <= maxIteration;
        i++
    ) {

        mid =
            (
                low +
                high
            ) / 2;


        const fMid =
            fn(mid);


        if (
            Math.abs(fMid)
            < tolerance
        ) {

            return {

                value: mid,

                converged: true,

                iterations: i
            };
        }


        if (
            fLow * fMid <= 0
        ) {

            high = mid;

            fHigh = fMid;

        } else {

            low = mid;

            fLow = fMid;
        }
    }


    return {

        value: mid,

        converged: false,

        iterations:
            maxIteration
    };
}


function solveNormalDepthNumerical(
    Q,
    pipe
) {

    const D =
        pipe.diameter;


    const result =
        bisection(

            y =>
                manningDischarge(
                    y,
                    D,
                    pipe.n,
                    pipe.slope
                ) - Q,

            1e-7,

            D,

            1e-7,

            V3.project.maxIteration
        );


    return result;
}
