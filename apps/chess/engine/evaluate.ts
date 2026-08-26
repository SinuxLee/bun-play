import { MATE_VALUE, DRAW_VALUE, ADVANCED_VALUE, WIN_VALUE } from "../core/constants.ts";
import type { Position } from "./position.ts";

/**
 * 局面静态估值模块（纯函数）
 *
 * 所有估值均以「当前行棋方」为正方向：
 *   正值 → 对当前行棋方有利
 *   负值 → 对当前行棋方不利
 */

/** 计算当前局面的静态估值 */
export function evaluate(pos: Position): number {
    const value = (pos.sdPlayer === 0 ? pos.vlRed - pos.vlBlack : pos.vlBlack - pos.vlRed)
        + ADVANCED_VALUE;
    return value === 0 ? DRAW_VALUE : value;
}

/**
 * 历史重复检测
 *
 * 检查当前局面是否在历史中出现过，并判断是否构成"长将"或"长打"。
 * 规则：
 *   长将（单方连续将军导致重复）→ 该方判负（-WIN_VALUE）
 *   一般重复（双方均有非强制性重复）→ 平局（-DRAW_VALUE）
 *
 * @param recur 允许重复几次（默认 1，首次重复即检测）
 * @returns 0=无重复；否则返回相应评分（从当前方视角）
 */
export function repValue(pos: Position, recur = 1): number {
    const stack = pos.moveStack;
    const len = stack.length;

    let selfSide = true;
    let repSelf  = 0;
    let repOpp   = 0;
    let rep      = 0;

    for (let i = len - 1; i >= 1; i--) {
        const entry = stack[i]!;

        if (entry.captured > 0 || entry.mv === 0) break;

        if (entry.prevKey === pos.zobristKey && entry.prevLock === pos.zobristLock) {
            rep++;
            if (rep >= recur) {
                return pos.sdPlayer === 0
                    ? _repScore(repSelf, repOpp)
                    : _repScore(repOpp, repSelf);
            }
        }

        if (selfSide) {
            repSelf += entry.inCheck ? 2 : 0;
        } else {
            repOpp  += entry.inCheck ? 2 : 0;
        }
        selfSide = !selfSide;
    }

    return 0;
}

function _repScore(s: number, o: number): number {
    if (s > o) return -WIN_VALUE;   // 己方长将 → 己方输
    if (o > s) return WIN_VALUE;    // 对方长将 → 己方赢
    return -DRAW_VALUE;             // 双方均衡 → 平局
}

/**
 * 将死/困毙评分
 * 当一方无合法走法时调用，返回输棋分（从当前方视角）。
 * 越早被将死，惩罚越重（鼓励 AI 尽快将死对方）。
 */
export function mateValue(pos: Position): number {
    return pos.inCheck()
        ? pos.distance - MATE_VALUE  // 被将死
        : -DRAW_VALUE;               // 困毙（无子可走但未被将，按平局处理）
}
