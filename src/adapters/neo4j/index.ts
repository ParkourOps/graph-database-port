import { GraphDatabasePort, Node } from "../../port"
import neo4j, { RecordShape, Session, ManagedTransaction, Driver } from "neo4j-driver";
import { TransactionConfig } from "neo4j-driver-core";
import { TGraphDatabaseResultSpec, createGraphDatabaseErrorResult } from "../../port/schema/db-result";
import { SNeo4jLink, SNeo4jNode } from "./schema";
import { stringifyLabels, stringifyProps } from "../../utils/cypher-string-functs";
import {generateNodeId, generateLinkId} from "../../utils/random-gen-functs"
import { TNodeDelta } from "../../port/schema/node";
import { Link } from "../../port/classes/link";

type ManagedTransactionWork<T> = (tx: ManagedTransaction) => Promise<T> | T;

type Query = {
    text: string,
    parameters?: any;
}

function parseRawNodeData(n?: unknown) {
    if (!n) throw GraphDatabasePort.errors.nodeFetchFail;
    else {
        const parseResult = SNeo4jNode.safeParse(n);
        if (!parseResult.success) {
            console.error("Failed to parse node:", n);
            console.error(parseResult.error);
            throw GraphDatabasePort.errors.nodeParseFail;
        }
        else {
            return parseResult.data;
        }
    }
}

function parseRawLinkData(l?: unknown) {
    if (!l) throw GraphDatabasePort.errors.linkFetchFail;
    else {
        const parseResult = SNeo4jLink.safeParse(l);
        if (!parseResult.success) {
            console.error("Failed to parse link:", l);
            console.error(parseResult.error);
            throw GraphDatabasePort.errors.linkParseFail;
        }
        else {
            return parseResult.data;
        }
    }
}

export class Neo4jAdapter extends GraphDatabasePort {
    #driver: Driver
    #closed: boolean
    #createNewSession: ()=>Session

