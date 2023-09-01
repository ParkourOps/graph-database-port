import { TNodeLabels, TNodeProperties } from "../port/schema/node";

/**
 * Stringify properties object for Cypher queries.
 * (Remove quotation marks from key names for Neo4j to accept.)
 * @param {object | undefined} properties -
 *          optional objects representing properties of a node or link.
 * @return {string} -
 *          Cypher string representation of the properties object.
 */
export const stringifyProps = <T extends object>(properties?: TNodeProperties) => {
    if (!properties) return "";
    return JSON.stringify(properties).replace(/"([^"]+)":/g, "$1:");
};

/**
 * Stringify labels array for Cypher queries.
 * (Add colon marks to labels and transform to string.)
 * @param {Array<string> | undefined} labels -
 *          optional array of string label(s) for a node or link.
 * @return {string} -
 *          Cypher string representation of the label(s).
 */
export const stringifyLabels = (labels?: TNodeLabels) => {
    if (!labels || labels.length < 1) return "";
    return labels.map((l) => `:\`${l}\``).join("");
};
