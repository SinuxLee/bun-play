import { DYNAMIC_CHESS_VALUE } from "../core/tables.ts";
import { ZOBRIST, zobristPcIdx } from "../core/zobrist.ts";
import { flipSquare } from "../core/coords.ts";
import { PieceType } from "../core/constants.ts";
import type { Square, Piece, Move } from "../core/constants.ts";

/** 历史走法栈条目 */
export interface MoveRecord {
    readonly mv:       Move;
    readonly captured: Piece;
    readonly prevKey:  number;
    readonly prevLock: number;
    readonly inCheck:  boolean;
}

/** 将军检测回调签名 */
export type CheckedFn = (pos: Position) => boolean;

/**
 * 棋盘局面核心数据模型
 *
 * 职责：
 *   1. 棋盘状态存储（squares、sdPlayer、估值累加器）
 *   2. 棋子的增删（addPiece）及 Zobrist/估值增量维护
 *   3. 走法执行（makeMove）与撤销（undoMakeMove）
 *   4. 空步（nullMove / undoNullMove）
 *   5. 历史栈管理
 */
export class Position {
    /** 当前行棋方：0=红方，1=黑方 */
    sdPlayer = 0;

    /** 棋盘格子数组（256元素，16×16） */
    squares: Piece[] = new Array(256).fill(0);

    /** 双方将/帅的位置缓存 [红方, 黑方]，-1 表示未上场 */
    kingSquares: [Square, Square] = [-1, -1];

    /** 红方棋子的位置估值累加 */
    vlRed = 0;

    /** 黑方棋子的位置估值累加 */
    vlBlack = 0;

    /** Zobrist 主键（用于置换表查找）*/
    zobristKey = 0;

    /** Zobrist 校验锁（降低哈希碰撞率）*/
    zobristLock = 0;

    /** 当前搜索距离（距离根节点的步数）*/
    distance = 0;

    private _moveStack: MoveRecord[] = [
        { mv: 0, captured: 0, prevKey: 0, prevLock: 0, inCheck: false },
    ];

    // ── 棋子操作 ────────────────────────────────────────────────

    /**
     * 在指定格子添加或删除棋子，同步更新估值和 Zobrist
     * @param isDel true=删除，false=添加
     */
    addPiece(square: Square, piece: Piece, isDel: boolean): void {
        this.squares[square] = isDel ? 0 : piece;
        const pieceIdx = zobristPcIdx(piece);

        // 追踪将/帅位置
        if ((piece & 7) === PieceType.KING) {
            const side = piece < 16 ? 0 : 1;
            this.kingSquares[side] = isDel ? -1 : square;
        }

        if (piece < 16) {
            const typeIdx = piece - 8;
            const delta = DYNAMIC_CHESS_VALUE[typeIdx]![square]!;
            this.vlRed += isDel ? -delta : delta;
        } else {
            const typeIdx = piece - 16;
            const delta = DYNAMIC_CHESS_VALUE[typeIdx]![flipSquare(square)]!;
            this.vlBlack += isDel ? -delta : delta;
        }

        this.zobristKey  ^= ZOBRIST.keyTable[pieceIdx]![square]!;
        this.zobristLock ^= ZOBRIST.lockTable[pieceIdx]![square]!;
    }

    // ── 行棋方切换 ───────────────────────────────────────────────

    changeSide(): void {
        this.sdPlayer = 1 - this.sdPlayer;
        this.zobristKey  ^= ZOBRIST.playerKey;
        this.zobristLock ^= ZOBRIST.playerLock;
    }

    // ── 走法执行 / 撤销 ──────────────────────────────────────────

    private _movePiece(move: Move): Piece {
        const source = move & 0xFF;
        const destination = move >> 8;
        const captured = this.squares[destination]!;
        if (captured > 0) this.addPiece(destination, captured, true);
        const moving = this.squares[source]!;
        this.addPiece(source, moving, true);
        this.addPiece(destination, moving, false);
        return captured;
    }

    private _undoMovePiece(move: Move, captured: Piece): void {
        const source = move & 0xFF;
        const destination = move >> 8;
        const moving = this.squares[destination]!;
        this.addPiece(destination, moving, true);
        this.addPiece(source, moving, false);
        if (captured > 0) this.addPiece(destination, captured, false);
    }

    /**
     * 执行走法（含将军校验）
     * @returns false 表示走法导致己方被将，不合法
     */
    makeMove(move: Move, checkedFn: CheckedFn): boolean {
        const prevKey  = this.zobristKey;
        const prevLock = this.zobristLock;
        const captured = this._movePiece(move);

        if (checkedFn(this)) {
            this._undoMovePiece(move, captured);
            return false;
        }

        this.changeSide();
        const inCheck = checkedFn(this);
        this._moveStack.push({ mv: move, captured, prevKey, prevLock, inCheck });
        this.distance++;
        return true;
    }

    /** 撤销上一步走法 */
    undoMakeMove(): void {
        this.distance--;
        const record = this._moveStack.pop();
        if (!record) throw new Error('undoMakeMove: move stack is empty');
        const { mv, captured, prevKey, prevLock } = record;
        this.changeSide();
        this._undoMovePiece(mv, captured);
        this.zobristKey  = prevKey;
        this.zobristLock = prevLock;
    }

    /**
     * 执行空步（不走棋，直接切换行棋方，用于空步裁剪）
     */
    nullMove(): void {
        const prevKey  = this.zobristKey;
        const prevLock = this.zobristLock;
        this.changeSide();
        this._moveStack.push({ mv: 0, captured: 0, prevKey, prevLock, inCheck: false });
        this.distance++;
    }

    /** 撤销空步 */
    undoNullMove(): void {
        this.distance--;
        const record = this._moveStack.pop();
        if (!record) throw new Error('undoNullMove: move stack is empty');
        const { prevKey, prevLock } = record;
        this.changeSide();
        this.zobristKey  = prevKey;
        this.zobristLock = prevLock;
    }

    // ── 历史栈查询 ───────────────────────────────────────────────

    /** 当前局面是否处于将军状态 */
    inCheck(): boolean {
        return this._moveStack[this._moveStack.length - 1]!.inCheck;
    }

    /** 上一步是否吃子 */
    captured(): boolean {
        return this._moveStack[this._moveStack.length - 1]!.captured > 0;
    }

    /** 返回历史栈（只读，用于重复检测等） */
    get moveStack(): readonly MoveRecord[] {
        return this._moveStack;
    }

    /**
     * 重置历史栈（新局/加载 FEN 后调用）
     * @param inCheck 初始局面是否被将
     */
    setIrrev(inCheck: boolean): void {
        this._moveStack = [{ mv: 0, captured: 0, prevKey: 0, prevLock: 0, inCheck }];
        this.distance = 0;
    }

    /** 清空棋盘 */
    clearBoard(): void {
        this.sdPlayer = 0;
        this.squares.fill(0);
        this.vlRed = this.vlBlack = 0;
        this.zobristKey = this.zobristLock = 0;
        this.kingSquares = [-1, -1];
    }
}
