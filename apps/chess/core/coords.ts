import { IN_BOARD, IN_FORT } from "./tables.ts";
import { BoardRange, Side } from "./constants.ts";
import type { Square } from "./constants.ts";

/**
 * 棋盘坐标工具（纯函数，无副作用）
 *
 * 内部坐标编码：square = (y << 4) | x
 *   y：行号（0-15），棋盘有效行 3-12
 *   x：列号（0-15），棋盘有效列 3-11
 * 坐标原点在左上角，y 向下增大，x 向右增大
 */

/** 由 x、y 构造坐标值 */
export function makeCoord(x: number, y: number): Square {
    return x | (y << 4);
}

/** 从坐标中提取列值 x（0-15）*/
export function getX(square: Square): number {
    return square & 0xF;
}

/** 从坐标中提取行值 y（0-15）*/
export function getY(square: Square): number {
    return square >> 4;
}

/** 棋盘上下翻转坐标（红黑视角互换）*/
export function flipSquare(square: Square): Square {
    return 254 - square;
}

/** 棋盘左右镜像坐标（X 轴翻转）*/
export function mirrorSquare(square: Square): Square {
    return makeCoord(14 - getX(square), getY(square));
}

/** 判断坐标是否在棋盘有效范围内 */
export function isOnBoard(square: Square): boolean {
    return IN_BOARD[square] !== 0;
}

/** 判断坐标是否在九宫格内（将、士合法区域）*/
export function isInFort(square: Square): boolean {
    return IN_FORT[square] !== 0;
}

/** 判断两个坐标是否在同一行（Y 相同）*/
export function sameRow(squareA: Square, squareB: Square): boolean {
    return ((squareA ^ squareB) & 0xF0) === 0;
}

/** 判断两个坐标是否在同一列（X 相同）*/
export function sameCol(squareA: Square, squareB: Square): boolean {
    return ((squareA ^ squareB) & 0x0F) === 0;
}

/**
 * 判断两个坐标是否在同一半（同属红方区或黑方区）
 * 棋盘上半（黑方）：y < 8，即 square & 0x80 == 0
 * 棋盘下半（红方）：y >= 8，即 square & 0x80 != 0
 */
export function sameHalf(squareA: Square, squareB: Square): boolean {
    return ((squareA ^ squareB) & 0x80) === 0;
}

/**
 * 判断坐标是否在指定方的敌方阵地
 * @param side 0=红方, 1=黑方
 */
export function isEnemyHalf(square: Square, side: Side): boolean {
    return (square & 0x80) === (side << 7);
}

/**
 * 判断坐标是否在指定方的己方阵地
 * @param side 0=红方, 1=黑方
 */
export function isSelfHalf(square: Square, side: Side): boolean {
    return (square & 0x80) !== (side << 7);
}

/**
 * 将棋盘坐标转换为 ICCS 字符（列字母 + 行数字）
 * ICCS 格式：列用 A-I 表示，行用 0-9 表示（从黑方底线 0 开始）
 * 示例："E0"、"H9"
 */
export function squareToIccs(square: Square): string {
    return String.fromCharCode("A".charCodeAt(0) + getX(square) - BoardRange.LEFT) +
           String.fromCharCode("9".charCodeAt(0) - getY(square) + BoardRange.TOP);
}
