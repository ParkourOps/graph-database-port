import { TCypherQuery } from "./schema/graph";
import { TNodeLabels, TNodeProperties, TNodeSpec } from "./schema/node";
import { TLinkLabel, TLinkProperties, TLinkUpdateSpec } from "./schema/link";
import { TGraphDatabaseResultSpec } from "./schema/db-result";
import { Link } from "./classes/link";
import { Graph } from "./classes/graph";
import { Node } from "./classes/node"

const errors = {
    "nodeNotFound": new Error("could not find node."),
    "nodeParseFail": new Error("failed to parse raw data as node."),
    "unrecognisedArg": (key: string, val: unknown) => new Error(`unrecognised argument, ${key}: ${val} (${typeof val})`),
    "connectionClosed": new Error("connection is closed"),
} as const;

export abstract class GraphDatabasePort {
    static readonly errors = errors;
    readonly name: string
    constructor(name: string) {
        this.name = name;
    }

    // create a new node with the specified labels and props
    abstract createNode(labels: TNodeLabels, properties: TNodeProperties): Promise<TGraphDatabaseResultSpec<"Node created.", "Could not create node.", Node>>
    
    // update node labels by unique id
    abstract updateNodeLabels(id: string, labels: TNodeLabels, mode: "put" | "patch") : Promise<TGraphDatabaseResultSpec<"Node labels updated.", "Could not update node labels.", Node>>

    // update node props by unique id
    abstract updateNodeProperties(id: string, properties: TNodeProperties, mode: "put" | "patch") : Promise<TGraphDatabaseResultSpec<"Node properties updated.", "Could not update node properties.", Node>>

    // delete node by unique id, including relationships
    abstract deleteNode(id: string) : Promise<TGraphDatabaseResultSpec<"Node deleted.", "Could not delete node.", null>>
    
    // delete note by specified labels and props
    // abstract deleteNodeBySpec(spec: TNodeSpec) : Promise<TGraphDatabaseResultSpec<"Node deleted.", "Could not delete node.", null>>

    // read node by unique id
    abstract readNode(id: string, throwError: boolean) : Promise<TGraphDatabaseResultSpec<"Node found." | "Node not found.", "Could not read node." | "Could not find node.", Node | undefined>>

    // // create a new link between two nodes (indicated by unique id) with the specified label and props
    // abstract createLink(sourceNodeId: string, targetNodeId: string, label: TLinkLabel, properties: TLinkProperties): Promise<TGraphDatabaseResultSpec<"Link created.", "Could not create link.", Link>>

    // // update link by unique id as indicated by spec
    // abstract updateLink(id: string, spec: TLinkUpdateSpec): Promise<TGraphDatabaseResultSpec<"Link updated.", "Could not update link.", Link>>

    // // delete link by unique id
    // abstract deleteLink(id: string): Promise<TGraphDatabaseResultSpec<"Link deleted.", "Could not delete link.", null>>

    // // read link by unique id
    // abstract readLink(id: string): Promise<TGraphDatabaseResultSpec<"Link found.", "Could not find link.", Link | undefined>>

    // // query graph using Cypher
    // abstract queryGraph(query: TCypherQuery): Promise<TGraphDatabaseResultSpec<"Graph fetched.", "Could not query graph.", Graph>>

    // get a fresh, unused id for a node
    abstract generateNodeId() : Promise<TGraphDatabaseResultSpec<"New Id generated.", "Could not generate new Id.", string>>;

    // permanently close the connection
    abstract close() : Promise<void>
}

export { Node } from "./classes/node";