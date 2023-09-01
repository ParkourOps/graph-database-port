export default {
    MAX_NUM_NODE_LABELS: 1_000,
    MAX_LEN_NODE_LABEL: 1_000,
    REGEX_NODE_LABELS: "^[0-9a-zA-Z !#%&*+<=>?@-_|~]+$",
    REGEX_NODE_PROP_KEYS: "^[a-zA-Z_][a-zA-Z0-9_]+$",
    MIN_LEN_PROP_ARRAY_VAL: 0,
    MAX_LEN_PROP_ARRAY_VAL: 1_000,
} as const;