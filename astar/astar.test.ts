import { test, expect } from "bun:test";
import { Grid, AStar, NodeValue, HeuristicType } from "./index";

test("A* pathfinding - simple path", () => {
    const gridData = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0]
    ];

    const grid = new Grid(gridData);
    const astar = new AStar(grid);

    const start = grid.nodes[0][0];
    const end = grid.nodes[4][4];
    start.value = NodeValue.Start;
    end.value = NodeValue.End;

    const path = astar.findPath(start, end);
    
    expect(path).not.toBeNull();
    expect(path!.length).toBeGreaterThan(0);
    expect(path![0]).toBe(start);
    expect(path![path!.length - 1]).toBe(end);
});

test("A* pathfinding - no path possible", () => {
    const gridData = [
        [0, 0, 0, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 0, 1, 0],
        [0, 1, 1, 1, 0]
    ];

    const grid = new Grid(gridData);
    const astar = new AStar(grid);

    const start = grid.nodes[0][0];
    const end = grid.nodes[4][4];
    start.value = NodeValue.Start;
    end.value = NodeValue.End;

    const path = astar.findPath(start, end);
    expect(path).toBeNull();
});

test("A* pathfinding - diagonal movement", () => {
    const gridData = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ];

    const grid = new Grid(gridData);
    // 使用欧几里得距离，允许八方向移动
    const astar = new AStar(grid, HeuristicType.Euclidean);

    const start = grid.nodes[0][0];
    const end = grid.nodes[2][2];
    start.value = NodeValue.Start;
    end.value = NodeValue.End;

    const path = astar.findPath(start, end);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3); // 应该找到对角线路径
    
    console.log("\nDiagonal path test:");
    console.log(astar.visualizePath(path));
});

test("A* pathfinding - different heuristics", () => {
    const gridData = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0]
    ];

    const grid = new Grid(gridData);
    const start = grid.nodes[0][0];
    const end = grid.nodes[4][4];
    start.value = NodeValue.Start;
    end.value = NodeValue.End;

    // 测试曼哈顿距离
    const astarManhattan = new AStar(grid, HeuristicType.Manhattan);
    const pathManhattan = astarManhattan.findPath(start, end);
    expect(pathManhattan).not.toBeNull();
    console.log("Manhattan path:");
    console.log(astarManhattan.visualizePath(pathManhattan));

    // 测试欧几里得距离
    const astarEuclidean = new AStar(grid, HeuristicType.Euclidean);
    const pathEuclidean = astarEuclidean.findPath(start, end);
    expect(pathEuclidean).not.toBeNull();
    console.log("\nEuclidean path:");
    console.log(astarEuclidean.visualizePath(pathEuclidean));

    // 测试切比雪夫距离
    const astarChebyshev = new AStar(grid, HeuristicType.Chebyshev);
    const pathChebyshev = astarChebyshev.findPath(start, end);
    expect(pathChebyshev).not.toBeNull();
    console.log("\nChebyshev path:");
    console.log(astarChebyshev.visualizePath(pathChebyshev));
});

test("A* pathfinding - diagonal movement restrictions", () => {
    const gridData = [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0]
    ];

    const grid = new Grid(gridData);
    const astar = new AStar(grid, HeuristicType.Euclidean);

    const start = grid.nodes[0][0];
    const end = grid.nodes[2][2];
    start.value = NodeValue.Start;
    end.value = NodeValue.End;

    const path = astar.findPath(start, end);
    expect(path).not.toBeNull();
    // 由于中间有障碍物，不能直接对角线移动，应该绕路
    expect(path!.length).toBeGreaterThan(3);
    
    console.log("\nDiagonal movement restriction test:");
    console.log(astar.visualizePath(path));
}); 