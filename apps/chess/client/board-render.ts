/**
 * client/board-render.ts — 终端棋盘文本渲染
 *
 * 将 FEN 字符串渲染为带中文棋子的 ASCII 棋盘。
 * 支持红方/黑方视角翻转。
 */

// ─── 棋子字符映射 ─────────────────────────────────────────────

/** FEN 字母 → 显示用中文（红方用全角，黑方用全角） */
const PIECE_DISPLAY: Record<string, string> = {
    // 红方（大写）
    K: "\x1b[31m帥\x1b[0m", R: "\x1b[31m俥\x1b[0m",
    N: "\x1b[31m傌\x1b[0m", H: "\x1b[31m傌\x1b[0m",
    B: "\x1b[31m相\x1b[0m", E: "\x1b[31m相\x1b[0m",
    A: "\x1b[31m仕\x1b[0m", C: "\x1b[31m炮\x1b[0m",
    P: "\x1b[31m兵\x1b[0m",
    // 黑方（小写）
    k: "\x1b[32m將\x1b[0m", r: "\x1b[32m車\x1b[0m",
    n: "\x1b[32m馬\x1b[0m", h: "\x1b[32m馬\x1b[0m",
    b: "\x1b[32m象\x1b[0m", e: "\x1b[32m象\x1b[0m",
    a: "\x1b[32m士\x1b[0m", c: "\x1b[32m砲\x1b[0m",
    p: "\x1b[32m卒\x1b[0m",
};

const EMPTY_CELL = "．";
const COL_LABELS_RED   = "  ９ ８ ７ ６ ５ ４ ３ ２ １";
const COL_LABELS_BLACK = "  １ ２ ３ ４ ５ ６ ７ ８ ９";
const RIVER = "  ＝＝＝楚河  漢界＝＝＝";

// ─── 公共接口 ─────────────────────────────────────────────────

/**
 * 将 FEN 渲染为终端棋盘字符串
 * @param fen    完整 FEN 字符串
 * @param flipped 是否翻转（黑方视角）
 * @returns 多行字符串，可直接 console.log
 */
export function renderBoard(fen: string, flipped = false): string {
    const board = parseFenToBoard(fen);
    const lines: string[] = [];

    // 列标签
    lines.push(flipped ? COL_LABELS_BLACK : COL_LABELS_RED);
    lines.push("");

    const rowOrder = flipped ? [9, 8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    for (let i = 0; i < 10; i++) {
        const row = rowOrder[i]!;
        const rowNum = flipped ? i : 9 - i;

        const cells: string[] = [];
        const colOrder = flipped ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (const col of colOrder) {
            const piece = board[row]![col];
            cells.push(piece ? (PIECE_DISPLAY[piece] ?? piece) : EMPTY_CELL);
        }

        lines.push(`${rowNum} ${cells.join(" ")}`);

        // 楚河汉界
        if (i === 4) {
            lines.push(RIVER);
        }
    }

    lines.push("");
    lines.push(flipped ? COL_LABELS_BLACK : COL_LABELS_RED);

    return lines.join("\n");
}

/**
 * 渲染最近一步走法的高亮标记
 */
export function renderMoveInfo(iccs: string, side: "red" | "black"): string {
    const sideLabel = side === "red" ? "\x1b[31m红方\x1b[0m" : "\x1b[32m黑方\x1b[0m";
    return `${sideLabel} 走: ${iccs}`;
}

/**
 * 清屏 + 渲染完整的游戏状态
 */
export function renderGameState(
    fen: string,
    flipped: boolean,
    lastMove?: { iccs: string; side: "red" | "black" },
    statusLine?: string,
): string {
    const lines: string[] = [];
    lines.push("\x1b[2J\x1b[H"); // 清屏 + 光标归位
    lines.push("╔══════════════════════════╗");
    lines.push("║    中国象棋 · 联机对战    ║");
    lines.push("╚══════════════════════════╝");
    lines.push("");

    lines.push(renderBoard(fen, flipped));

    if (lastMove) {
        lines.push("");
        lines.push(renderMoveInfo(lastMove.iccs, lastMove.side));
    }

    if (statusLine) {
        lines.push("");
        lines.push(statusLine);
    }

    return lines.join("\n");
}

// ─── 内部工具 ─────────────────────────────────────────────────

/**
 * 将 FEN 的棋盘部分解析为 10×9 的二维数组
 */
function parseFenToBoard(fen: string): (string | null)[][] {
    const boardPart = fen.split(" ")[0] ?? "";
    const ranks = boardPart.split("/");

    const board: (string | null)[][] = [];
    for (const rank of ranks) {
        const row: (string | null)[] = [];
        for (const ch of rank) {
            if (ch >= "1" && ch <= "9") {
                for (let j = 0; j < parseInt(ch, 10); j++) {
                    row.push(null);
                }
            } else {
                row.push(ch);
            }
        }
        // 填充到 9 列
        while (row.length < 9) row.push(null);
        board.push(row);
    }

    // 确保有 10 行
    while (board.length < 10) {
        board.push(Array.from({ length: 9 }, () => null));
    }

    return board;
}
