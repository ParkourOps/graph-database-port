import { TLink } from "../schema/link"

export class Link implements TLink {
    source
    target
    id
    label
    properties
    constructor(link: TLink) {
        this.source = link.source;
        this.target = link.target;
        this.id = link.id;
        this.label = link.label;
        this.properties = link.properties;
    }
}
