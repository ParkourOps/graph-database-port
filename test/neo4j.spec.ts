import { Neo4jAdapter } from "../src";
import { adapterTest } from "./adapter-test";

if (!process.env?.NEO4J_URL || !process.env?.NEO4J_USERNAME || !process.env?.NEO4J_PASSWORD) {
    throw Error("Neo4j test environment not set.");
}

const adapter = new Neo4jAdapter(process.env.NEO4J_URL, process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD);
adapterTest(adapter);