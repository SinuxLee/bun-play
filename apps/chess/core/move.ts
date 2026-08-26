import { mirrorSquare, squareToIccs } from "./coords.ts";
import type { Square, Move } from "./constants.ts";

/**
 * 走法编解码工具（纯函数）
 *
 * 走法编码：move = source | (destination << 8)
 *   低 8 位：起始坐标 source
 *   高 8 位：目标坐标 destination
 */

/** 空走法（无效着法占位符）*/
export const MOVE_NONE: Move = 0;

/** 由起点和终点构造走法 */
export function makeMove(source: Square, destination: Square): Move {
    return source | (destination << 8);
}

/** 从走法中提取起始坐标 */
export function moveSource(move: Move): Square {
    return move & 0xFF;
}

/** 从走法中提取目标坐标 */
export function moveDestination(move: Move): Square {
    return (move >>> 8) & 0xFF;
}

/** 获取走法的左右镜像走法 */
export function mirrorMove(move: Move): Move {
    return makeMove(mirrorSquare(moveSource(move)), mirrorSquare(moveDestination(move)));
}

/**
 * 将走法转换为 ICCS 字符串表示
 * ICCS 格式示例："H2-E2"（起点-终点）
 */
export function moveToIccsCoord(move: Move): string {
    return squareToIccs(moveSource(move)) + "-" + squareToIccs(moveDestination(move));
}
