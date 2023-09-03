import { GraphDatabasePort } from "..";
import { SNode, TNode } from "../schema/node";

export class Node implements TNode {
    id
    labels
    properties
    constructor(node: TNode) {
        const nodeParseResult = SNode.safeParse(node);
        if (nodeParseResult.success) {
            this.id = nodeParseResult.data.id;
            this.labels = nodeParseResult.data.labels;
            this.properties = nodeParseResult.data.properties;
        } else {
            console.error("Failed to parse node:", node);
            console.error(JSON.stringify(nodeParseResult.error));
            throw GraphDatabasePort.errors.nodeParseFail;
        }
    }
}
