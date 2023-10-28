import { GraphDatabasePort } from ".."
import { TReferencedLink } from "../schema/link"
import { Link } from "./link"
import { Node } from "./node"

export class GraphLink implements TReferencedLink {
    readonly source
    readonly target
    readonly id
    readonly label
    readonly properties
    readonly #graph
    constructor(graph: Graph, link: Link) {
        this.id = link.id;
        this.label = link.label;
        this.properties = link.properties;
        const source = graph.nodes.find((n)=>n.id === link.source);
        const target = graph.nodes.find((n)=>n.id === link.target);
        if (!source || !target) {
            throw GraphDatabasePort.errors.graphLinkParseFail;
        }
        this.source = source;
        this.target = target;
        this.#graph = graph;
    } 
}

export class GraphNode {
    readonly id
    readonly labels
    readonly properties
    readonly #graph
    constructor(graph: Graph, node: Node) {
        this.id = node.id;
        this.labels = node.labels;
        this.properties = node.properties;
        this.#graph = graph;
    }
}

export class Graph {
    readonly db: GraphDatabasePort
    readonly nodes: GraphNode[]
    readonly links: GraphLink[]
    constructor(db: GraphDatabasePort, nodes: Node[], links: Link[]) {
        this.db = db;
        this.nodes = nodes.map((n)=>new GraphNode(this, n));
        this.links = links.map((l)=>new GraphLink(this, l));
    }
}
