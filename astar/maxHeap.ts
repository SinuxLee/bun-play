import Heap from './heap';

export default class MaxHeap<T extends number> extends Heap<T> {
    constructor() {
        super((value: T) => value, false);
    }
}

// 支持自定义对象的大顶堆
export class MaxObjectHeap<T extends { [key: string]: any }> extends Heap<T> {
    constructor(valueKey: keyof T) {
        super((obj: T) => obj[valueKey] as number, false);
    }
} 