import { test, expect } from "bun:test";
import Heap from './heap';

test("heap operations", () => {
    // 创建一个最小堆
    const heap = new Heap<number>((n) => n);
    
    // 测试空堆
    expect(heap.size()).toBe(0);
    expect(heap.isEmpty()).toBe(true);
    
    // 测试插入
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(1);
    expect(heap.size()).toBe(4);
    expect(heap.peek()).toBe(1);  // 最小值在顶部
    
    // 测试按顺序弹出（从小到大）
    expect(heap.pop()).toBe(1);
    expect(heap.pop()).toBe(3);
    expect(heap.pop()).toBe(5);
    expect(heap.pop()).toBe(7);
    expect(heap.pop()).toBe(null);
});

test("heap remove operation", () => {
    const heap = new Heap<number>((n) => n);
    
    heap.push(5);
    heap.push(3);
    heap.push(7);
    heap.push(1);
    
    expect(heap.remove(3)).toBe(true);
    expect(heap.size()).toBe(3);
    expect(heap.contains(3)).toBe(false);
    
    expect(heap.remove(10)).toBe(false);
});

test("heap with custom objects", () => {
    const objHeap = new Heap<{value: number}>((obj) => obj.value);
    const objects = [
        {value: 5},
        {value: 3},
        {value: 7},
        {value: 1}
    ];
    
    objects.forEach(obj => objHeap.push(obj));
    expect(objHeap.peek()).toEqual({value: 1});  // 最小值在顶部
    
    // 测试弹出顺序（从小到大）
    expect(objHeap.pop()).toEqual({value: 1});
    expect(objHeap.pop()).toEqual({value: 3});
    expect(objHeap.pop()).toEqual({value: 5});
    expect(objHeap.pop()).toEqual({value: 7});
});

test("heap clear operation", () => {
    const heap = new Heap<number>((n) => n);
    
    heap.push(5);
    heap.push(3);
    heap.push(7);
    
    heap.clear();
    expect(heap.isEmpty()).toBe(true);
    expect(heap.size()).toBe(0);
    expect(heap.peek()).toBe(null);
});

test("heap update operations", () => {
    interface TestNode {
        id: number;
        value: number;
    }

    const heap = new Heap<TestNode>((node) => node.value);
    const equals = (a: TestNode, b: TestNode) => a.id === b.id;
    Object.defineProperty(heap, 'equals', { value: equals });

    // 添加节点
    heap.push({ id: 1, value: 5 });
    heap.push({ id: 2, value: 3 });
    heap.push({ id: 3, value: 7 });
    heap.push({ id: 4, value: 1 });

    // 验证初始顺序（从小到大）
    expect(heap.pop()!.value).toBe(1);  // 最小值先出
    expect(heap.pop()!.value).toBe(3);

    // 更新节点值（将7改为2）
    const node = { id: 3, value: 2 };
    expect(heap.update(node)).toBe(true);

    // 验证更新后的顺序
    expect(heap.pop()!.value).toBe(2);
    expect(heap.pop()!.value).toBe(5);
}); 