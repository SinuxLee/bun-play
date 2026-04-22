import { MinObjectHeap } from './minHeap';

export enum NodeValue {
    Empty = 0,
    Blocked = 1,
    Start = 2,
    End = 3,
}

export enum HeuristicType {
    Manhattan = "manhattan",
    Euclidean = "euclidean",
    Chebyshev = "chebyshev"
}

export interface Node {
    value: NodeValue;
    x: number;
    y: number;
    parent: Node | null;
    g: number;
    h: number;
    f: number; // f = g + h
}

export class Grid {
    nodes: Node[][]; // 网格中的节点
    constructor(data: number[][]) {
        this.nodes = data.map((row, y) => 
            row.map((value, x) => ({ 
                value: value as NodeValue, 
                x, 
                y, 
                parent: null, 
                g: 0, 
                h: 0,
                f: 0 
            }))
        );
    }

    toString() {
        return this.nodes.map(row => row.map(node => node.value).join(' ')).join('\n');
    }

    isValid(x: number, y: number): boolean {
        return x >= 0 && x < this.nodes[0].length && y >= 0 && y < this.nodes.length;
    }

    isWalkable(x: number, y: number): boolean {
        return this.isValid(x, y) && this.nodes[y][x].value !== NodeValue.Blocked;
    }
}

// F(Final Cost) = G(Given Cost) + H(Heuristic Cost), G 是起点到当前节点的实际代价，H 是当前节点到目标节点的估计代价(核心变种在H的计算方式)
// G 是遍历过程中已经走过的路径长度
// H 是当前节点到目标节点的曼哈顿距离(水平和垂直移动)，曼哈顿距离 = |x1 - x2| + |y1 - y2|
// H 是当前节点到目标节点的欧几里得距离(任意角度移动)，欧几里得距离 = sqrt((x1 - x2)^2 + (y1 - y2)^2)
// H 是当前节点到目标节点的切比雪夫距离(八方向移动)，切比雪夫距离 = max(|x1 - x2|, |y1 - y2|)

export class AStar {
    private grid: Grid;
    private heuristicType: HeuristicType;
    
    // 四方向移动（适用于曼哈顿距离）
    private readonly directionsOrthogonal = [
        [-1, 0],  // 左
        [1, 0],   // 右
        [0, -1],  // 上
        [0, 1],   // 下
    ];

    // 八方向移动（适用于欧几里得距离和切比雪夫距离）
    private readonly directionsOctagonal = [
        [-1, 0],  // 左
        [1, 0],   // 右
        [0, -1],  // 上
        [0, 1],   // 下
        [-1, -1], // 左上
        [-1, 1],  // 左下
        [1, -1],  // 右上
        [1, 1]    // 右下
    ];

    constructor(grid: Grid, heuristicType: HeuristicType = HeuristicType.Manhattan) {
        this.grid = grid;
        this.heuristicType = heuristicType;
    }

    private getDirections(): number[][] {
        switch (this.heuristicType) {
            case HeuristicType.Manhattan:
                return this.directionsOrthogonal;
            case HeuristicType.Euclidean:
            case HeuristicType.Chebyshev:
                return this.directionsOctagonal;
            default:
                return this.directionsOrthogonal;
        }
    }

    private manhattanDistance(node: Node, end: Node): number {
        return Math.abs(node.x - end.x) + Math.abs(node.y - end.y);
    }

    private euclideanDistance(node: Node, end: Node): number {
        const dx = Math.abs(node.x - end.x);
        const dy = Math.abs(node.y - end.y);
        return Math.sqrt(dx * dx + dy * dy);
    }

    private chebyshevDistance(node: Node, end: Node): number {
        const dx = Math.abs(node.x - end.x);
        const dy = Math.abs(node.y - end.y);
        return Math.max(dx, dy);
    }

    private heuristic(node: Node, end: Node): number {
        switch (this.heuristicType) {
            case HeuristicType.Manhattan:
                return this.manhattanDistance(node, end);
            case HeuristicType.Euclidean:
                return this.euclideanDistance(node, end);
            case HeuristicType.Chebyshev:
                return this.chebyshevDistance(node, end);
            default:
                return this.euclideanDistance(node, end);
        }
    }

