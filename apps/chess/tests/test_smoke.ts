/**
 * 冒烟测试：验证核心功能
 * bun run test_smoke.ts
 */
import { Battle, GameResult, START_FEN, fromFen, isChecked } from "../index.ts";
import { Position } from "../engine/position.ts";

// 1. 基本构造 + FEN 加载
const battle = new Battle();
console.log("✓ Battle 构造成功");

// 2. 导出 FEN 与初始 FEN 一致（忽略 w/b 以外字段差异）
const fen = battle.exportFen();
const fenBoard = fen.split(" ")[0];
const startBoard = START_FEN.split(" ")[0];
console.assert(fenBoard === startBoard, `FEN 棋盘部分不符: ${fenBoard}`);
console.log("✓ FEN 导出正确:", fen);

// 3. 合法走法查询（炮 b0 = row3, col3+1=4 → sq = 3|(3<<4)=51, 炮位 c3=5+3*16=53）
// 初始局面红炮在 b9（row12, col4 → sq=4|(12<<4)=196）
const dests = battle.legalDests(196);
console.assert(dests.length > 0, "炮应有合法走法");
console.log("✓ 炮合法走法数:", dests.length);

// 4. 执行一步人类走法（炮向前一格）
// 红炮起点 sq=196, 目标 sq=196-16=180
const ev = battle.humanMove(196, 180);
console.assert(ev !== null, "走法应合法");
console.log("✓ 人类走法:", ev?.iccs, "结果:", ev?.result === GameResult.ONGOING ? "进行中" : ev?.result);

// 5. 执行 AI 走法
const aiEv = battle.aiMove({ maxDepth: 4, timeLimit: 3000 });
console.assert(aiEv !== null, "AI 应返回走法");
console.log("✓ AI 走法:", aiEv?.iccs, "FEN:", aiEv?.fen?.split(" ")[0]);

// 6. 撤销
const undoMv = battle.undo();
console.assert(undoMv !== 0, "撤销应成功");
console.log("✓ 撤销成功, 撤销走法:", undoMv.toString(16));

// 7. 直接 Position 层测试
const pos = new Position();
fromFen(pos, START_FEN, isChecked);
console.assert(pos.sdPlayer === 0, "初始行棋方应为红方(0)");
console.log("✓ Position 加载成功, 行棋方:", pos.sdPlayer === 0 ? "红方" : "黑方");
console.log("✓ 红方估值:", pos.vlRed, "黑方估值:", pos.vlBlack);

console.log("\n🎉 所有冒烟测试通过！");
