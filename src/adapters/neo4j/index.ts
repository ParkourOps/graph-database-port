import { GraphDatabasePort, Node, TCypherQuery } from "../../port"
import neo4j, { RecordShape, Session, Driver, QueryResult } from "neo4j-driver";
import { TransactionConfig, Node as Neo4jNode, Relationship as Neo4jLink } from "neo4j-driver-core";
import { SNeo4jLink, SNeo4jNode } from "./schema";
import { stringifyLabels, stringifyProps } from "../../utils/cypher-string-functs";
import {generateNodeId, generateLinkId} from "../../utils/random-gen-functs"
import { TNode, TNodeDelta } from "../../port/schema/node";
import { Link } from "../../port/classes/link";
import { TLink, TLinkDelta } from "../../port/schema/link";
import { Graph } from "../../port/classes/graph";

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
            console.error(JSON.stringify(parseResult.error));
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
            console.error(JSON.stringify(parseResult.error));
            throw GraphDatabasePort.errors.linkParseFail;
        }
        else {
            return parseResult.data;
        }
    }
}

function tryParseNode(raw: any) {
    if (!raw) return;
    // try{
        return new Node({
            id: raw.properties._id_,
            labels: raw.labels,
            properties: raw.properties
        });
    // }
    // catch (e) {
    //     /* suppress any errors */
    //     return;
    // }
}

