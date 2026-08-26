import { BoardRange, Side } from "../core/constants.ts";
import { makeCoord } from "../core/coords.ts";
import { makePiece } from "../core/piece.ts";
import { PieceType } from "../core/constants.ts";
import type { Move } from "../core/constants.ts";
import type { Position } from "./position.ts";
import type { CheckedFn } from "./position.ts";

/**
 * FEN 序列化/反序列化模块（纯函数）
 *
 * 象棋 FEN 格式示例：
 *   rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
 *
 * 棋子字符对照（大写=红方，小写=黑方）：
 *   K/k=将帅  A/a=士仕  B(E)/b(e)=象相  H(N)/h(n)=马  R/r=车  C/c=炮  P/p=卒兵
 */

/** FEN 棋子字符 → 阵营 + 类型映射 */
const FEN_CHAR_MAP: Record<string, { side: Side; type: PieceType }> = {
    k: { side: Side.BLACK, type: PieceType.KING },    K: { side: Side.RED, type: PieceType.KING },
    a: { side: Side.BLACK, type: PieceType.ADVISOR }, A: { side: Side.RED, type: PieceType.ADVISOR },
    b: { side: Side.BLACK, type: PieceType.BISHOP },  B: { side: Side.RED, type: PieceType.BISHOP },
    e: { side: Side.BLACK, type: PieceType.BISHOP },  E: { side: Side.RED, type: PieceType.BISHOP },
    n: { side: Side.BLACK, type: PieceType.KNIGHT },  N: { side: Side.RED, type: PieceType.KNIGHT },
    h: { side: Side.BLACK, type: PieceType.KNIGHT },  H: { side: Side.RED, type: PieceType.KNIGHT },
    r: { side: Side.BLACK, type: PieceType.ROOK },    R: { side: Side.RED, type: PieceType.ROOK },
    c: { side: Side.BLACK, type: PieceType.CANNON },  C: { side: Side.RED, type: PieceType.CANNON },
    p: { side: Side.BLACK, type: PieceType.PAWN },    P: { side: Side.RED, type: PieceType.PAWN },
};

/** 棋子类型 → FEN 字符（大写=红方）*/
const PIECE_TO_FEN: readonly string[] = ["K", "A", "B", "N", "R", "C", "P"];

/** 初始开局 FEN */
export const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1";

/**
 * 从 FEN 字符串加载局面到 Position
 * @param pos   目标局面对象（会被清空重置）
 * @param fen   FEN 字符串
 * @param checkedFn 将军检测函数
 */
export function fromFen(pos: Position, fen: string, checkedFn: CheckedFn): void {
    pos.clearBoard();

    const parts = fen.trim().split(/\s+/);
    if (parts.length < 1) throw new Error('Invalid FEN: empty string');

    const ranks = parts[0]!.split("/");
    if (ranks.length !== 10) {
        throw new Error(`Invalid FEN: expected 10 ranks, got ${ranks.length}`);
    }

    for (let rank = 0; rank < 10; rank++) {
        const row = rank + BoardRange.TOP;
        let col = BoardRange.LEFT;
        for (const ch of ranks[rank]!) {
            if (ch >= "1" && ch <= "9") {
                col += parseInt(ch, 10);
            } else {
                const info = FEN_CHAR_MAP[ch];
                if (!info) throw new Error(`Invalid FEN: unknown piece character '${ch}'`);
                const square = makeCoord(col, row);
                pos.addPiece(square, makePiece(info.type, info.side), false);
                col++;
            }
        }
    }

    if (parts.length > 1 && parts[1] === "b") {
        pos.changeSide();
    }

    pos.setIrrev(checkedFn(pos));
}

/**
 * 将当前局面导出为 FEN 字符串
 */
export function toFen(pos: Position): string {
    let fen = "";

    for (let rank = 0; rank < 10; rank++) {
        const row = rank + BoardRange.TOP;
        let empty = 0;

        for (let col = 0; col < 9; col++) {
            const square = makeCoord(col + BoardRange.LEFT, row);
            const piece = pos.squares[square]!;
            if (piece === 0) {
                empty++;
            } else {
                if (empty > 0) { fen += empty; empty = 0; }
                const type = piece & 7;
                const side = piece < 16 ? 0 : 1;
                const ch = PIECE_TO_FEN[type]!;
                fen += side === 0 ? ch : ch.toLowerCase();
            }
        }

        if (empty > 0) fen += empty;
        if (rank < 9) fen += "/";
    }

    fen += " " + (pos.sdPlayer === 0 ? "w" : "b");
    fen += " - - 0 1";
    return fen;
}

/**
 * ICCS 字符串解析为走法编码（如 "h2e2" 或 "H2E2"）
 * @returns 走法编码，0 表示解析失败
 */
export function iccsToMove(iccs: string): Move {
    if (!iccs || iccs.length < 4) return 0;
    const str = iccs.toUpperCase();
    const sourceX = str.charCodeAt(0) - "A".charCodeAt(0) + BoardRange.LEFT;
    const sourceY  = BoardRange.TOP + 9 - (str.charCodeAt(1) - "0".charCodeAt(0));
    const destinationX  = str.charCodeAt(2) - "A".charCodeAt(0) + BoardRange.LEFT;
    const destinationY  = BoardRange.TOP + 9 - (str.charCodeAt(3) - "0".charCodeAt(0));
    const source = makeCoord(sourceX, sourceY);
    const destination = makeCoord(destinationX, destinationY);
    return source | (destination << 8);
}