    constructor(url: string, username: string, password: string) {
        super("Neo4j");
        this.#closed = true;
        this.#driver = neo4j.driver(
            url, 
            neo4j.auth.basic(username, password), 
            {
                // disable returning ({low, high}), instead, favour JS-native number type.
                // see: https://github.com/neo4j/neo4j-javascript-driver#numbers-and-the-integer-type            
                disableLosslessIntegers: true
            });
        this.#closed = false;
        console.debug("driver created.");
        this.#createNewSession = () => {
            const session = this.#driver.session();
            console.debug("session created")
            return session;
        };
    }

    async #writeQuery<TReturn extends RecordShape>(query: Query, config?: TransactionConfig) {
        if (this.#closed) {
            throw GraphDatabasePort.errors.connectionClosed 
        }
        const session = this.#createNewSession();
        try {
            return await session.executeWrite((tx)=>tx.run<TReturn>(query), config);
        }
        catch (e) {
            console.error(e);
            throw GraphDatabasePort.errors.writeError;
        }
        finally {
            await session.close();
            console.debug("session closed");
        }
    }

    async #readQuery<TReturn extends RecordShape>(query: Query, config?: TransactionConfig) {
        if (this.#closed) {
            throw GraphDatabasePort.errors.connectionClosed 
        }
        const session = this.#createNewSession();
        try {
            return await session.executeRead((tx)=>tx.run<TReturn>(query), config);
        }
        catch (e) {
            console.error(e);
            throw GraphDatabasePort.errors.readError;
        }
        finally {
            await session.close();
            console.debug("session closed");
        }
    }

    async setNode(node: { id: string; labels: string[]; properties: Record<string, unknown>; }): Promise<Node> {
        const nodeLabelsStr = stringifyLabels(node.labels);
        node.properties._id_ = node.id;
        const nodePropsStr = stringifyProps(node.properties);
        // create query
        const exists = await this.checkNodeExists(node.id);
        let query = "";
        if (!exists) {
            console.debug("creating new");
            query = `CREATE (n${nodeLabelsStr} ${nodePropsStr}) RETURN n`;
        } else {
            console.debug("replacing old");
            query = `MATCH (n {_id_:'${node.id}'}) `
                        + `CALL apoc.create.removeLabels(n, labels(n)) YIELD node AS m `
                        + `SET m${nodeLabelsStr} `
                        + `SET m = ${nodePropsStr}`
                        + `RETURN m as n`
        }
        // execute query
        const queryResult = await this.#writeQuery(({
            text: query
        }));
        const returnedNode = parseRawNodeData(queryResult.records?.[0]?.get("n"));
        return new Node({
            id: returnedNode.properties._id_,
            labels: returnedNode.labels,
            properties: returnedNode.properties            
        });
    }

    async deleteNode(id: string): Promise<Node | undefined> {
        const rawBeforeDelete = await this.readNode(id);
        if (!rawBeforeDelete) return;
        const queryResult = await this.#writeQuery({
            text: `MATCH (n {_id_:'${id}'}) OPTIONAL MATCH ()-[r]-(n) DELETE n, r RETURN n`
        });
        const raw = queryResult.records?.[0]?.get("n");
        if (!raw) return;
        // create and return deleted node
        return rawBeforeDelete;
    }

    async readNode(id: string): Promise<Node | undefined> {
        const queryResult = await this.#readQuery({
            text: `MATCH (n {_id_:'${id}'}) RETURN n`
        });
        const raw = queryResult.records?.[0]?.get("n");
        if (!raw) return;
        const node = parseRawNodeData(raw);
        return new Node({
            id: node.properties._id_,
            labels: node.labels,
            properties: node.properties                
        });  
    }

    async patchNode(id: string, delta: TNodeDelta): Promise<Node | undefined> {
        const exists = await this.checkNodeExists(id);
        if (!exists) return;
        // create query
        let query = `MATCH (n {_id_:'${id}'}) `;
        if (delta.labels) {
            const nodeLabelsStr = stringifyLabels(delta.labels);
            query += `SET n${nodeLabelsStr} `
        }
        if (delta.properties) {
            const nodePropsStr = stringifyProps(delta.properties);
            query += `SET n += ${nodePropsStr} `
        }
        query += `RETURN n`        
        // execute query
        const queryResult = await this.#writeQuery(({
            text: query
        }));
        const raw = queryResult.records?.[0]?.get("n");
        if (!raw) return;
        const returnedNode = parseRawNodeData(raw);
        return new Node({
            id: returnedNode.properties._id_,
            labels: returnedNode.labels,
            properties: returnedNode.properties            
        });                
    }

    async readLink(id: string) {
        const queryResult = await this.#readQuery({
            text: `MATCH (a)-[r {_id_:'${id}'}]->(b) RETURN *`
        });
        // get raw
        const rawLink = queryResult.records?.[0]?.get("r");
        const rawSource = queryResult.records?.[0]?.get("a");
        const rawTarget = queryResult.records?.[0]?.get("b");
        if (!rawLink || !rawSource || !rawTarget) return;
        // parse
        const link = parseRawLinkData(rawLink);
        const source = parseRawNodeData(rawSource);
        const target = parseRawNodeData(rawTarget);
        // create and return link
        return new Link({
            id: link.properties._id_,
            label: link.type,
            properties: link.properties,
            source: source.properties._id_,
            target: target.properties._id_
        })
    }

    async setLink(link: { id: string; label: string; properties: Record<string, unknown>; source: string; target: string; }): Promise<Link | undefined> {
        // cancel if source or target does not exist
        const sourceNode = await this.readNode(link.source);
        const targetNode = await this.readNode(link.target);
        if (!sourceNode || !targetNode) return;
        // check if link already exists, generate query accordingly
        const exists = await this.checkLinkExists(link.id);
        link.properties._id_ = link.id;
        const linkPropsStr = stringifyProps(link.properties);
        let query = "";
        if (exists) {
            console.debug("replacing old");
            // if so, update label and props
            query = `MATCH (a)-[r_old {_id_:'${link.id}'}]->(b) CREATE (a)-[r:${link.label} ${linkPropsStr}]->(b) DELETE r_old RETURN r, a, b`;
        } else {
            console.debug("creating new");
            // create new
            query = `CREATE (a {_id_:'${sourceNode.id}'})-[r:${link.label} ${linkPropsStr}]->(b {_id_:'${targetNode.id}'}) RETURN r, a, b`
        }
        // execute query
        const queryResult = await this.#writeQuery(({
            text: query
        }));
        const returnedLink = parseRawLinkData(queryResult.records?.[0]?.get("r"));
        const returnedSourceNode = parseRawNodeData(queryResult.records?.[0]?.get("a"));
        const returnedTargetNode = parseRawNodeData(queryResult.records?.[0]?.get("b"));
        return new Link({
            id: returnedLink.properties._id_,
            source: returnedSourceNode.properties._id_,
            target: returnedTargetNode.properties._id_,
            label: returnedLink.type,
            properties: returnedLink.properties
        })
    }
    
    async deleteLink(id: string): Promise<Link | undefined> {
        // get link before deletion
        const rawBeforeDelete = await this.readLink(id);
        if (!rawBeforeDelete) return;
        // generate query
        const queryResult = await this.#writeQuery({
            text: `MATCH (a)-[r {_id_:'${id}'}]->(b) DELETE r RETURN a, r, b`
        });
        // get raw
        const rawLink = queryResult.records?.[0]?.get("r");
        const rawSource = queryResult.records?.[0]?.get("a");
        const rawTarget = queryResult.records?.[0]?.get("b");
        if (!rawLink || !rawSource || !rawTarget) return;
        // create and return deleted link
        return rawBeforeDelete;
    }

    async checkNodeExists(id: string) {
        const node = await this.readNode(id);
        return (!!node);
    }

    async checkLinkExists(id: string) {
        const link = await this.readLink(id);
        return (!!link);
    }

    async generateNodeId(): Promise<string> {
        let id : string = generateNodeId();
        let exists = await this.checkNodeExists(id);
        while (exists) {
            id = generateNodeId();
        }
        return id;
    }

    async generateLinkId(): Promise<string> {
        let id : string = generateLinkId();
        let exists = await this.checkLinkExists(id);
        while (exists) {
            id = generateLinkId();
        }
        return id;
    }

    async close() {
        console.debug("driver closed.")
        await this.#driver.close();
        this.#closed=true;
    }
}