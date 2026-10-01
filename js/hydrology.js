function rationalQ(
    C,
    I,
    areaHa
) {

    if (
        C <= 0 ||
        I <= 0 ||
        areaHa <= 0
    ) {
        return 0;
    }

    return (
        0.278 *
        C *
        I *
        areaHa
    );
}


function runHydrology() {

    getProjectSettings();

    const localQ = {};

    V3.nodes.forEach(
        node => {

            localQ[node.id] =
                rationalQ(
                    node.C,
                    V3.project
                        .rainfallIntensity,
                    node.area
                );
        }
    );


    V3.hydrology = {

        localQ,

        timestamp:
            new Date()
                .toISOString()
    };


    renderHydrology();
}


function renderHydrology() {

    const box =
        document.getElementById(
            "hydrologyResult"
        );

    let html = `
    <div class="result-card">

    <h3>節點逕流量</h3>

    <table>

    <thead>
    <tr>
        <th>節點</th>
        <th>面積 ha</th>
        <th>C</th>
        <th>I mm/hr</th>
        <th>Q m³/s</th>
    </tr>
    </thead>

    <tbody>
    `;


    V3.nodes.forEach(
        n => {

            const Q =
                V3.hydrology
                    .localQ[n.id] || 0;

            html += `
            <tr>

                <td>${n.id}</td>

                <td>${n.area}</td>

                <td>${n.C}</td>

                <td>
                    ${V3.project
                        .rainfallIntensity}
                </td>

                <td>
                    ${Q.toFixed(4)}
                </td>

            </tr>
            `;
        }
    );


    html += `
    </tbody>
    </table>

    </div>
    `;

    box.innerHTML = html;
}
