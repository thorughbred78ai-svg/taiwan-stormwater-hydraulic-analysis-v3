function addNode(data = {}) {

    V3.nodes.push({

        id:
            data.id ||
            `N${V3.nodes.length + 1}`,

        ground:
            Number(
                data.ground ?? 100
            ),

        invert:
            Number(
                data.invert ?? 99
            ),

        area:
            Number(
                data.area ?? 0
            ),

        C:
            Number(
                data.C ?? 0.7
            ),

        boundaryType:
            data.boundaryType ||
            "none",

        boundaryElevation:
            Number(
                data.boundaryElevation ?? 0
            )
    });

    renderNodes();
}


function removeNode(i) {

    V3.nodes.splice(i, 1);

    renderNodes();
}


function renderNodes() {

    const tbody =
        document.querySelector(
            "#nodeTable tbody"
        );

    tbody.innerHTML = "";

    V3.nodes.forEach(
        (n, i) => {

            tbody.innerHTML += `

            <tr>

            <td>
                <input
                    value="${n.id}"
                    onchange="
                    V3.nodes[${i}].id=this.value;
                    renderPipes();
                    ">
            </td>

            <td>
                <input
                    type="number"
                    value="${n.ground}"
                    onchange="
                    V3.nodes[${i}].ground=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    value="${n.invert}"
                    onchange="
                    V3.nodes[${i}].invert=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.01"
                    value="${n.area}"
                    onchange="
                    V3.nodes[${i}].area=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.01"
                    value="${n.C}"
                    onchange="
                    V3.nodes[${i}].C=
                    Number(this.value)">
            </td>

            <td>
                <select
                    onchange="
                    V3.nodes[${i}].boundaryType=
                    this.value">

                    <option value="none"
                        ${n.boundaryType==="none"
                        ? "selected":""}>
                        無
                    </option>

                    <option value="fixed"
                        ${n.boundaryType==="fixed"
                        ? "selected":""}>
                        固定水位
                    </option>

                    <option value="free"
                        ${n.boundaryType==="free"
                        ? "selected":""}>
                        自由出流
                    </option>

                </select>
            </td>

            <td>
                <input
                    type="number"
                    value="${n.boundaryElevation}"
                    onchange="
                    V3.nodes[${i}]
                    .boundaryElevation=
                    Number(this.value)">
            </td>

            <td>

                <button
                    class="secondary"
                    onclick="
                    removeNode(${i})">
                    刪除
                </button>

            </td>

            </tr>

            `;
        }
    );
}


function addPipe(data = {}) {

    V3.pipes.push({

        id:
            data.id ||
            `P${V3.pipes.length + 1}`,

        from:
            data.from || "",

        to:
            data.to || "",

        length:
            Number(
                data.length ?? 100
            ),

        diameter:
            Number(
                data.diameter ?? 1
            ),

        slope:
            Number(
                data.slope ?? 0.005
            ),

        n:
            Number(
                data.n ?? 0.013
            ),

        inletK:
            Number(
                data.inletK ??
                data.K ??
                0
            ),

        outletK:
            Number(
                data.outletK ?? 0
            )
    });

    renderPipes();
}


function removePipe(i) {

    V3.pipes.splice(i, 1);

    renderPipes();
}


function renderPipes() {

    const tbody =
        document.querySelector(
            "#pipeTable tbody"
        );

    tbody.innerHTML = "";


    V3.pipes.forEach(
        (p, i) => {

            const options =
                V3.nodes
                .map(
                    n =>
                    `<option
                    value="${n.id}">
                    ${n.id}
                    </option>`
                )
                .join("");


            tbody.innerHTML += `

            <tr>

            <td>
                <input
                    value="${p.id}"
                    onchange="
                    V3.pipes[${i}].id=
                    this.value">
            </td>

            <td>
                <select
                    onchange="
                    V3.pipes[${i}].from=
                    this.value">

                    <option value="">
                    --
                    </option>

                    ${options}

                </select>
            </td>

            <td>
                <select
                    onchange="
                    V3.pipes[${i}].to=
                    this.value">

                    <option value="">
                    --
                    </option>

                    ${options}

                </select>
            </td>

            <td>
                <input
                    type="number"
                    value="${p.length}"
                    onchange="
                    V3.pipes[${i}].length=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.01"
                    value="${p.diameter}"
                    onchange="
                    V3.pipes[${i}].diameter=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.0001"
                    value="${p.slope}"
                    onchange="
                    V3.pipes[${i}].slope=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.001"
                    value="${p.n}"
                    onchange="
                    V3.pipes[${i}].n=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.01"
                    value="${p.inletK}"
                    onchange="
                    V3.pipes[${i}].inletK=
                    Number(this.value)">
            </td>

            <td>
                <input
                    type="number"
                    step="0.01"
                    value="${p.outletK}"
                    onchange="
                    V3.pipes[${i}].outletK=
                    Number(this.value)">
            </td>

            <td>
                <button
                    class="secondary"
                    onclick="
                    removePipe(${i})">
                    刪除
                </button>
            </td>

            </tr>

            `;
        }
    );
}


function findNode(id) {

    return V3.nodes.find(
        n => n.id === id
    );
}


function buildNetwork() {

    const incoming = {};

    const outgoing = {};

    V3.nodes.forEach(
        n => {

            incoming[n.id] = [];

            outgoing[n.id] = [];
        }
    );


    V3.pipes.forEach(
        p => {

            if (
                incoming[p.to]
            ) {
                incoming[p.to]
                    .push(p);
            }

            if (
                outgoing[p.from]
            ) {
                outgoing[p.from]
                    .push(p);
            }
        }
    );


    return {

        incoming,

        outgoing
    };
}


function topologicalOrder() {

    const network =
        buildNetwork();

    const indegree = {};

    V3.nodes.forEach(
        n => {

            indegree[n.id] =
                network
                    .incoming[n.id]
                    .length;
        }
    );


    const queue =
        V3.nodes
        .filter(
            n =>
                indegree[n.id] === 0
        )
        .map(
            n => n.id
        );


    const order = [];


    while (
        queue.length
    ) {

        const id =
            queue.shift();

        order.push(id);


        network
            .outgoing[id]
            .forEach(
                p => {

                    indegree[p.to]--;

                    if (
                        indegree[p.to] === 0
                    ) {
                        queue.push(
                            p.to
                        );
                    }
                }
            );
    }


    return order;
}


function accumulatedNodeFlow() {

    if (
        !V3.hydrology
            .localQ
    ) {
        runHydrology();
    }


    const network =
        buildNetwork();

    const order =
        topologicalOrder();


    const nodeQ = {};

    V3.nodes.forEach(
        n => {

            nodeQ[n.id] =
                V3.hydrology
                    .localQ[n.id] ||
                0;
        }
    );


    order.forEach(
        id => {

            network
                .outgoing[id]
                .forEach(
                    p => {

                        nodeQ[p.to] +=
                            nodeQ[p.from];
                    }
                );
        }
    );


    return nodeQ;
}
