import { customAlphabet } from "nanoid";
import consts from "../../src/consts";
import { generateRandomArray, generateRandomInt } from "../../src/utils/random-gen-functs";
import {faker} from "@faker-js/faker/locale/en_GB"

const CHARS_ALLOWED_NODE_LABELS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ !#%&*+<=>?@-_|~";

function generateRandomNodeLabel() {
    return customAlphabet(CHARS_ALLOWED_NODE_LABELS)(generateRandomInt(1, consts.MAX_LEN_NODE_LABEL));
}

function generateRandomIncorrectNodeLabel() {
    return customAlphabet(CHARS_ALLOWED_NODE_LABELS+`'"$\``)(generateRandomInt(1, consts.MAX_LEN_NODE_LABEL));
}

// function generateRandomInt8() {
//     // Generate a random number between -128 and 127
//     const min = -128;
//     const max = 127;
//     const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
//     return randomNumber;
// }

// function generateRandomLenByteArray(incMin: number, incMax: number) {
//     const len = generateRandomInt(incMin, incMax);
//     const arr = new Int8Array(len);
//     for (let i=0; i<len; ++i) {
//         arr[i] = generateRandomInt8();
//     }
//     return arr;
// }

export const generateRandomCorrectNodeLabels = (min: number = 0, max: number = consts.MAX_NUM_NODE_LABELS) => generateRandomArray(min, max, generateRandomNodeLabel);
export const generateRandomIncorrectNodeLabels = (min: number = 0, max: number = consts.MAX_NUM_NODE_LABELS) => generateRandomArray(min, max, generateRandomIncorrectNodeLabel);

const generateRandomPropArrayVal = <T>(generatorFn: ()=>T) => generateRandomArray(consts.MIN_LEN_PROP_ARRAY_VAL, consts.MAX_LEN_PROP_ARRAY_VAL, generatorFn);

export function generateRandomProps() {
    return {
        price: faker.commerce.price({min: 1, max: 1_000_000}),
        previous_prices: generateRandomPropArrayVal(()=>faker.commerce.price({min: 1, max: 1_000_000})),
        product: faker.commerce.product(),
        product_description: faker.commerce.productDescription(),
        materials_used: generateRandomPropArrayVal(faker.commerce.productMaterial),
        colour_variation: generateRandomPropArrayVal(faker.vehicle.color),
        sizes_available: generateRandomPropArrayVal(faker.number.int),
        flag: faker.datatype.boolean(),
        flags: generateRandomPropArrayVal(faker.datatype.boolean),
        // rawImage: generateRandomLenByteArray(0, consts.MAX_LEN_PROP_ARRAY_VAL), // <== TODO: this is broken, fix it
    }
}

