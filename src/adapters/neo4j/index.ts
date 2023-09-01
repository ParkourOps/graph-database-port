import { GraphDatabasePort, Node } from "../../port"
import neo4j, { RecordShape, Session, ManagedTransaction, Driver } from "neo4j-driver";
import { TransactionConfig } from "neo4j-driver-core";
import { TGraphDatabaseResultSpec, createGraphDatabaseErrorResult } from "../../port/schema/db-result";
import { SNeo4jNode } from "./schema";
import { stringifyLabels, stringifyProps } from "../../utils/cypher-string-functs";
import {generateNodeId} from "../../utils/random-gen-functs"

type ManagedTransactionWork<T> = (tx: ManagedTransaction) => Promise<T> | T;

type Query = {
    text: string,
    parameters?: any;
}

function parseRawNodeData(n?: unknown) {
    if (!n) {
        throw GraphDatabasePort.errors.nodeNotFound;
    }
    else {
        const parseResult = SNeo4jNode.safeParse(n);
        if (!parseResult.success) {
            throw GraphDatabasePort.errors.nodeParseFail;
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
            throw e;
        }
        finally {
            await session.close();
            console.debug("session closed");
        }
    }

    async #readQuery<TReturn extends RecordShape>(query: Query, config?: TransactionConfig) {
        const session = this.#createNewSession();
        try {
            return await session.executeRead((tx)=>tx.run<TReturn>(query), config);
        }
        catch (e) {
            throw e; 
        }
        finally {
            await session.close();
            console.debug("session closed");
        }
    }
    
    async createNode(labels: string[], properties: Record<string, unknown>): Promise<TGraphDatabaseResultSpec<"Node created.", "Could not create node.", Node>> {
        try {
            // add id to props
            const idGenerationResult = await this.generateNodeId();
            properties._id_ = idGenerationResult.data;
            // generate and execute query
            const nodeLabelsStr = stringifyLabels(labels);
            const nodePropsStr = stringifyProps(properties);
            const queryResult = await this.#writeQuery({
                text: `CREATE (n${nodeLabelsStr} ${nodePropsStr}) RETURN n`
            });
            const nodesCreated = queryResult.summary.updateStatistics.updates().nodesCreated;
            if (nodesCreated !== 1) {
                throw new Error(`invalid 'nodesCreated' count from neo4j driver. Expected 1, got ${nodesCreated}.`)
            }
            const node = parseRawNodeData(queryResult.records?.[0]?.get("n"));
            // return
            return {
                success: true,
                error: false,
                userFriendlyMessage: "Node created.",
                data: new Node({
                    id: node.properties._id_,
                    labels: node.labels,
                    properties: node.properties,
                })
            }
        }
        catch (e) {
            return createGraphDatabaseErrorResult("Could not create node.", e);
        }   
    }

    async readNode(id: string, throwError: boolean): Promise<TGraphDatabaseResultSpec<"Node found." | "Node not found.", "Could not read node." | "Could not find node.", Node | undefined>> {
        try {
            const queryResult = await this.#readQuery({
                text: `MATCH (n {_id_:'${id}'}) RETURN n`
            });
            const node = parseRawNodeData(queryResult.records?.[0]?.get("n"));
            return {
                success: true,
                error: false,
                userFriendlyMessage: "Node found.",
                data: new Node({
                    id: node.properties._id_,
                    labels: node.labels,
                    properties: node.properties
                })
            }
        } catch (e) {
            if (e === GraphDatabasePort.errors.nodeNotFound && throwError) {
                return createGraphDatabaseErrorResult("Could not find node.", e);
            } 
            else if (e === GraphDatabasePort.errors.nodeNotFound && !throwError) {
                return {
                    success: true,
                    error: false,
                    userFriendlyMessage: "Node not found.",
                    data: undefined
                }
            }
            else {
                return createGraphDatabaseErrorResult("Could not read node.", e);
            }
        }        
    }

    async updateNodeLabels(id: string, labels: string[], mode: "put" | "patch"): Promise<TGraphDatabaseResultSpec<"Node labels updated.", "Could not update node labels.", Node>> {
        try {
            let query = `MATCH (n {_id_:'${id}'}) `
            const nodeLabelsStr = stringifyLabels(labels);
            // FORM THE QUERY
            // put
            if (mode === "put") {
                // delete existing labels
                query += `CALL apoc.create.removeLabels(n, labels(n)) YIELD node AS m `;
                // set new labels
                query += `SET m${nodeLabelsStr} `
                // return
                query += `RETURN m`
            }
            // patch
            else if (mode === "patch") {
                // set new labels
                query += `SET n${nodeLabelsStr} `
                // return
                query += `RETURN n`
            }
            else {
                throw GraphDatabasePort.errors.unrecognisedArg("mode", mode);
            }
            // EXECUTE THE QUERY
            const queryResult = await this.#writeQuery(({
                text: query
            }));
            const node = parseRawNodeData(queryResult.records?.[0]?.get("n"));
            // RETURN RESULT
            return {
                success: true,
                error: false,
                userFriendlyMessage: "Node labels updated.",
                data: new Node({
                    id: node.properties._id_,
                    labels: node.labels,
                    properties: node.properties
                })
            }
        } catch (e) {
            return createGraphDatabaseErrorResult("Could not update node labels.", e);
        }        
    }

    async updateNodeProperties(id: string, properties: Partial<Omit<{ id: string; labels: string[]; properties: Record<string, unknown>; }, "id">>, mode: "put" | "patch"): Promise<TGraphDatabaseResultSpec<"Node properties updated.", "Could not update node properties.", Node>> {
        try {
            let query = `MATCH (n {_id_:'${id}'}) `
            const nodePropsStr = stringifyProps(properties);
            // FORM THE QUERY
            if (mode === "put") {
                query += `SET n += ${nodePropsStr} `
            } else {
                query += `SET n = ${nodePropsStr} `
            }
            query += `RETURN n`
            // EXECUTE THE QUERY
            const queryResult = await this.#writeQuery({
                text: `MATCH (n {_id_:'${id}'} SET n${nodePropsStr} RETURN n`
            });
            const node = parseRawNodeData(queryResult.records?.[0]?.get("n"));
            // RETURN RESULT
            return {
                success: true,
                error: false,
                userFriendlyMessage: "Node properties updated.",
                data: new Node({
                    id: node.properties._id_,
                    labels: node.labels,
                    properties: node.properties
                })
            }
        } catch (e) {
            return createGraphDatabaseErrorResult("Could not update node properties.", e);
        }
    }
            
    async deleteNode(id: string): Promise<TGraphDatabaseResultSpec<"Node deleted.", "Could not delete node.", null>> {
        try {
            const queryResult = await this.#writeQuery({
                text: `MATCH (n {_id_:'${id}'}) DELETE n`
            });
            const nodesDeleted = queryResult.summary.counters.updates().nodesDeleted;
            if (nodesDeleted !== 1) {
                throw new Error(`invalid 'nodesDeleted' count from neo4j driver. Expected 1, got ${nodesDeleted}.`)
            }
            return {
                success: true,
                error: false,
                userFriendlyMessage: "Node deleted.",
                data: null
            }
        } catch (e) {
            return createGraphDatabaseErrorResult("Could not delete node.", e);
        }
    }

    async checkIdExists(id: string) {
        const readResult = await this.readNode(id, false);
        return (!!readResult.data);
    }

    async generateNodeId(): Promise<TGraphDatabaseResultSpec<"New Id generated.", "Could not generate new Id.", string>> {
        try {
            let id : string = generateNodeId();
            let exists = await this.checkIdExists(id);
            while (exists) {
                id = generateNodeId();
            }
            return {
                success: true,
                error: false,
                userFriendlyMessage: "New Id generated.",
                data: id
            }
        } catch (e) {
            return createGraphDatabaseErrorResult("Could not generate new Id.", e);
        }
    }

    async close() {
        console.debug("driver closed.")
        await this.#driver.close();
        this.#closed=true;
    }
}