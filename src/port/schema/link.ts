import { z } from "zod";
import { SNode, SNodeId } from "./node";

export const SLinkId = z.string().nonempty();
export const SLinkLabel = z.string().nonempty();
export const SLinkProperties = z.record(z.string(), z.unknown());

const SLinkBase = z.object({
    id: SLinkId,
    label: SLinkLabel,
    properties: SLinkProperties
});

export const SLink = SLinkBase.merge(z.object({
    source: SNodeId,
    target: SNodeId
}));

// export const SReferencedLink = SLinkBase.merge(z.object({
//     source: SNode,
//     target: SNode
// }));

export type TLinkId = z.infer<typeof SLinkId>;
export type TLinkLabel = z.infer<typeof SLinkLabel>;
export type TLinkProperties = z.infer<typeof SLinkProperties>;
export type TLinkBase = z.infer<typeof SLinkBase>;
export type TLink = z.infer<typeof SLink>;
// export type TReferencedLink = z.infer<typeof SReferencedLink>;

export type TLinkUpdateSpec = Partial<Omit<TLinkBase, "id" | "label">>;
