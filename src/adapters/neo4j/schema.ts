import { z } from "zod";

export const SNeo4jNode = z.object({
    labels: z.array(z.string().nonempty()),
    properties: z.object({
        "_id_": z.string()
    }).and(z.record(z.string(), z.unknown()))
});

export type TNeo4jNode = z.infer<typeof SNeo4jNode>;