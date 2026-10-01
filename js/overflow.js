/**
 * V3 Node Surcharge / Overflow
 */

function checkNodeSurcharge(
    nodeEnergy
) {

    const results = [];


    nodes.forEach(
        node => {

            const e =
                nodeEnergy[
                    node.id
                ];

            if (!e) {

                results.push({

                    nodeId:
                        node.id,

                    HGL:
                        null,

                    ground:
                        node.ground,

                    surcharge:
                        false,

                    overflow:
                        false,

                    depth:
                        null
                });

                return;
            }


            const HGL =
                Number(
                    e.HGL
                );

            const ground =
                Number(
                    node.ground
                );

            const invert =
                Number(
                    node.invert
                );


            const waterDepth =
                HGL -
                invert;


            const surcharge =
                HGL >
                invert;


            const overflow =
                HGL >
                ground;


            results.push({

                nodeId:
                    node.id,

                HGL,

                ground,

                invert,

                depth:
                    waterDepth,

                surcharge,

                overflow,

                freeboard:
                    ground - HGL
            });
        }
    );


    return results;
}
