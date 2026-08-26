import {
    MATE_VALUE, WIN_VALUE,
    NULL_OKAY_MARGIN, NULL_SAFE_MARGIN,
} from "../core/constants.ts";
import { generateMoves, isChecked } from "../engine/movegen.ts";
import { evaluate, repValue, mateValue } from "../engine/evaluate.ts";
import { HashTable, HistoryTable, HASH_ALPHA, HASH_BETA, HASH_EXACT } from "./hashtable.ts";
import { MoveSort } from "./movesort.ts";
import type { Move } from "../core/constants.ts";
import type { Position } from "../engine/position.ts";

/** 搜索选项 */
export interface SearchOptions {
    /** 最大搜索深度（迭代加深的上限）*/
    maxDepth?: number;
    /** 时间限制（毫秒），0 表示不限时 */
    timeLimit?: number;
}

/**
 * AI 搜索引擎
 *
 * 算法：迭代加深 Alpha-Beta + 置换表 + 历史启发 + 空步裁剪 + 杀手走法
 */
export class Searcher {
    private readonly _hashTable    = new HashTable();
    private readonly _historyTable = new HistoryTable();
    private readonly _killers: [Move, Move][] = [];

    private _pos: Position | null = null;
    private _bestMove = 0;
    private _deadline = 0;

    /** 获取当前搜索中的局面，保证在 search() 执行期间不为 null */
    private get pos(): Position {
        if (!this._pos) throw new Error('Searcher: no position bound');
        return this._pos;
    }

    // ── 公共接口 ─────────────────────────────────────────────────────

    /**
     * 对当前局面进行搜索，返回最佳走法
     * @param pos  当前局面（会被临时修改但最终还原）
     * @param opts 搜索选项
     */
    search(pos: Position, opts: SearchOptions = {}): Move {
        const maxDepth = opts.maxDepth ?? 64;
        this._deadline = opts.timeLimit
            ? Date.now() + opts.timeLimit
            : Number.MAX_SAFE_INTEGER;

        this._pos = pos;
        this._bestMove = 0;

        this._hashTable.clear();
        this._historyTable.clear();
        // 迭代加深
        for (let depth = 1; depth <= maxDepth; depth++) {
            this._historyTable.decay();
            this._resetKillers(depth + pos.distance);

            const vl = this._searchRoot(depth);

            if (Date.now() >= this._deadline) break;
            if (vl > WIN_VALUE || vl < -WIN_VALUE) break; // 找到将死路线
        }

        return this._bestMove;
    }

    // ── 根节点搜索 ───────────────────────────────────────────────

    private _searchRoot(depth: number): number {
        let alpha = -MATE_VALUE;
        const beta = MATE_VALUE;
        let bestMove = 0;

        const hashResult = this._hashTable.get(
            this.pos.zobristKey, this.pos.zobristLock,
            depth, alpha, beta, this.pos.distance,
        );
        const hashMove = hashResult.mv;

        const moves = generateMoves(this.pos);
        const sorter = new MoveSort(moves, this.pos, hashMove,
        this._getKillers(this.pos.distance),
        this._historyTable.table,);

        let move: Move | -1;
        while ((move = sorter.next()) !== -1) {
            if (!this.pos.makeMove(move, isChecked)) continue;
            const value = -this._searchFull(-beta, -alpha, depth - 1, true);
            this.pos.undoMakeMove();

            if (value > alpha) {
                alpha    = value;
                bestMove = move;
                if (alpha >= beta) break;
            }
        }

        if (bestMove !== 0) {
            this._bestMove = bestMove;
            this._hashTable.set(
                this.pos.zobristKey, this.pos.zobristLock,
                depth, HASH_EXACT, alpha, bestMove, this.pos.distance,
            );
            this._historyTable.add(bestMove, depth);
        }

        return alpha;
    }

    // ── 完整搜索 ─────────────────────────────────────────────────

