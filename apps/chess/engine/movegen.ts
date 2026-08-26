import { IN_BOARD, KNIGHT_PIN } from "../core/tables.ts";
import { KING_DELTA, ADVISOR_DELTA, KNIGHT_DELTA, KNIGHT_CHECK_DELTA, Side } from "../core/constants.ts";
import { sideTag, oppTag } from "../core/piece.ts";
import { makeMove } from "../core/move.ts";
import { isInFort } from "../core/coords.ts";
import type { Move } from "../core/constants.ts";
import type { Position } from "./position.ts";

/**
 * 走法生成模块（纯函数，无副作用）
 *
 * 生成一个 Position 下所有伪合法走法（含吃子与不吃子）。
 * 合法性校验（自将）由 position.makeMove 内部完成。
 *
 * 生成顺序：将 → 士 → 象 → 马 → 车 → 炮 → 卒
 */
export function generateMoves(pos: Position): Move[] {
    const moves: Move[] = [];
    const squareSelf = sideTag(pos.sdPlayer as Side);
    const squareOpp  = oppTag(pos.sdPlayer as Side);

    for (let squareSource = 0; squareSource < 256; squareSource++) {
        const piece = pos.squares[squareSource]!;
        if ((piece & squareSelf) === 0) continue;

        const type = piece & 7;

        switch (type) {
            case 0: { // 将/帅
                for (const delta of KING_DELTA) {
                    const squareDestination = squareSource + delta;
                    if (!IN_BOARD[squareDestination] || !isInFort(squareDestination)) continue;
                    if ((pos.squares[squareDestination]! & squareSelf) === 0) {
                        moves.push(makeMove(squareSource, squareDestination));
                    }
                }
                break;
            }
            case 1: { // 士/仕
                for (const delta of ADVISOR_DELTA) {
                    const squareDestination = squareSource + delta;
                    if (!IN_BOARD[squareDestination] || !isInFort(squareDestination)) continue;
                    if ((pos.squares[squareDestination]! & squareSelf) === 0) {
                        moves.push(makeMove(squareSource, squareDestination));
                    }
                }
                break;
            }
            case 2: { // 象/相
                for (const delta of ADVISOR_DELTA) {
                    const squareMid = squareSource + delta;
                    const squareDestination = squareSource + delta * 2;
                    if (!IN_BOARD[squareDestination]) continue;
                    if (((squareDestination ^ squareSource) & 0x80) !== 0) continue; // 不能过河
                    if (pos.squares[squareMid] !== 0) continue;       // 象眼被堵
                    if ((pos.squares[squareDestination]! & squareSelf) === 0) {
                        moves.push(makeMove(squareSource, squareDestination));
                    }
                }
                break;
            }
            case 3: { // 马
                for (let dir = 0; dir < 4; dir++) {
                    const squareMid = squareSource + KING_DELTA[dir]!;
                    if (!IN_BOARD[squareMid] || pos.squares[squareMid] !== 0) continue;
                    for (const delta of KNIGHT_DELTA[dir]!) {
                        const squareDestination = squareSource + delta;
                        if (!IN_BOARD[squareDestination]) continue;
                        if ((pos.squares[squareDestination]! & squareSelf) === 0) {
                            moves.push(makeMove(squareSource, squareDestination));
                        }
                    }
                }
                break;
            }
            case 4: { // 车
                for (const delta of KING_DELTA) {
                    let squareDestination = squareSource + delta;
                    while (IN_BOARD[squareDestination]) {
                        const target = pos.squares[squareDestination]!;
                        if (target === 0) {
                            moves.push(makeMove(squareSource, squareDestination));
                        } else {
                            if ((target & squareOpp) !== 0) moves.push(makeMove(squareSource, squareDestination));
                            break;
                        }
                        squareDestination += delta;
                    }
                }
                break;
            }
            case 5: { // 炮
                for (const delta of KING_DELTA) {
                    let squareDestination = squareSource + delta;
                    while (IN_BOARD[squareDestination]) {
                        if (pos.squares[squareDestination] === 0) {
                            moves.push(makeMove(squareSource, squareDestination));
                        } else {
                            break;
                        }
                        squareDestination += delta;
                    }
                    squareDestination += delta;
                    while (IN_BOARD[squareDestination]) {
                        const target = pos.squares[squareDestination]!;
                        if (target !== 0) {
                            if ((target & squareOpp) !== 0) moves.push(makeMove(squareSource, squareDestination));
                            break;
                        }
                        squareDestination += delta;
                    }
                }
                break;
            }
            case 6: { // 卒/兵
                const forward = pos.sdPlayer === 0 ? -16 : 16;
                const squareForward = squareSource + forward;
                if (IN_BOARD[squareForward] && (pos.squares[squareForward]! & squareSelf) === 0) {
                    moves.push(makeMove(squareSource, squareForward));
                }
                // 过河后可以左右
                if (((squareSource ^ (pos.sdPlayer === 0 ? 0x80 : 0)) & 0x80) !== 0) {
                    for (const delta of [-1, 1]) {
                        const squareLR = squareSource + delta;
                        if (IN_BOARD[squareLR] && (pos.squares[squareLR]! & squareSelf) === 0) {
                            moves.push(makeMove(squareSource, squareLR));
                        }
                    }
                }
                break;
            }
        }
    }
    return moves;
}

/**
 * 判断当前行棋方的将/帅是否处于被将状态
 */
export function isChecked(pos: Position): boolean {
    const squareOpp  = oppTag(pos.sdPlayer as Side);

    // 从 Position 直接读取己方将/帅位置（O(1)）
    const squareKing = pos.kingSquares[pos.sdPlayer as 0 | 1];
    if (squareKing === undefined || squareKing < 0) return true;

    // 1. 老将对脸
    for (const delta of KING_DELTA) {
        let square = squareKing + delta;
        while (IN_BOARD[square]) {
            const piece = pos.squares[square]!;
            if (piece !== 0) {
                if (piece === squareOpp) return true;
                break;
            }
            square += delta;
        }
    }

    // 2. 马的攻击
    for (let dir = 0; dir < 4; dir++) {
        for (const delta of KNIGHT_CHECK_DELTA[dir]!) {
            const squareSource = squareKing + delta;
            if (!IN_BOARD[squareSource]) continue;
            if (pos.squares[squareSource] !== squareOpp + 3) continue;
            const pin = KNIGHT_PIN[squareKing - squareSource + 256]!;
            if (pos.squares[squareSource + pin] === 0) return true;
        }
    }

    // 3. 车/炮攻击
    for (const delta of KING_DELTA) {
        let square = squareKing + delta;
        let cannon = false;
        while (IN_BOARD[square]) {
            const piece = pos.squares[square]!;
            if (piece !== 0) {
                if (!cannon) {
                    if (piece === squareOpp + 4) return true; // 车
                    cannon = true;
                } else {
                    if (piece === squareOpp + 5) return true; // 炮
                    break;
                }
            }
            square += delta;
        }
    }

    // 4. 卒/兵攻击
    const oppPawn = squareOpp + 6;
    const forwardDelta = pos.sdPlayer === 0 ? -16 : 16;
    if (IN_BOARD[squareKing + forwardDelta] && pos.squares[squareKing + forwardDelta] === oppPawn) return true;
    for (const delta of [-1, 1]) {
        if (IN_BOARD[squareKing + delta] && pos.squares[squareKing + delta] === oppPawn) return true;
    }

    return false;
}
