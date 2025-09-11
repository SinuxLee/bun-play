export default class Heap<T> {
    private data: T[] = [];
    private ValuationFun: (value: T) => number;
    private isMinHeap: boolean;

    constructor(ValuationFun: (value: T) => number, isMinHeap: boolean = true) {
        this.ValuationFun = ValuationFun;
        this.isMinHeap = isMinHeap;
    }

    public push(value: T) {
        this.data.push(value);
        this.bubbleUp(this.data.length - 1);
    }

    public pop() {
        if (this.data.length === 0) return null;
        if (this.data.length === 1) return this.data.pop()!;
        
        const max = this.data[0];
        const last = this.data.pop()!;
        this.data[0] = last;
        this.bubbleDown(0);
        return max;
    }

    public isEmpty() {
        return this.data.length === 0;
    }

    public size() {
        return this.data.length;
    }

    public remove(value: T) {
        const index = this.data.findIndex(item => item === value);
        if (index === -1) return false;

        if (index === this.data.length - 1) {
            this.data.pop();
            return true;
        }

        this.data[index] = this.data.pop()!;
        
        const parentIdx = this.parentIndex(index);
        if (index > 0 && this.compare(this.data[index], this.data[parentIdx])) {
            this.bubbleUp(index);
        } else {
            this.bubbleDown(index);
        }
        return true;
    }

    public peek() {
        if (this.isEmpty()) return null;
        return this.data[0];
    }

    public clear() {
        this.data = [];
    }

    public contains(value: T) {
        return this.findIndex(value) !== -1;
    }

    public toArray() {
        return this.data;
    }

    public toString() {
        return this.data.toString();
    }
    

    private bubbleUp(index: number) {
        while (index > 0) {
            const parentIdx = this.parentIndex(index);
            if (!this.compare(this.data[index], this.data[parentIdx])) {
                break;
            }
            this.swap(index, parentIdx);
            index = parentIdx;
        }
    }

    private bubbleDown(index: number) {
        while (true) {
            let targetIdx = index;
            const leftIdx = this.leftChildIndex(index);
            const rightIdx = this.rightChildIndex(index);

            if (leftIdx < this.data.length && 
                this.compare(this.data[leftIdx], this.data[targetIdx])) {
                targetIdx = leftIdx;
            }

            if (rightIdx < this.data.length && 
                this.compare(this.data[rightIdx], this.data[targetIdx])) {
                targetIdx = rightIdx;
            }

            if (targetIdx === index) break;

            this.swap(index, targetIdx);
            index = targetIdx;
        }
    }

    private swap(index1: number, index2: number) {
        const temp = this.data[index1];
        this.data[index1] = this.data[index2];
        this.data[index2] = temp;
    }

    private parentIndex(index: number) {
        return Math.floor((index - 1) / 2);
    }

    private leftChildIndex(index: number) {
        return index * 2 + 1;
    }

    private rightChildIndex(index: number) {
        return index * 2 + 2;
    }

    private compare(a: T, b: T): boolean {
        const aValue = this.ValuationFun(a);
        const bValue = this.ValuationFun(b);
        return this.isMinHeap ? aValue < bValue : aValue > bValue;
    }

    public update(value: T): boolean {
        const index = this.findIndex(value);
        if (index === -1) return false;

        const oldValue = this.ValuationFun(this.data[index]);
        const newValue = this.ValuationFun(value);

        this.data[index] = value;

        if (newValue < oldValue) {
            this.bubbleUp(index);
        } else if (newValue > oldValue) {
            this.bubbleDown(index);
        }

        return true;
    }

    private findIndex(value: T): number {
        for (let i = 0; i < this.data.length; i++) {
            if (this.equals(this.data[i], value)) {
                return i;
            }
        }
        return -1;
    }

    private equals(a: T, b: T): boolean {
        return a === b;
    }
}
