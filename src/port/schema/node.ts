import { z } from "zod";
import consts from "../../consts";

export const SNodeId = z.string().nonempty();
export const SNodeLabel = z.string().regex(new RegExp(consts.REGEX_NODE_LABELS));
export const SNodeLabels = SNodeLabel.array().max(consts.MAX_NUM_NODE_LABELS);
export const SNodePropertyKey = z.string().regex(new RegExp(consts.REGEX_NODE_PROP_KEYS));
export const SNodeProperties = z.record(SNodePropertyKey, z.unknown());
export const SNode = z.object({
    id: SNodeId,
    labels: SNodeLabels,
    properties: SNodeProperties
});

export type TNodeId = z.infer<typeof SNodeId>;
export type TNodeLabels = z.infer<typeof SNodeLabels>;
export type TNodeProperties = z.infer<typeof SNodeProperties>;
export type TNode = z.infer<typeof SNode>;
export type TNodeDelta = {
    labels?: TNodeLabels,
    properties?: TNodeProperties
};

