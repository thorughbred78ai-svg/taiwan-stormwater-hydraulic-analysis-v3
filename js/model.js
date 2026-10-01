const V3 = {

    project: {
        name:
            "台灣雨水下水道數值水理分析 V3",

        returnPeriod: 10,

        rainfallIntensity: 100,

        minVelocity: 0.8,

        maxVelocity: 3.0,

        maxIteration: 100
    },

    nodes: [],

    pipes: [],

    hydrology: {},

    hydraulic: [],

    checking: [],

    profile: [],

    solver: {

        converged: false,

        iterations: 0,

        residual: Infinity

    }

};


function getProjectSettings() {

    V3.project.name =
        document
            .getElementById(
                "projectName"
            ).value;

    V3.project.returnPeriod =
        Number(
            document
                .getElementById(
                    "returnPeriod"
                ).value
        );

    V3.project.rainfallIntensity =
        Number(
            document
                .getElementById(
                    "rainfallIntensity"
                ).value
        );

    V3.project.minVelocity =
        Number(
            document
                .getElementById(
                    "minVelocity"
                ).value
        );

    V3.project.maxVelocity =
        Number(
            document
                .getElementById(
                    "maxVelocity"
                ).value
        );

    V3.project.maxIteration =
        Number(
            document
                .getElementById(
                    "maxIteration"
                ).value
        );

    return V3.project;
}


function resetResults() {

    V3.hydrology = {};

    V3.hydraulic = [];

    V3.checking = [];

    V3.profile = [];

    V3.solver = {

        converged: false,

        iterations: 0,

        residual: Infinity
    };

    document.getElementById(
        "analysisResult"
    ).innerHTML = "";

    document.getElementById(
        "checkingResult"
    ).innerHTML = "";

    document.getElementById(
        "hydrologyResult"
    ).innerHTML = "";

    drawEmptyProfile();
}
