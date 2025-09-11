export class PuzzleState {
    private board: number[][];
    private emptyPos: { x: number; y: number };
    private readonly size: number;

    constructor(board?: number[][]) {
        this.size = 4; // 4x4 的棋盘
        if (board) {
            this.board = board.map(row => [...row]);
            this.emptyPos = this.findEmptyPosition();
        } else {
            // 生成目标状态
            this.board = this.generateSolvedBoard();
            this.emptyPos = { x: this.size - 1, y: this.size - 1 };
        }
    }

    private generateSolvedBoard(): number[][] {
        const board: number[][] = [];
        let num = 1;
        
        for (let i = 0; i < this.size; i++) {
            board[i] = [];
            for (let j = 0; j < this.size; j++) {
                board[i][j] = num++;
            }
        }
        board[this.size - 1][this.size - 1] = 0; // 空格位置用0表示
        return board;
    }

    private findEmptyPosition(): { x: number; y: number } {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.board[i][j] === 0) {
                    return { x: j, y: i };
                }
            }
        }
        throw new Error("Invalid puzzle state: no empty position found");
    }

    public getBoard(): number[][] {
        return this.board.map(row => [...row]);
    }

    public getEmptyPosition(): { x: number; y: number } {
        return { ...this.emptyPos };
    }

    public move(direction: 'up' | 'down' | 'left' | 'right'): PuzzleState | null {
        const moves = {
            up: { dx: 0, dy: -1 },
            down: { dx: 0, dy: 1 },
            left: { dx: -1, dy: 0 },
            right: { dx: 1, dy: 0 }
        };

        const { dx, dy } = moves[direction];
        const newX = this.emptyPos.x + dx;
        const newY = this.emptyPos.y + dy;

        if (newX < 0 || newX >= this.size || newY < 0 || newY >= this.size) {
            return null;
        }

        const newBoard = this.board.map(row => [...row]);
        newBoard[this.emptyPos.y][this.emptyPos.x] = this.board[newY][newX];
        newBoard[newY][newX] = 0;

        const newState = new PuzzleState(newBoard);
        return newState;
    }

    public getManhattanDistance(target: PuzzleState): number {
        let distance = 0;
        const targetPositions = new Map<number, { x: number; y: number }>();

        // 记录目标状态中每个数字的位置
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const value = target.board[i][j];
                if (value !== 0) {
                    targetPositions.set(value, { x: j, y: i });
                }
            }
        }

        // 计算当前状态中每个数字到其目标位置的曼哈顿距离之和
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                const value = this.board[i][j];
                if (value !== 0) {
                    const targetPos = targetPositions.get(value)!;
                    distance += Math.abs(j - targetPos.x) + Math.abs(i - targetPos.y);
                }
            }
        }

        return distance;
    }

    public equals(other: PuzzleState): boolean {
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (this.board[i][j] !== other.board[i][j]) {
                    return false;
                }
            }
        }
        return true;
    }

    public toString(): string {
        return this.board.map(row => 
            row.map(num => num === 0 ? '  ' : num.toString().padStart(2, ' '))
               .join(' ')).join('\n');
    }

    public hash(): string {
        return this.board.flat().join(',');
    }
} 