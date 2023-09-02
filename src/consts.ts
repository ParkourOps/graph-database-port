export default {
    MAX_NUM_NODE_LABELS: 5_0,
    MAX_LEN_NODE_LABEL: 5_0,
    REGEX_NODE_LABEL: "^[0-9a-zA-Z !#%&*+<=>?@-_|~]+$",
    REGEX_NODE_PROP_KEY: "^[a-zA-Z_][a-zA-Z0-9_]+$",
    REGEX_LINK_LABEL: "^[0-9a-zA-Z_]+$",
    MIN_LEN_PROP_ARRAY_VAL: 0,
    MAX_LEN_PROP_ARRAY_VAL: 5_0,
} as const;