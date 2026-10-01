function circularGeometry(
    depth,
    diameter
) {

    const D =
        Number(diameter);

    const y =
        Math.max(
            0,
            Math.min(
                Number(depth),
                D
            )
        );

    if (
        D <= 0 ||
        y <= 0
    ) {

        return {

            area: 0,

            wettedPerimeter: 0,

            hydraulicRadius: 0,

            topWidth: 0
        };
    }


    const r =
        D / 2;


    if (y >= D) {

        const area =
            Math.PI *
            D *
            D / 4;

        const perimeter =
            Math.PI * D;

        return {

            area,

            wettedPerimeter:
                perimeter,

            hydraulicRadius:
                area / perimeter,

            topWidth:
                D
        };
    }


    const theta =
        2 *
        Math.acos(
            (r - y) / r
        );


    const area =
        r * r / 2 *
        (
            theta -
            Math.sin(theta)
        );


    const perimeter =
        r * theta;


    const topWidth =
        2 *
        Math.sqrt(
            Math.max(
                0,
                2 * r * y -
                y * y
            )
        );


    return {

        area,

        wettedPerimeter:
            perimeter,

        hydraulicRadius:
            area / perimeter,

        topWidth
    };
}


function manningDischarge(
    depth,
    diameter,
    roughness,
    slope
) {

    const g =
        circularGeometry(
            depth,
            diameter
        );

    if (
        g.area <= 0 ||
        g.hydraulicRadius <= 0 ||
        roughness <= 0 ||
        slope <= 0
    ) {
        return 0;
    }

    return (
        1 / roughness
    ) *
    g.area *
    Math.pow(
        g.hydraulicRadius,
        2 / 3
    ) *
    Math.sqrt(
        slope
    );
}


function normalDepth(
    Q,
    diameter,
    roughness,
    slope
) {

    if (
        Q <= 0
    ) {
        return 0;
    }


    const qFull =
        manningDischarge(
            diameter,
            diameter,
            roughness,
            slope
        );


    if (Q >= qFull) {

        return diameter;
    }


    let low = 0;

    let high =
        diameter;


    for (
        let i = 0;
        i < 80;
        i++
    ) {

        const mid =
            (
                low +
                high
            ) / 2;


        const q =
            manningDischarge(
                mid,
                diameter,
                roughness,
                slope
            );


        if (
            q < Q
        ) {

            low = mid;

        } else {

            high = mid;
        }
    }


    return (
        low +
        high
    ) / 2;
}


function criticalDepth(
    Q,
    diameter
) {

    if (
        Q <= 0 ||
        diameter <= 0
    ) {
        return 0;
    }


    let low = 0.000001;

    let high =
        diameter;


    for (
        let i = 0;
        i < 80;
        i++
    ) {

        const y =
            (
                low +
                high
            ) / 2;


        const g =
            circularGeometry(
                y,
                diameter
            );


        if (
            g.area <= 0 ||
            g.topWidth <= 0
        ) {
            low = y;
            continue;
        }


        /*
         * Fr^2 = Q² T / (g A³)
         */

        const Fr2 =
            (
                Q * Q *
                g.topWidth
            ) /
            (
                9.81 *
                Math.pow(
                    g.area,
                    3
                )
            );


        if (
            Fr2 > 1
        ) {

            low = y;

        } else {

            high = y;
        }
    }


    return (
        low +
        high
    ) / 2;
}
