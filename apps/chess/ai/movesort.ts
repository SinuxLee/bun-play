import { MVV_VALUE, Side } from "../core/constants.ts";
import { oppTag } from "../core/piece.ts";
import { moveDestination } from "../core/move.ts";
import type { Move } from "../core/constants.ts";
import type { Position } from "../engine/position.ts";

/** 走法排序得分常量 */
const SCORE_HASH_MOVE  = 0x7FFF_FFFF;  // 置换表走法（最高优先）
const SCORE_CAPTURE    = 0x0010_0000;  // 吃子走法基础分 + MVV
const SCORE_KILLER_1   = 0x0008_0000;  // 杀手走法 1
const SCORE_KILLER_2   = 0x0004_0000;  // 杀手走法 2


/**
 * 走法排序模块
 *
 * 排序优先级（从高到低）：
 *   1. 置换表走法（hashMove）  ── 已搜索过的最佳走法
 *   2. 吃子走法（MVV/LVA）    ── 吃高价值子的走法排前面
 *   3. 杀手走法（killer）      ── 同层中导致 beta 截断的非吃子走法
 *   4. 历史表走法（history）   ── 过去搜索中表现好的走法
 */
export class MoveSort {
    private readonly _moves:  Move[];
    private readonly _scores: Int32Array;

    constructor(
        moves: Move[],
        pos: Position,
        hashMove: Move,
        killers: readonly [Move, Move],
        history: Int32Array,
    ) {
        this._moves  = moves;
        this._scores = new Int32Array(moves.length);

        const sqOpp = oppTag(pos.sdPlayer as Side);

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i]!;
            const destination = moveDestination(move);

            if (move === hashMove) {
                this._scores[i] = SCORE_HASH_MOVE;
            } else {
                const target = pos.squares[destination]!;
                if ((target & sqOpp) !== 0) {
                    // 吃子：MVV
                    this._scores[i] = SCORE_CAPTURE + MVV_VALUE[target & 7]!;
                } else if (move === killers[0]) {
                    this._scores[i] = SCORE_KILLER_1;
                } else if (move === killers[1]) {
                    this._scores[i] = SCORE_KILLER_2;
                } else {
                    this._scores[i] = history[move & 0xFFFF] ?? 0;
                }
            }
        }
    }

    /**
     * 每次调用返回当前得分最高的走法（选择排序，不全排）
     * @returns 走法编码，-1 表示走法已全部返回
     */
    next(): Move | -1 {
        if (this._moves.length === 0) return -1;

        let bestIdx = 0;
        for (let i = 1; i < this._moves.length; i++) {
            if (this._scores[i]! > this._scores[bestIdx]!) bestIdx = i;
        }

        const mv = this._moves[bestIdx]!;
        const lastIdx = this._moves.length - 1;
        this._moves[bestIdx]  = this._moves[lastIdx]!;
        this._scores[bestIdx] = this._scores[lastIdx]!;
        this._moves.length--;

        return mv;
    }
}
