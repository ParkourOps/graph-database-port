import { TNode, SNode } from "../schema/node";

export class Node implements TNode {
    id
    labels
    properties
    constructor(node: TNode) {
        this.id = node.id;
        this.labels = node.labels;
        this.properties = node.properties;
    }
    toCypherString(reference: string) {
        const props = JSON.stringify(this.properties).replace(/"([^"]+)":/g, "$1:");
        return `()`
    }
}
