import { TNode, TNodeDelta } from "./schema/node";
import { TLink, TLinkDelta } from "./schema/link";
import { Link } from "./classes/link";
import { Graph } from "./classes/graph";
import { Node } from "./classes/node"

export type TCypherQuery = {
    text: string,
    type: "write" | "read"
};

const errors = {
    "nodeFetchFail": new Error("could not retrieve expected node."),
    "linkFetchFail": new Error("could not retrieve expected link."),
    "nodeParseFail": new Error("failed to parse raw data as node."),
    "linkParseFail": new Error("failed to parse raw data as link."),
    "connectionClosed": new Error("connection is closed."),
    "writeError": new Error("write error, see log."),
    "readError": new Error("read error, see log."),
    "graphParseFail": new Error("could not parse graph.")
} as const;

export abstract class GraphDatabasePort {
    static readonly errors = errors;
    readonly name: string
    constructor(name: string) {
        this.name = name;
    }

    abstract setNode(node: TNode): Promise<Node>
    // abstract setNodes(nodes: TNode[]): Promise<Node[]>

    abstract readNode(id: string): Promise<Node | undefined>
    // abstract readNodes(selector: TNodeSelector): Promise<Node[]>

    abstract patchNode(id: string, delta: TNodeDelta): Promise<Node | undefined>
    // abstract patchNodes(selector: TNodeSelector, delta: TNodeDelta): Promise<Node[]>

    // Note: must also delete connected links.
    abstract deleteNode(id: string) : Promise<Node | undefined>
    // abstract deleteNodes(selector: TNodeSelector): Promise<Node[]>

    abstract setLink(link: TLink) : Promise<Link | undefined>
    // abstract setLinks(links: TLink[]) : Promise<TLink[]>

    abstract readLink(id: string) : Promise<Link | undefined>
    // abstract readLinks(selector: TLinkSelector): Promise<TLink[]>

    abstract patchLink(id: string, delta: TLinkDelta): Promise<Link>
    // abstract patchLinks(selector: TLinkSelector, delta: TLinkDelta): Promise<Link[]>

    abstract deleteLink(id: string): Promise<Link | undefined>
    // abstract deleteLinks(selector: TLinkSelector): Promise<Link[]>

    abstract queryGraph(query?: TCypherQuery): Promise<Graph>

    abstract checkNodeExists(id: string) : Promise<boolean>
    abstract checkLinkExists(id: string) : Promise<boolean>

    // get a fresh, unused id to create a new node
    abstract generateNodeId() : Promise<string>
    
    // get a fresh, unused id to create a new link
    abstract generateLinkId() : Promise<string>

    // permanently close the connection
    abstract close() : Promise<void>
}

export { Node } from "./classes/node";