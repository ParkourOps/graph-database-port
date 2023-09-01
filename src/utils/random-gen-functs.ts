import {v4 as uuidv4} from "uuid";

export function generateNodeId() {
    return `node#${uuidv4()}`;
}

export function generateLinkId() {
    return `link#${uuidv4()}`;
}

export function generateRandomInt(inclusiveMin: number, inclusiveMax: number) {
    return Math.floor(Math.random() * (inclusiveMax - inclusiveMin + 1) ) + inclusiveMin;
}

export function generateRandomArray<T>(incMin: number, incMax: number, generatorFn: ()=>T) {
    const len = generateRandomInt(incMin, incMax);
    const arr = (new Array<T>(len));
    for (let i=0; i<len; ++i){
        arr[i]=generatorFn();
    }
    return arr;
}
