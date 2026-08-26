import { PieceType, Side } from "./constants.ts";
import type { Piece } from "./constants.ts";

/**
 * 棋子编解码工具（纯函数）
 *
 * 棋子编码规则：
 *   0       - 空格（无子）
 *   8 ~ 14  - 红方棋子（8 + PieceType）
 *   16 ~ 22 - 黑方棋子（16 + PieceType）
 *
 * 阵营标签（sideTag）：
 *   红方：8  （0b00001000）
 *   黑方：16 （0b00010000）
 * 快速判断棋子阵营：piece & sideTag(side) != 0
 */

/** 获取指定阵营的己方标签：0→8（红）, 1→16（黑）*/
export function sideTag(side: Side): number {
    return 8 + (side << 3);
}

/** 获取指定阵营的敌方标签：0→16, 1→8 */
export function oppTag(side: Side): number {
    return 16 - (side << 3);
}

/** 提取棋子类型（0-6，对应 PieceType）*/
export function pieceType(piece: Piece): number {
    return piece & 7;
}

/** 判断棋子是否属于指定阵营 */
export function isSide(piece: Piece, side: Side): boolean {
    return (piece & sideTag(side)) !== 0;
}

/** 构造棋子编码 */
export function makePiece(type: PieceType, side: Side): Piece {
    return sideTag(side) + type;
}

/**
 * 将 FEN 字符映射为棋子类型（大写字母，不区分阵营）
 * 返回 PieceType.UNKNOWN(-1) 表示无效字符
 */
export function charToPieceType(ch: string): PieceType {
    switch (ch) {
        case "K": return PieceType.KING;
        case "A": return PieceType.ADVISOR;
        case "B":
        case "E": return PieceType.BISHOP;
        case "H":
        case "N": return PieceType.KNIGHT;
        case "R": return PieceType.ROOK;
        case "C": return PieceType.CANNON;
        case "P": return PieceType.PAWN;
        default:  return PieceType.UNKNOWN;
    }
}
