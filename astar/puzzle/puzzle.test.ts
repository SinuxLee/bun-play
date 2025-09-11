import { test, expect } from "bun:test";
import { PuzzleState } from "./state";
import { PuzzleSolver } from "./solver";

test("PuzzleState - Basic Operations", () => {
    const board = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 0, 15]
    ];
    const state = new PuzzleState(board);

    // 测试移动
    const nextState = state.move('right');
    expect(nextState).not.toBeNull();
    if (nextState) {
        const newBoard = nextState.getBoard();
        expect(newBoard[3][2]).toBe(15);
        expect(newBoard[3][3]).toBe(0);
    }

    // 测试无效移动
    const invalidMove = state.move('left');
    expect(invalidMove).not.toBeNull();
});

test("PuzzleState - Manhattan Distance", () => {
    const initial = new PuzzleState([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 0]
    ]);
    const target = new PuzzleState();

    expect(initial.getManhattanDistance(target)).toBe(0);

    const shuffled = new PuzzleState([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 15, 14, 0]
    ]);
    expect(shuffled.getManhattanDistance(target)).toBe(2);
});

test("PuzzleSolver - Simple Case", () => {
    const initial = new PuzzleState([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 15, 14, 0]
    ]);

    const solver = new PuzzleSolver();
    let solution: { path: string[]; steps: number } | null = null;
    
    // 添加超时处理
    const timeout = setTimeout(() => {
        throw new Error("Solver timeout");
    }, 5000);  // 5秒超时

    try {
        solution = solver.solve(initial);
        clearTimeout(timeout);
    } catch (e) {
        clearTimeout(timeout);
        throw e;
    }

    expect(solution).not.toBeNull();
    if (solution) {
        expect(solution.steps).toBeLessThanOrEqual(80);  // 限制最大步数
        expect(solution.path.length).toBe(solution.steps);
    }
});

test("PuzzleSolver - Solvability Check", () => {
    // 可解的情况
    const solvable = new PuzzleState([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 15, 14, 0]
    ]);
    expect(PuzzleSolver.isSolvable(solvable)).toBe(true);

    // 不可解的情况
    const unsolvable = new PuzzleState([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 0]
    ]);
    const swapped = new PuzzleState([
        [2, 1, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 0]
    ]);
    expect(PuzzleSolver.isSolvable(swapped)).toBe(false);
}); 