    private _searchFull(alpha: number, beta: number, depth: number, nullOk: boolean): number {
        if (Date.now() >= this._deadline) return alpha;

        // 叶节点：静态估值
        if (depth <= 0) return this._searchQuiet(alpha, beta);

        // 重复检测
        const repValue_ = repValue(this.pos);
        if (repValue_ !== 0) return repValue_;

        // 长将禁手
        if (this.pos.distance >= MATE_VALUE) return evaluate(this.pos);

        // 置换表
        const hashResult = this._hashTable.get(
            this.pos.zobristKey, this.pos.zobristLock,
            depth, alpha, beta, this.pos.distance,
        );
        if (hashResult.hit) return hashResult.vl;
        const hashMove = hashResult.mv;

        // 空步裁剪
        if (
            nullOk && !this.pos.inCheck() && !this.pos.captured() &&
            evaluate(this.pos) > alpha + NULL_OKAY_MARGIN
        ) {
            this.pos.nullMove();
            const value = -this._searchFull(-beta, -beta + 1, depth - 3, false);
            this.pos.undoNullMove();
            if (value >= beta + NULL_SAFE_MARGIN) return value;
        }

        // 展开节点
        let best = -MATE_VALUE;
        let bestMove = 0;
        let hashFlag = HASH_ALPHA;

        const moves = generateMoves(this.pos);
        const sorter = new MoveSort(moves, this.pos, hashMove,
        this._getKillers(this.pos.distance),
        this._historyTable.table,);

        let move: Move | -1;
        while ((move = sorter.next()) !== -1) {
            if (!this.pos.makeMove(move, isChecked)) continue;
            const value = -this._searchFull(-beta, -alpha, depth - 1, true);
            this.pos.undoMakeMove();

            if (value > best) {
                best     = value;
                bestMove = move;

                if (value >= beta) {
                    hashFlag = HASH_BETA;
                    this._addKiller(this.pos.distance, move);
                    this._historyTable.add(move, depth);
                    break;
                }
                if (value > alpha) {
                    alpha    = value;
                    hashFlag = HASH_EXACT;
                }
            }
        }

        if (best === -MATE_VALUE) {
            best = mateValue(this.pos);
        }

        this._hashTable.set(
            this.pos.zobristKey, this.pos.zobristLock,
            depth, hashFlag, best, bestMove, this.pos.distance,
        );

        return best;
    }

    // ── 静态搜索（Quiescence）────────────────────────────────────

    private _searchQuiet(alpha: number, beta: number): number {
        const repValue_ = repValue(this.pos);
        if (repValue_ !== 0) return repValue_;

        if (this.pos.distance >= MATE_VALUE) return evaluate(this.pos);

        const standPat = evaluate(this.pos);
        if (standPat >= beta) return standPat;
        if (standPat > alpha) alpha = standPat;

        const moves = generateMoves(this.pos);
        const inCheck = this.pos.inCheck();

        let best = standPat;
        for (const move of moves) {
            const destination = move >> 8;
            // 静态搜索只考虑吃子走法（或将军时所有走法）
            if (!inCheck && this.pos.squares[destination] === 0) continue;
            if (!this.pos.makeMove(move, isChecked)) continue;
            const value = -this._searchQuiet(-beta, -alpha);
            this.pos.undoMakeMove();

            if (value > best) {
                best = value;
                if (value >= beta) return value;
                if (value > alpha) alpha = value;
            }
        }

        if (best === -MATE_VALUE) best = mateValue(this.pos);
        return best;
    }

    // ── 杀手表管理 ───────────────────────────────────────────────

    private _ensureKillers(ply: number): void {
        while (this._killers.length <= ply) {
            this._killers.push([0, 0]);
        }
    }

    private _resetKillers(maxPly: number): void {
        for (let i = 0; i < Math.min(this._killers.length, maxPly + 1); i++) {
            this._killers[i] = [0, 0];
        }
    }

    private _getKillers(ply: number): readonly [Move, Move] {
        this._ensureKillers(ply);
        return this._killers[ply]!;
    }

    private _addKiller(ply: number, move: Move): void {
        this._ensureKillers(ply);
        const k = this._killers[ply]!;
        if (move !== k[0]) {
            k[1] = k[0];
            k[0] = move;
        }
    }
}
