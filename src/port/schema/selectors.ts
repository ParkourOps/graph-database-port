import {TNode, TNodeDelta as TNodeMatcher, TNodeLabels, TNodeProperties} from "./node";

export type TNodeSelector = 
    string |        // single node by id 
    TNode |         // single node by obj
    string[] |      // multiple nodes by id
    TNode[] |       // multiple nodes by obj
    TNodeMatcher    // matcher
;