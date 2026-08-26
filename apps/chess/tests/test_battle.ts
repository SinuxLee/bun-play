/**
 * game/test_battle.ts
 * Headless 双机对弈测试脚本（对应 server/battle.js）
 *
 * 用法：
 *   bun run test_battle.ts [maxRounds] [depth] [millis]
 *
 * 示例：
 *   bun run test_battle.ts           # 默认 200步、深度6、1000ms
 *   bun run test_battle.ts 100 4 500
 */

import { Position }                     from "../engine/position.ts";
import { isChecked, generateMoves }     from "../engine/movegen.ts";
import { fromFen, toFen }               from "../engine/fen.ts";
import { moveToIccsCoord }              from "../core/move.ts";
import { Searcher }                     from "../ai/search.ts";
import { repValue }                     from "../engine/evaluate.ts";
import { WIN_VALUE }                    from "../core/constants.ts";

// ── 命令行参数 ──────────────────────────────────────────────────
const MAX_ROUNDS = parseInt(process.argv[2] ?? "") || 200;
const DEPTH      = parseInt(process.argv[3] ?? "") || 6;
const MILLIS     = parseInt(process.argv[4] ?? "") || 1000;

const INIT_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";

// ── 工具函数 ───────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

/** 判断当前行棋方是否被将死（无合法走法） */
function isMate(pos: Position): boolean {
    const moves = generateMoves(pos);
    for (const mv of moves) {
        if (pos.makeMove(mv, isChecked)) {
            pos.undoMakeMove();
            return false;
        }
    }
    return true;
}

// ── 主流程 ─────────────────────────────────────────────────────

async function main(): Promise<void> {
    console.log(`=== Headless 双机对弈 ===`);
    console.log(`最大步数: ${MAX_ROUNDS}  搜索深度: ${DEPTH}  每步限时: ${MILLIS}ms\n`);

    const pos      = new Position();
    const searcher = new Searcher();

    fromFen(pos, INIT_FEN, isChecked);

    let round = 0;
    const startTime = Date.now();

    while (round < MAX_ROUNDS) {
        const side = pos.sdPlayer === 0 ? "红" : "黑";

        const mv = searcher.search(pos, { maxDepth: DEPTH, timeLimit: MILLIS });

        if (!mv) {
            console.log(`[第${round + 1}步] ${side}方无最佳走法，提前结束`);
            break;
        }

        if (!pos.makeMove(mv, isChecked)) {
            console.log(`[第${round + 1}步] ${side}方走法非法，提前结束`);
            break;
        }

        round++;
        const iccs = moveToIccsCoord(mv);
        const fen  = toFen(pos);
        console.log(`第${String(round).padStart(3, " ")}步 [${side}] ${iccs}  ${fen}`);

        // ── 将死检测 ──
        if (isMate(pos)) {
            const loser = pos.sdPlayer === 0 ? "红方" : "黑方";
            console.log(`\n===== ${loser}被将死！游戏结束 =====`);
            break;
        }

        // ── 重复局面检测 ──
        const rep = repValue(pos, 3);
        if (rep !== 0) {
            if (rep > -WIN_VALUE && rep < WIN_VALUE) {
                console.log(`\n===== 双方不变作和 =====`);
            } else {
                const loser = pos.sdPlayer === 0 ? "红方" : "黑方";
                console.log(`\n===== ${loser}长打作负 =====`);
            }
            break;
        }

        await sleep(0); // 让事件循环喘气，避免阻塞
    }

    if (round >= MAX_ROUNDS) {
        console.log(`\n已达 ${MAX_ROUNDS} 步上限，结束`);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n共走 ${round} 步，用时 ${elapsed}s`);
}

main().catch(console.error);
