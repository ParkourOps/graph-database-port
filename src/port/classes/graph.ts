import { TGraph } from "../schema/graph"

export class Graph implements TGraph {
    nodes
    links
    constructor(graph?: TGraph) {
        this.nodes = graph?.nodes ?? [],
        this.links = graph?.links ?? []
    }
}
