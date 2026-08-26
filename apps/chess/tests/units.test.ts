/**
 * 单元测试：核心功能模块
 * 运行: bun test tests/test_units.ts
 */

import { describe, test, expect } from "bun:test";
import { 
    makeCoord, getX, getY, 
    flipSquare, mirrorSquare, 
    isOnBoard, isInFort, 
    sameRow, sameCol, sameHalf,
    squareToIccs 
} from "../core/coords.ts";
import { 
    makeMove, moveSource, moveDestination, 
    mirrorMove, MOVE_NONE 
} from "../core/move.ts";
import { 
    sideTag, oppTag, pieceType, 
    isSide, makePiece 
} from "../core/piece.ts";
import { PieceType, BoardRange } from "../core/constants.ts";

// ══════════════════════════════════════════════════════════════════
// 坐标工具测试
// ══════════════════════════════════════════════════════════════════

describe("坐标工具 (coords)", () => {
    test("makeCoord 应正确构造坐标", () => {
        expect(makeCoord(3, 3)).toBe(51);  // 3 | (3 << 4) = 51
        expect(makeCoord(11, 12)).toBe(203); // 11 | (12 << 4) = 203
    });

    test("getX/getY 应正确提取坐标分量", () => {
        const square = makeCoord(5, 7);
        expect(getX(square)).toBe(5);
        expect(getY(square)).toBe(7);
    });

    test("flipSquare 应正确翻转坐标", () => {
        const square = makeCoord(5, 3); // 红方区域
        const flipped = flipSquare(square);
        expect(getY(flipped)).toBe(12); // 翻转到黑方区域
    });

    test("mirrorSquare 应正确镜像坐标", () => {
        const square = makeCoord(3, 5); // 左侧
        const mirrored = mirrorSquare(square);
        expect(getX(mirrored)).toBe(11); // 镜像到右侧
        expect(getY(mirrored)).toBe(5);  // Y坐标不变
    });

    test("isOnBoard 应正确判断坐标是否在棋盘上", () => {
        expect(isOnBoard(makeCoord(3, 3))).toBe(true);   // 左上角
        expect(isOnBoard(makeCoord(11, 12))).toBe(true); // 右下角
        expect(isOnBoard(makeCoord(0, 0))).toBe(false);  // 棋盘外
        expect(isOnBoard(makeCoord(15, 15))).toBe(false);// 棋盘外
    });

    test("isInFort 应正确判断是否在九宫格", () => {
        expect(isInFort(makeCoord(6, 3))).toBe(true);   // 黑方九宫中心
        expect(isInFort(makeCoord(6, 12))).toBe(true);  // 红方九宫中心
        expect(isInFort(makeCoord(3, 6))).toBe(false);  // 九宫外
    });

    test("sameRow 应正确判断是否同行", () => {
        const sq1 = makeCoord(3, 5);
        const sq2 = makeCoord(8, 5);
        const sq3 = makeCoord(3, 7);
        expect(sameRow(sq1, sq2)).toBe(true);
        expect(sameRow(sq1, sq3)).toBe(false);
    });

    test("sameCol 应正确判断是否同列", () => {
        const sq1 = makeCoord(5, 3);
        const sq2 = makeCoord(5, 10);
        const sq3 = makeCoord(7, 3);
        expect(sameCol(sq1, sq2)).toBe(true);
        expect(sameCol(sq1, sq3)).toBe(false);
    });

    test("sameHalf 应正确判断是否在同半", () => {
        const redSq1 = makeCoord(5, 9);
        const redSq2 = makeCoord(6, 11);
        const blackSq = makeCoord(5, 5);
        expect(sameHalf(redSq1, redSq2)).toBe(true);
        expect(sameHalf(redSq1, blackSq)).toBe(false);
    });

    test("squareToIccs 应正确转换为 ICCS 格式", () => {
        expect(squareToIccs(makeCoord(6, 12))).toBe("D0"); // 红方底线中心
        expect(squareToIccs(makeCoord(6, 3))).toBe("D9");  // 黑方底线中心
        expect(squareToIccs(makeCoord(3, 7))).toBe("A5");  // 左侧
    });
});

// ══════════════════════════════════════════════════════════════════
// 走法工具测试
// ══════════════════════════════════════════════════════════════════

