import { test, expect } from "bun:test";
import MaxHeap, { MaxObjectHeap } from './maxHeap';
import MinHeap, { MinObjectHeap } from './minHeap';

test("MaxHeap operations", () => {
    const heap = new MaxHeap<number>();
    
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(1);
    
    expect(heap.peek()).toBe(7);
    expect(heap.pop()).toBe(7);
    expect(heap.pop()).toBe(5);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(1);
});

test("MinHeap operations", () => {
    const heap = new MinHeap<number>();
    
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(1);
    
    expect(heap.peek()).toBe(1);
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(5);
    expect(heap.pop()).toBe(7);
});

test("MaxObjectHeap operations", () => {
    const heap = new MaxObjectHeap<{value: number}>('value');
    
    heap.push({value: 5});
    heap.push({value: 3});
    heap.push({value: 7});
    heap.push({value: 1});
    
    expect(heap.peek()).toEqual({value: 7});
    expect(heap.pop()).toEqual({value: 7});
    expect(heap.pop()).toEqual({value: 5});
    expect(heap.pop()).toEqual({value: 3});
    expect(heap.pop()).toEqual({value: 1});
});

test("MinObjectHeap operations", () => {
    const heap = new MinObjectHeap<{value: number}>('value');
    
    heap.push({value: 5});
    heap.push({value: 3});
    heap.push({value: 7});
    heap.push({value: 1});
    
    expect(heap.peek()).toEqual({value: 1});
    expect(heap.pop()).toEqual({value: 1});
    expect(heap.pop()).toEqual({value: 3});
    expect(heap.pop()).toEqual({value: 5});
    expect(heap.pop()).toEqual({value: 7});
}); 