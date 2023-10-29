import {assert} from "chai"
import { GraphDatabasePort } from "../src";

export function graphTest(db: GraphDatabasePort) {
    describe("graph structure", async function() {
        it("should create two nodes and a link between them", async function() {
            await db.clearGraph();

            const nodeA = await db.setNode({
                id: await db.generateNodeId(),
                labels: ["SOME_NODE_TYPE_A"],
                properties: {}
            });

            const nodeB = await db.setNode({
                id: await db.generateNodeId(),
                labels: ["SOME_NODE_TYPE_B"],
                properties: {}
            });

            const beforeGraph = await db.readGraph();
            assert(beforeGraph.nodes.length === 2, "Should only be two nodes!");

            await db.setLink({
                id: await db.generateLinkId(),
                label: "TEST",
                properties: {},
                source: nodeA.id,
                target: nodeB.id
            });

            const afterGraph = await db.readGraph();
            console.log(afterGraph.nodes);

            assert(afterGraph.links.length === 1, "Should only be one link!");
            assert(afterGraph.nodes.length === 2, "Should only be two nodes!");
            
        })
    });

}