    private getNeighbors(node: Node): Node[] {
        const neighbors: Node[] = [];
        const directions = this.getDirections();
        
        for (const [dx, dy] of directions) {
            const newX = node.x + dx;
            const newY = node.y + dy;
            
            if (this.grid.isWalkable(newX, newY)) {
                // 对于对角线移动，需要检查两个相邻的格子是否可通行
                if (Math.abs(dx) === 1 && Math.abs(dy) === 1) {
                    // 检查水平和垂直相邻的格子
                    if (!this.grid.isWalkable(node.x + dx, node.y) || 
                        !this.grid.isWalkable(node.x, node.y + dy)) {
                        continue; // 如果有障碍物，不允许对角线移动
                    }
                }
                neighbors.push(this.grid.nodes[newY][newX]);
            }
        }
        
        return neighbors;
    }

    private reconstructPath(node: Node): Node[] {
        const path: Node[] = [];
        let current: Node | null = node;
        
        while (current !== null) {
            path.unshift(current);
            current = current.parent;
        }
        
        return path;
    }

    private getMovementCost(from: Node, to: Node): number {
        const dx = Math.abs(from.x - to.x);
        const dy = Math.abs(from.y - to.y);
        
        switch (this.heuristicType) {
            case HeuristicType.Manhattan:
                // 曼哈顿距离只允许水平和垂直移动，每步代价为1
                return dx + dy;
            case HeuristicType.Euclidean:
                // 欧几里得距离使用实际距离
                return dx === 1 && dy === 1 ? Math.SQRT2 : 1;
            case HeuristicType.Chebyshev:
                // 切比雪夫距离中所有移动代价相同
                return 1;
            default:
                return dx === 1 && dy === 1 ? Math.SQRT2 : 1;
        }
    }

    public findPath(start: Node, end: Node): Node[] | null {
        // 使用MinHeap来优化开放列表的操作
        const openList = new MinObjectHeap<Node>('f');
        const closeSet = new Set<string>();

        // 初始化起点
        start.g = 0;
        start.h = this.heuristic(start, end);
        start.f = start.g + start.h;
        openList.push(start);

        while (!openList.isEmpty()) {
            const current = openList.pop()!;
            const currentKey = `${current.x},${current.y}`;

            if (current === end) {
                return this.reconstructPath(current);
            }

            closeSet.add(currentKey);

            // 检查所有邻居节点
            for (const neighbor of this.getNeighbors(current)) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;
                if (closeSet.has(neighborKey)) {
                    continue;
                }

                const movementCost = this.getMovementCost(current, neighbor);
                const gScore = current.g + movementCost;

                // 如果这是一个更好的路径，更新节点信息
                if (!openList.contains(neighbor) || gScore < neighbor.g) {
                    neighbor.parent = current;
                    neighbor.g = gScore;
                    neighbor.h = this.heuristic(neighbor, end);
                    neighbor.f = neighbor.g + neighbor.h;
                    openList.update(neighbor); // 更新堆中的节点

                    if (!openList.contains(neighbor)) {
                        openList.push(neighbor);
                    }
                }
            }
        }

        // 没有找到路径
        return null;
    }

    // 用于可视化路径的辅助方法
    public visualizePath(path: Node[] | null): string {
        if (!path) return "No path found!";

        type CellSymbol = 'X' | 'S' | 'E' | '·' | '○';
        const visual = this.grid.nodes.map(row => 
            row.map(node => {
                if (node.value === NodeValue.Blocked) return 'X' as CellSymbol;
                if (node.value === NodeValue.Start) return 'S' as CellSymbol;
                if (node.value === NodeValue.End) return 'E' as CellSymbol;
                return '·' as CellSymbol;
            })
        );

        // 标记路径
        for (const node of path) {
            if (node.value !== NodeValue.Start && node.value !== NodeValue.End) {
                visual[node.y][node.x] = '○' as CellSymbol;
            }
        }

        return visual.map(row => row.join(' ')).join('\n');
    }
}
