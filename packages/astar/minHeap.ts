import Heap from './heap';

export default class MinHeap<T extends number> extends Heap<T> {
    constructor() {
        super((value: T) => value, true);  // isMinHeap = true 表示最小堆
    }
}

// 支持自定义对象的小顶堆
export class MinObjectHeap<T extends { [key: string]: any }> extends Heap<T> {
    constructor(valueKey: keyof T) {
        super((obj: T) => obj[valueKey] as number, true);  // isMinHeap = true 表示最小堆
    }
} 