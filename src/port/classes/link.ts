import { GraphDatabasePort } from ".."
import { SLink, TLink } from "../schema/link"

export class Link implements TLink {
    source
    target
    id
    label
    properties
    constructor(link: TLink) {
        const linkParseResult = SLink.safeParse(link);
        if (linkParseResult.success) {
            this.source = linkParseResult.data.source;
            this.target = linkParseResult.data.target;
            this.id = linkParseResult.data.id;
            this.label = linkParseResult.data.label;
            this.properties = linkParseResult.data.properties; 
        } else {
            console.error("Failed to parse link:", link);
            console.error(JSON.stringify(linkParseResult.error));
            throw GraphDatabasePort.errors.linkParseFail;
        }
    }
}
