import {expect} from "chai"
import { GraphDatabasePort } from "../src";
import { generateRandomCorrectNodeLabels, generateRandomIncorrectNodeLabels, generateRandomProps } from "./helpers/random-gen-functs";

export function _adapterTest(iteration: number, db: GraphDatabasePort) {
    describe(`iteration # ${iteration}...`, async function(){

        it("Should create a node with no labels and no properties, and be able to read it using the Id alone", async function() {
            const createResult = await db.createNode([], {});
            expect(createResult.success).to.equal(true);
            // ensure no labels
            expect(createResult.data?.labels).to.have.length(0);
            // ensure only id property
            expect(Object.entries(createResult.data?.properties ?? {}).length).to.equal(1);
            expect(createResult.data?.properties).to.have.property("_id_").to.be.a("string");
        }).timeout("2m");

        it("Should be able to create a node with labels (allowed chars)", async function() {
            const labels = generateRandomCorrectNodeLabels();
            const createResult = await db.createNode(labels, {});
            expect(createResult.success).to.equal(true);
            expect(createResult.data?.labels.length).length.to.equal(labels.length);
        }).timeout("2m");

        it("Should NOT be able to create a node with labels (disallowed chars)", async function() {
            const labels = generateRandomIncorrectNodeLabels();
            const createResult = await db.createNode(labels, {});
            expect(createResult.error).to.equal(true);
        }).timeout("2m");

        it("Should be able to create a node with no labels and props", async function() {
            const props = generateRandomProps();
            const createResult = await db.createNode([], props);
            expect(createResult.success).to.equal(true);
        }).timeout("2m");

        it("Should be able to create a node with labels and props", async function() {
            const labels = generateRandomCorrectNodeLabels();
            const props = generateRandomProps();
            const createResult = await db.createNode(labels, props);
            expect(createResult.success).to.equal(true);
        }).timeout("2m");

    });
}

export function adapterTest(db: GraphDatabasePort, repeat: number = 2) {
    after(async function(){
        await db.close();
    })
    describe(`Repeating test ${repeat} times for ${db.name} adapter...`, function() {
        for (let i=0; i<repeat; ++i) {
            _adapterTest(i+1, db);
        };
    });
}