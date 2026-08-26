import { Position } from "../engine/position.ts";
import { fromFen, toFen, iccsToMove, START_FEN } from "../engine/fen.ts";
import { generateMoves, isChecked } from "../engine/movegen.ts";
import { repValue } from "../engine/evaluate.ts";
import { Searcher } from "../ai/search.ts";
import { WIN_VALUE, Side } from "../core/constants.ts";
import { moveToIccsCoord } from "../core/move.ts";
import type { Move } from "../core/constants.ts";
import type { SearchOptions } from "../ai/search.ts";

/** 游戏结果 */
export const GameResult = {
    ONGOING:   0,
    RED_WIN:   1,  // 红方胜
    BLACK_WIN: 2,  // 黑方胜
    DRAW:      3,  // 平局
} as const;
export type GameResult = (typeof GameResult)[keyof typeof GameResult];

/** 走法事件（供 UI 层监听）*/
export interface MoveEvent {
    /** 走法编码 */
    move: Move;
    /** 走法 ICCS 字符串 */
    iccs: string;
    /** 走棋方：0=红方，1=黑方 */
    side: Side;
    /** 走法后的 FEN */
    fen: string;
    /** 走法后的游戏结果 */
    result: GameResult;
}

/**
 * 对弈管理器
 *
 * 职责：
 *   - 维护 Position 对象（棋盘状态）
 *   - 提供 humanMove / aiMove 接口
 *   - 结果判断（将死 / 困毙 / 长将 / 平局）
 *   - FEN 加载 / 导出
 *   - 合法走法查询
 */
export class Battle {
    private readonly _pos      = new Position();
    private readonly _searcher = new Searcher();

    constructor(fen = START_FEN) {
        this.loadFen(fen);
    }

    // ── FEN ─────────────────────────────────────────────────────

    loadFen(fen: string): void {
        fromFen(this._pos, fen, isChecked);
    }

    exportFen(): string {
        return toFen(this._pos);
    }

    // ── 当前局面信息 ─────────────────────────────────────────────

    /** 当前行棋方 0=红方，1=黑方 */
    get currentSide(): number {
        return this._pos.sdPlayer;
    }

    /** 当前是否处于将军状态 */
    get inCheck(): boolean {
        return this._pos.inCheck();
    }

    // ── 合法走法 ─────────────────────────────────────────────────

    /**
     * 返回从指定格子出发的所有合法目标格
     * （用于 UI 高亮显示可落点）
     */
    legalDests(squareSource: number): number[] {
        const all = generateMoves(this._pos);
        const result: number[] = [];
        for (const move of all) {
            if ((move & 0xFF) !== squareSource) continue;
            if (this._pos.makeMove(move, isChecked)) {
                result.push(move >> 8);
                this._pos.undoMakeMove();
            }
        }
        return result;
    }

    // ── 人类走法 ─────────────────────────────────────────────────

    /**
     * 执行人类走法
     * @param squareSource 起始格
     * @param squareDestination 目标格
     * @returns MoveEvent，或 null 表示非法走法
     */
    humanMove(squareSource: number, squareDestination: number): MoveEvent | null {
        const move = squareSource | (squareDestination << 8);
        return this._doMove(move);
    }

    /**
     * 执行 ICCS 格式走法（用于网络对弈 / 棋谱回放）
     */
    humanMoveIccs(iccs: string): MoveEvent | null {
        const move = iccsToMove(iccs);
        if (move === 0) return null;
        return this._doMove(move);
    }

    // ── AI 走法 ──────────────────────────────────────────────────

    /**
     * 让 AI 搜索并执行最佳走法
     * @param opts 搜索选项（时间限制等）
     */
    aiMove(opts: SearchOptions = {}): MoveEvent | null {
        const move = this._searcher.search(this._pos, opts);
        if (move === 0) return null;
        return this._doMove(move);
    }

    // ── 撤销 ─────────────────────────────────────────────────────

    /** 撤销上一步走法，返回被撤销的走法编码；栈空返回 0 */
    undo(): Move {
        const stack = this._pos.moveStack;
        if (stack.length <= 1) return 0;
        const move = stack[stack.length - 1]!.mv;
        this._pos.undoMakeMove();
        return move;
    }

    // ── 内部辅助 ─────────────────────────────────────────────────

    private _doMove(move: Move): MoveEvent | null {
        const side = this._pos.sdPlayer;
        if (!this._pos.makeMove(move, isChecked)) return null;

        const result = this._checkResult();
        return {
            move,
            iccs: moveToIccsCoord(move),
            side: side as Side,
            fen: toFen(this._pos),
            result,
        };
    }

    private _checkResult(): GameResult {
        // 重复局面（长将）
        const repValue_ = repValue(this._pos, 3);
        if (repValue_ !== 0) {
            if (repValue_ > WIN_VALUE)  return this._pos.sdPlayer === 0 ? GameResult.RED_WIN   : GameResult.BLACK_WIN;
            if (repValue_ < -WIN_VALUE) return this._pos.sdPlayer === 0 ? GameResult.BLACK_WIN : GameResult.RED_WIN;
            return GameResult.DRAW;
        }

        // 无合法走法：将死或困毙
        const moves = generateMoves(this._pos);
        let hasLegal = false;
        for (const move of moves) {
            if (this._pos.makeMove(move, isChecked)) {
                this._pos.undoMakeMove();
                hasLegal = true;
                break;
            }
        }
        if (!hasLegal) {
            return this._pos.sdPlayer === 0 ? GameResult.BLACK_WIN : GameResult.RED_WIN;
        }

        return GameResult.ONGOING;
    }
}
