/**
 * jschess game 包统一导出入口
 *
 * 外部使用者只需从此文件导入：
 *   import { Battle, GameResult } from "jschess-game";
 *
 * 分层结构：
 *   core/    - 常量、坐标、走法、棋子编解码、静态查询表、Zobrist 哈希
 *   engine/  - 局面模型（Position）、走法生成、静态估值、FEN 序列化
 *   ai/      - 置换表、历史表、走法排序、Alpha-Beta 搜索
 *   game/    - 对弈管理器（Battle）
 */

// ── 常用类型别名 ─────────────────────────────────────────────────
export type { Square, Piece, Move } from "./core/constants.ts";

// ── 枚举 ─────────────────────────────────────────────────────────
export { PieceType, Side, BoardRange } from "./core/constants.ts";

// ── AI 搜索常量 ───────────────────────────────────────────────────
export {
    MATE_VALUE, WIN_VALUE, BAN_VALUE, DRAW_VALUE,
    ADVANCED_VALUE,
} from "./core/constants.ts";

// ── 坐标工具 ──────────────────────────────────────────────────────
export {
    makeCoord, getX, getY,
    flipSquare, mirrorSquare,
    isOnBoard, isInFort,
    sameRow, sameCol, sameHalf,
    squareToIccs,
} from "./core/coords.ts";

// ── 走法编解码 ────────────────────────────────────────────────────
export { MOVE_NONE, makeMove, moveSource, moveDestination, mirrorMove } from "./core/move.ts";

// ── 棋子编解码 ────────────────────────────────────────────────────
export { sideTag, oppTag, pieceType, isSide, makePiece } from "./core/piece.ts";

// ── 局面模型 ──────────────────────────────────────────────────────
export { Position } from "./engine/position.ts";
export type { MoveRecord, CheckedFn } from "./engine/position.ts";

// ── 走法生成 & 将军检测 ───────────────────────────────────────────
export { generateMoves, isChecked } from "./engine/movegen.ts";

// ── 估值 ─────────────────────────────────────────────────────────
export { evaluate, repValue, mateValue } from "./engine/evaluate.ts";

// ── FEN ──────────────────────────────────────────────────────────
export {
    START_FEN, fromFen, toFen,
    iccsToMove,
} from "./engine/fen.ts";

// ── AI ───────────────────────────────────────────────────────────
export { Searcher } from "./ai/search.ts";
export type { SearchOptions } from "./ai/search.ts";

// ── 对弈管理 ─────────────────────────────────────────────────────
export { Battle, GameResult } from "./game/battle.ts";
export type { MoveEvent } from "./game/battle.ts";
