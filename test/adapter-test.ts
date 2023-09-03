import {assert, expect} from "chai"
import { GraphDatabasePort } from "../src";
import { generateRandomCorrectNodeLabels, generateRandomIncorrectNodeLabels, generateRandomProps } from "./helpers/random-gen-functs";
import isObjEqual from "lodash.isequal";
import consts from "../src/consts";

export const TIMEOUT_DURATION = consts.TEST_FUNCT_TIMEOUT_DURATION;

export function _adapterTest(iteration: number, db: GraphDatabasePort) {
    describe(`iteration # ${iteration}...`, async function(){

        it("Should create a node with no labels and no properties, and be able to read it using the Id alone", async function() {
            const result = await db.setNode({
                id: await db.generateNodeId(),
                labels: [],
                properties: {}
            });
            // ensure type
            expect(result).to.be.an("object");
            // ensure no labels
            expect(result.labels).to.have.length(0);
            // ensure only id property
            expect(Object.entries(result.properties)).to.have.length(1);
            expect(result.properties).to.have.property("_id_").to.be.a("string");
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to create a node with just labels (allowed chars)", async function() {
            // generate labels
            const labels = generateRandomCorrectNodeLabels();
            // create
            const result = await db.setNode({
                id: await db.generateNodeId(),
                labels,
                properties: {}
            });
            // ensure type
            expect(result).to.be.an("object");
            // ensure labels
            expect(result.labels).to.have.length(labels.length);
            // ensure only id property
            expect(Object.entries(result.properties)).to.have.length(1);
            expect(result.properties).to.have.property("_id_").to.be.a("string");            
        }).timeout(TIMEOUT_DURATION);

        it("Should NOT be able to create a node with just labels (disallowed chars)", async function() {
            const labels = generateRandomIncorrectNodeLabels();
            try {
                await db.setNode({
                    id: await db.generateNodeId(),
                    labels,
                    properties: {}
                })
            } catch (e: any) {
                expect(e).to.be.an("error");
                expect(e.message).to.equal(GraphDatabasePort.errors.writeError.message);
            }
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to create a node with just props", async function() {
            const props = generateRandomProps();
            const result = await db.setNode({
                id: await db.generateNodeId(),
                labels: [],
                properties: props
            });
            expect(result).to.be.an("object");
            expect(isObjEqual(result.properties, props)).to.equal(true);
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to create a node with labels and props", async function() {
            const labels = generateRandomCorrectNodeLabels();
            const props = generateRandomProps();
            const result = await db.setNode({
                id: await db.generateNodeId(),
                labels,
                properties: props
            });
            expect(result).to.be.an("object");
            expect(result.labels).to.have.length(labels.length);
            expect(isObjEqual(result.properties, props)).to.equal(true);
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to delete a node by Id", async function() {
            const nodeId = await db.generateNodeId();
            const createdNode = await db.setNode({
                id: nodeId,
                labels: ["TEST"],
                properties: {}
            });
            const readNode = await db.readNode(nodeId);
            if (!readNode) assert.fail();
            const deletedNode = await db.deleteNode(nodeId);
            if (!deletedNode) assert.fail();
            expect(createdNode.id).to.equal(readNode.id).to.equal(deletedNode.id);
            const readDeletedNode = await db.readNode(nodeId);
            expect(readDeletedNode).to.be.a("undefined");
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to set a node in place of another", async function() {
            const id = await db.generateNodeId();
            const startLabels = generateRandomCorrectNodeLabels();
            const startProps = generateRandomProps();
            const endLabels = generateRandomCorrectNodeLabels();
            const endProps = generateRandomProps();

            await db.setNode({
                id,
                labels: startLabels,
                properties: startProps
            });

            await db.setNode({
                id,
                labels: endLabels,
                properties: endProps
            });

            const readNode = await db.readNode(id);
            if (!readNode) assert.fail();

            expect(readNode).to.be.a("object");
            expect(readNode.id).to.equal(id);
            expect(readNode.labels.length).to.equal(endLabels.length);
            expect(isObjEqual(readNode.properties, endProps)).to.equal(true);
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to append to a node, ignoring any overlap in arguments", async function() {
            const id = await db.generateNodeId();
            const labels = generateRandomCorrectNodeLabels(0, consts.MAX_NUM_NODE_LABELS-3);
            const props = generateRandomProps();

            await db.setNode({
                id,
                labels: labels,
                properties: props
            });

            // label only
            const patchedNode1 = await db.patchNode(id, {
                labels: ["test_label", "test_label_2"]
            });
            if (!patchedNode1) assert.fail();
            expect(patchedNode1.labels.length).to.equal(labels.length + 2);
            expect(patchedNode1.labels).to.contain("test_label", "test_label_2");
            expect(isObjEqual(patchedNode1.properties, props)).to.equal(true);

            // props only
            const patchedNode2 = await db.patchNode(id, {
                properties: {
                    prop1: "xyz",
                    prop2: 123
                }
            });
            if (!patchedNode2) assert.fail();
            expect(patchedNode2.labels.length).to.equal(labels.length + 2);
            expect(patchedNode2.properties).to.have.property("prop1");
            expect(patchedNode2.properties).to.have.property("prop2");
            expect(patchedNode2.properties.prop1).to.equal("xyz");
            expect(patchedNode2.properties.prop2).to.equal(123);

            // label and props
            const patchedNode3 = await db.patchNode(id, {
                labels: ["test_label_3"],
                properties: {
                    prop3: ["a", "b", "c"]
                }
            })
            if (!patchedNode3) assert.fail();
            
            const readNode = await db.readNode(id);
            if (!readNode) assert.fail();
            expect(isObjEqual(readNode.properties, patchedNode3.properties)).to.equal(true);
            expect(readNode.labels.length).to.equal(labels.length + 3);
            expect(Object.entries(readNode.properties).length).to.equal(Object.entries(props).length + 3);
        }).timeout(TIMEOUT_DURATION)

        it("Should delete all connected links to a node, when the node is deleted", async function(){
            const sourceNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const targetNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const link = await db.setLink({
                id: await db.generateLinkId(),
                label: "TEST",
                properties: generateRandomProps(),
                source: sourceNode.id,
                target: targetNode.id
            });
            if (!link) assert.fail();
            const readLinkBefore = await db.readLink(link.id);
            expect(readLinkBefore).to.be.an("object");
            await db.deleteNode(sourceNode.id);
            const readLinkAfter = await db.readLink(link.id);
            expect(readLinkAfter).to.be.a("undefined");
        }).timeout(TIMEOUT_DURATION);

        it("Should only delete the link when deleted, not the nodes it connects", async function() {
            const sourceNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const targetNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const link = await db.setLink({
                id: await db.generateLinkId(),
                label: "TEST",
                properties: generateRandomProps(),
                source: sourceNode.id,
                target: targetNode.id
            });
            if (!link) assert.fail();
            const readLinkBefore = await db.readLink(link.id);
            const readSourceBefore = await db.readNode(sourceNode.id);
            const readTargetBefore = await db.readNode(targetNode.id);            
            expect(readLinkBefore).to.be.a("object");
            expect(readSourceBefore).to.be.an("object");
            expect(readTargetBefore).to.be.an("object");
            await db.deleteLink(link.id);
            const readLinkAfter = await db.readLink(link.id);
            const readSourceAfter = await db.readNode(sourceNode.id);
            const readTargetAfter = await db.readNode(targetNode.id);
            expect(readLinkAfter).to.be.a("undefined");
            expect(readSourceAfter).to.be.an("object");
            expect(readTargetAfter).to.be.an("object");
        }).timeout(TIMEOUT_DURATION);


        it("Should patch a link with a new label", async function(){
            const sourceNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const targetNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const link = await db.setLink({
                id: await db.generateLinkId(),
                label: "TEST",
                properties: generateRandomProps(),
                source: sourceNode.id,
                target: targetNode.id
            });
            if (!link) assert.fail();
            await db.patchLink(link.id, {
                label: "TEST_A"
            });
            const readLinkAfter = await db.readLink(link.id);
            if (!readLinkAfter) assert.fail();
            expect(readLinkAfter.label).to.equal("TEST_A");
        }).timeout(TIMEOUT_DURATION);


        it("Should patch a link with new props", async function(){
            const sourceNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const targetNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const link = await db.setLink({
                id: await db.generateLinkId(),
                label: "TEST",
                properties: generateRandomProps(),
                source: sourceNode.id,
                target: targetNode.id
            });
            if (!link) assert.fail();
            await db.patchLink(link.id, {
                properties: {
                    favourite_condiment: "balsamic vinegar"
                }
            })
            const readLinkAfter = await db.readLink(link.id);
            if (!readLinkAfter) assert.fail();
            expect(readLinkAfter.label).to.equal(link.label);
            expect(readLinkAfter.properties).to.have.property("favourite_condiment");
            expect(readLinkAfter.properties.favourite_condiment).to.equal("balsamic vinegar");
        }).timeout(TIMEOUT_DURATION);


        it("Should patch a link with new label and props", async function(){
            const sourceNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const targetNode = await db.setNode({
                id: await db.generateNodeId(),
                labels: generateRandomCorrectNodeLabels(),
                properties: generateRandomProps()
            });
            const link = await db.setLink({
                id: await db.generateLinkId(),
                label: "TEST",
                properties: generateRandomProps(),
                source: sourceNode.id,
                target: targetNode.id
            });
            if (!link) assert.fail();
            await db.patchLink(link.id, {
                label: "ABC_XYZ",
                properties: {
                    favourite_condiment: "balsamic vinegar"
                }
            })
            const readLinkAfter = await db.readLink(link.id);
            if (!readLinkAfter) assert.fail();
            expect(readLinkAfter.label).to.equal("ABC_XYZ");
            expect(readLinkAfter.properties).to.have.property("favourite_condiment");
            expect(readLinkAfter.properties.favourite_condiment).to.equal("balsamic vinegar");            
        }).timeout(TIMEOUT_DURATION);

        it("Should be able to fetch all nodes and links when graph is queried (no args)", async function() {
            const graph = await db.queryGraph();
            // console.debug("NODES");
            // console.debug(graph.nodes);
            // console.debug("LINKS");
            // console.debug(graph.links);
            expect(graph.nodes.length).to.be.greaterThan(0);
            expect(graph.links.length).to.be.greaterThan(0);
        }).timeout(TIMEOUT_DURATION);
    });
}

export function adapterTest(db: GraphDatabasePort, repeat: number = 1) {
    after(async function(){
        await db.close();
    })
    describe(`Repeating test ${repeat} times for ${db.name} adapter...`, function() {
        for (let i=0; i<repeat; ++i) {
            _adapterTest(i+1, db);
        }
    });
}