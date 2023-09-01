import { TLink } from "./link"
import { TNode } from "./node"

export type TGraph = {
    nodes: Array<TNode>,
    links: Array<TLink>
}

export type TCypherQuery = string;