describe("走法工具 (move)", () => {
    test("makeMove 应正确构造走法", () => {
        const source = 100;
        const dest = 116;
        const move = makeMove(source, dest);
        expect(move).toBe(source | (dest << 8));
    });

    test("moveSource/moveDestination 应正确提取走法分量", () => {
        const source = 100;
        const dest = 116;
        const move = makeMove(source, dest);
        expect(moveSource(move)).toBe(source);
        expect(moveDestination(move)).toBe(dest);
    });

    test("MOVE_NONE 应为 0", () => {
        expect(MOVE_NONE).toBe(0);
    });

    test("mirrorMove 应正确镜像走法", () => {
        const source = makeCoord(3, 5);
        const dest = makeCoord(3, 7);
        const move = makeMove(source, dest);
        const mirrored = mirrorMove(move);
        
        const mirroredSource = moveSource(mirrored);
        const mirroredDest = moveDestination(mirrored);
        
        expect(getX(mirroredSource)).toBe(11); // X镜像
        expect(getX(mirroredDest)).toBe(11);
    });
});

// ══════════════════════════════════════════════════════════════════
// 棋子工具测试
// ══════════════════════════════════════════════════════════════════

describe("棋子工具 (piece)", () => {
    test("sideTag 应返回正确的阵营标签", () => {
        expect(sideTag(0)).toBe(8);  // 红方
        expect(sideTag(1)).toBe(16); // 黑方
    });

    test("oppTag 应返回正确的敌方标签", () => {
        expect(oppTag(0)).toBe(16); // 红方的敌人是黑方
        expect(oppTag(1)).toBe(8);  // 黑方的敌人是红方
    });

    test("makePiece 应正确构造棋子编码", () => {
        const redKing = makePiece(PieceType.KING, 0);
        const blackKing = makePiece(PieceType.KING, 1);
        expect(redKing).toBe(8);  // 8 + 0
        expect(blackKing).toBe(16); // 16 + 0
    });

    test("pieceType 应正确提取棋子类型", () => {
        const redRook = makePiece(PieceType.ROOK, 0);
        const blackPawn = makePiece(PieceType.PAWN, 1);
        expect(pieceType(redRook)).toBe(PieceType.ROOK);
        expect(pieceType(blackPawn)).toBe(PieceType.PAWN);
    });

    test("isSide 应正确判断棋子阵营", () => {
        const redKing = makePiece(PieceType.KING, 0);
        const blackKing = makePiece(PieceType.KING, 1);
        expect(isSide(redKing, 0)).toBe(true);
        expect(isSide(redKing, 1)).toBe(false);
        expect(isSide(blackKing, 1)).toBe(true);
        expect(isSide(blackKing, 0)).toBe(false);
    });
});

// ══════════════════════════════════════════════════════════════════
// 边界条件测试
// ══════════════════════════════════════════════════════════════════

describe("边界条件测试", () => {
    test("棋盘边界坐标应正确", () => {
        const topLeft = makeCoord(BoardRange.LEFT, BoardRange.TOP);
        const bottomRight = makeCoord(BoardRange.RIGHT, BoardRange.BOTTOM);
        
        expect(isOnBoard(topLeft)).toBe(true);
        expect(isOnBoard(bottomRight)).toBe(true);
        expect(isOnBoard(makeCoord(BoardRange.LEFT - 1, BoardRange.TOP))).toBe(false);
        expect(isOnBoard(makeCoord(BoardRange.RIGHT + 1, BoardRange.BOTTOM))).toBe(false);
    });

    test("走法编解码应可逆", () => {
        for (let source = 0; source < 256; source += 17) {
            for (let dest = 0; dest < 256; dest += 19) {
                const move = makeMove(source, dest);
                expect(moveSource(move)).toBe(source);
                expect(moveDestination(move)).toBe(dest);
            }
        }
    });

    test("坐标翻转应可逆", () => {
        for (let x = 3; x <= 11; x++) {
            for (let y = 3; y <= 12; y++) {
                const square = makeCoord(x, y);
                const flipped = flipSquare(square);
                const restored = flipSquare(flipped);
                expect(restored).toBe(square);
            }
        }
    });
});

console.log("\n✅ 所有单元测试定义完成！运行 'bun test' 查看结果");
