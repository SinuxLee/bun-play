import { MinObjectHeap } from '../minHeap';
import { PuzzleState } from './state';

interface PuzzleNode {
    state: PuzzleState;
    g: number;        // 从起始状态到当前状态的实际代价
    h: number;        // 从当前状态到目标状态的估计代价
    f: number;        // f = g + h
    parent: PuzzleNode | null;
    action: string | null;  // 到达此状态的移动方向
}

export class PuzzleSolver {
    private readonly directions: ('up' | 'down' | 'left' | 'right')[] = ['up', 'down', 'left', 'right'];

    solve(initial: PuzzleState): { path: string[]; steps: number } | null {
        const target = new PuzzleState(); // 生成目标状态
        const openList = new MinObjectHeap<PuzzleNode>('f');
        const closedSet = new Set<string>();

        // 创建初始节点
        const startNode: PuzzleNode = {
            state: initial,
            g: 0,
            h: initial.getManhattanDistance(target),
            f: 0,
            parent: null,
            action: null
        };
        startNode.f = startNode.g + startNode.h;

        openList.push(startNode);

        while (!openList.isEmpty()) {
            const current = openList.pop()!;
            const currentHash = current.state.hash();

            if (current.state.equals(target)) {
                return this.reconstructPath(current);
            }

            if (closedSet.has(currentHash)) {
                continue;
            }

            closedSet.add(currentHash);

            // 尝试所有可能的移动
            for (const direction of this.directions) {
                const nextState = current.state.move(direction);
                if (!nextState) continue;

                const nextHash = nextState.hash();
                if (closedSet.has(nextHash)) continue;

                const nextNode: PuzzleNode = {
                    state: nextState,
                    g: current.g + 1,
                    h: nextState.getManhattanDistance(target),
                    f: 0,
                    parent: current,
                    action: direction
                };
                nextNode.f = nextNode.g + nextNode.h;

                openList.push(nextNode);
            }
        }

        return null; // 无解
    }

    private reconstructPath(node: PuzzleNode): { path: string[]; steps: number } {
        const path: string[] = [];
        let current: PuzzleNode | null = node;
        let steps = 0;

        while (current && current.action) {
            path.unshift(current.action);
            current = current.parent;
            steps++;
        }

        return { path, steps };
    }

    public static isSolvable(state: PuzzleState): boolean {
        const board = state.getBoard();
        const flatBoard = board.flat();
        let inversions = 0;

        // 计算逆序数
        for (let i = 0; i < flatBoard.length - 1; i++) {
            if (flatBoard[i] === 0) continue;
            for (let j = i + 1; j < flatBoard.length; j++) {
                if (flatBoard[j] === 0) continue;
                if (flatBoard[i] > flatBoard[j]) {
                    inversions++;
                }
            }
        }

        // 获取空格的行号（从底部数）
        const emptyPos = state.getEmptyPosition();
        const emptyRow = 4 - emptyPos.y;

        // 对于4x4的棋盘：
        // 如果空格在从底部数的奇数行，逆序数必须为偶数
        // 如果空格在从底部数的偶数行，逆序数必须为奇数
        return (emptyRow % 2 === 1) === (inversions % 2 === 0);
    }
} 