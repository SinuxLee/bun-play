/**
 * 基础类型别名
 * Square - 棋盘坐标（16×16 一维化，值 0-255）
 * Piece  - 棋子编码（0=空, 8-14=红方, 16-22=黑方）
 * Move   - 走法编码（低8位=source, 高8位=destination）
 */
export type Square = number;
export type Piece  = number;
export type Move   = number;

// ─── 棋子类型 ───────────────────────────────────────────────────

export const PieceType = {
    KING:    0,  // 将/帅
    ADVISOR: 1,  // 士/仕
    BISHOP:  2,  // 象/相
    KNIGHT:  3,  // 马
    ROOK:    4,  // 车
    CANNON:  5,  // 炮
    PAWN:    6,  // 卒/兵
    UNKNOWN: -1,
} as const;
export type PieceType = (typeof PieceType)[keyof typeof PieceType];

// ─── 阵营 ────────────────────────────────────────────────────────

export const Side = {
    RED:   0,
    BLACK: 1,
} as const;
export type Side = (typeof Side)[keyof typeof Side];

// ─── 棋盘坐标范围（16×16 内部坐标系）────────────────────────────

export const BoardRange = {
    TOP:    3,   // 棋盘起始行（含）
    BOTTOM: 12,  // 棋盘结束行（含）
    LEFT:   3,   // 棋盘起始列（含）
    RIGHT:  11,  // 棋盘结束列（含）
} as const;
export type BoardRange = (typeof BoardRange)[keyof typeof BoardRange];

// FEN 棋子字符对照（每8字符一组，共3组；留 ASCII 占位）
export const FEN_PIECE = "        KABNRCP kabnrcp ";

// ─── AI 搜索相关常量 ──────────────────────────────────────────────

/** 将死分值（绝对分） */
export const MATE_VALUE = 10000;

/** 禁手分值（长将/长打判负） */
export const BAN_VALUE = MATE_VALUE - 100;

/** 胜利分值下界（区分普通优势与将死） */
export const WIN_VALUE = MATE_VALUE - 200;

/** 空步裁剪：至少需要此优势才可执行空步 */
export const NULL_OKAY_MARGIN = 200;

/** 空步裁剪：双重验证所需的安全优势 */
export const NULL_SAFE_MARGIN = 400;

/** 平局分值（鼓励先手不选平局） */
export const DRAW_VALUE = 20;

/** 先手加成 */
export const ADVANCED_VALUE = 3;

// ─── 走法生成相关常量 ─────────────────────────────────────────────

/** 老将/车的四方向位移（上下左右）*/
export const KING_DELTA: readonly number[] = [-16, -1, 1, 16];

/** 士的对角线位移 */
export const ADVISOR_DELTA: readonly number[] = [-17, -15, 15, 17];

/** 马的跳跃位移（每方向2个落点）*/
export const KNIGHT_DELTA: readonly (readonly number[])[] = [
    [-33, -31], [-18, 14], [-14, 18], [31, 33],
];

/** 马腿检测位移（判断马脚方向）*/
export const KNIGHT_CHECK_DELTA: readonly (readonly number[])[] = [
    [-33, -18], [-31, -14], [14, 31], [18, 33],
];

/**
 * MVV（Most Valuable Victim）威胁值
 * 对方棋子 将/帅、士、象/相、马、车、炮、卒/兵 对应的价值权重
 */
export const MVV_VALUE: readonly number[] = [50, 10, 10, 30, 40, 30, 20];