function tryParseLink(raw: any, source?: Node, target?: Node) {
    if (!raw) return;
    if (!source || !target) {
        console.error("Failed to parse link (source and/or target node not available):", {
            link: raw,
            source,
            target
        });
        return;
    }
    // try {
        return new Link({
            id: raw.properties._id_,
            label: raw.type,
            properties: raw.properties,
            source: source.id,
            target: target.id
        })
    // } catch (e) {
    //     /* suppress any errors */
    //     return;
    // }
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
            query = `CREATE (n${nodeLabelsStr} ${nodePropsStr}) RETURN n`;
        } else {
            query = `MATCH (n {_id_:'${node.id}'}) `
                        + `CALL apoc.create.removeLabels(n, labels(n)) YIELD node AS m `
                        + ((nodeLabelsStr.length > 0) ? `SET m${nodeLabelsStr} ` : ``)
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
        });
    }

    async setLink(link: { id: string; label: string; properties: Record<string, unknown>; source: string; target: string; }): Promise<Link | undefined> {
        // cancel if source or target does not exist
        const sourceNode = await this.readNode(link.source);
        const targetNode = await this.readNode(link.target);
        if (!sourceNode || !targetNode) return;
        
        // extract node labels - required to match the nodes
        const labelsSourceNode = stringifyLabels(sourceNode.labels);
        const labelsTargetNode = stringifyLabels(targetNode.labels);

        // check if link already exists, generate query accordingly
        const linkExists = await this.checkLinkExists(link.id);
        link.properties._id_ = link.id;
        const linkPropsStr = stringifyProps(link.properties);
        
        let query = "";
        if (linkExists) {
            // if so, update label and props
            query = `MATCH (a)-[r_old {_id_:'${link.id}'}]->(b) CREATE (a)-[r:${link.label} ${linkPropsStr}]->(b) DELETE r_old RETURN a, r, b`;
        } else {
            // create new
            query = `MATCH (a${labelsSourceNode} {_id_:"${sourceNode.id}"}), (b${labelsTargetNode} {_id_:"${targetNode.id}"}) CREATE (a)-[r:${link.label} ${linkPropsStr}]->(b) RETURN a, r, b`;
            // query = `MATCH (a {_id_:"${sourceNode.id}"}), (b {_id_:"${targetNode.id}"}) CREATE (a)-[r:${link.label} ${linkPropsStr}]->(b) RETURN a, r, b`;
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

    async patchLink(id: string, delta: TLinkDelta): Promise<Link> {
        const props = delta.properties ?? {};
        props._id_ = id;
        const linkPropsStr = stringifyProps(props);
        // create query
        let query = `MATCH (a)-[r {_id_:'${id}'}]->(b) `;
        if (delta.label) {
            // since we can't change label, we have to create a new link and delete the old one
            query += `DELETE r CREATE (a)-[r_new:${delta.label} ${linkPropsStr}]->(b) WITH a, r_new as r, b `;
        } else {
            query += `SET r = ${linkPropsStr} `;
        }
        query += `RETURN a, r, b`;
        // execute query
        const queryResult = await this.#writeQuery(({
            text: query
        }));
        // get raw
        const rawLink = queryResult.records?.[0]?.get("r");
        const rawSource = queryResult.records?.[0]?.get("a");
        const rawTarget = queryResult.records?.[0]?.get("b");        
        // parse
        const returnedLink = parseRawLinkData(rawLink);
        const returnedSource = parseRawNodeData(rawSource);
        const returnedTarget = parseRawNodeData(rawTarget);
        // create and return link
        return new Link({
            id: returnedLink.properties._id_,
            label: returnedLink.type,
            properties: returnedLink.properties,
            source: returnedSource.properties._id_,
            target: returnedTarget.properties._id_
        });
    }

    async readGraph(): Promise<Graph> {
        const q = {
            text: `MATCH (n) OPTIONAL MATCH (n)-[r]->(m) RETURN n, r, m`,
            type: "read"
        };
        const nodes : TNode[] = [];
        const links : TLink[] = [];
        let result : QueryResult<RecordShape> | undefined = undefined;
        if (q.type === "read") {
            result = await this.#readQuery({text: q.text});
        } else {
            result = await this.#writeQuery({text: q.text});
        }
        result.records.forEach((record)=>{
            const rawSourceNode = record.get("n");
            const rawTargetNode = record.get("m");
            const rawLink = record.get("r");
            const sourceNode = tryParseNode(rawSourceNode);
            const targetNode = tryParseNode(rawTargetNode);
            const link = tryParseLink(rawLink, sourceNode, targetNode);
            if (sourceNode && !nodes.find(n => n.id === sourceNode.id)) {
                nodes.push(sourceNode);
            }
            if (targetNode && !nodes.find(n => n.id === targetNode.id)) {
                nodes.push(targetNode);
            }
            if (link && !links.find(l => l.id === rawLink.id)) {
                links.push(link);
            }
        });
        return new Graph(this, nodes, links);
    }

    async clearGraph(): Promise<undefined> {
        await this.#writeQuery({
            text: `match (n) optional match ()-[r]-() delete r, n`
        });
    }

    async queryGraph(query: TCypherQuery): Promise<Graph> {
        const nodes : TNode[] = [];
        const links : TLink[] = [];
        let result : QueryResult<RecordShape> | undefined = undefined;
        if (query.type === "read") {
            result = await this.#readQuery({text: query.text});
        } else {
            result = await this.#writeQuery({text: query.text});
        }
        // parse nodes and links for each path (record)
        result.records.forEach((record)=>{
            const _record : any[] = Array.from(record.values());
            _record.forEach((item)=>{
                // if node
                if (item instanceof Neo4jNode) { // item.labels && Array.isArray(item.labels)
                    const node = tryParseNode(item);
                    if (node) {
                        nodes.push(node);
                    }
                }
                // if link
                if (item instanceof Neo4jLink) { // item.type && typeof item.type === "string"
                    const rawSourceNode = _record.find((i) => i.elementId === item.startNodeElementId);
                    const rawTargetNode = _record.find((i) => i.elementId === item.endNodeElementId);
                    const sourceNode = tryParseNode(rawSourceNode);
                    const targetNode = tryParseNode(rawTargetNode);
                    if (!sourceNode || !targetNode) return;
                    const link = tryParseLink(item, sourceNode, targetNode);
                    if (link) {
                        links.push(link);
                    }
                }
            })
        });
        return new Graph(this, nodes, links);
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
        const exists = await this.checkNodeExists(id);
        while (exists) {
            id = generateNodeId();
        }
        return id;
    }

    async generateLinkId(): Promise<string> {
        let id : string = generateLinkId();
        const exists = await this.checkLinkExists(id);
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