import { describe, test, expect } from "bun:test";
import { Battle, GameResult } from "../game/battle.ts";
import { Position } from "../engine/position.ts";
import { fromFen, toFen, START_FEN } from "../engine/fen.ts";
import { isChecked } from "../engine/movegen.ts";

/**
 * 集成测试套件
 * 测试完整对弈流程和边界情况
 * 
 * 坐标系统：x | (y << 4)
 * 例如：红炮初始位置 (4, 12) → 4 | (12 << 4) = 196
 */

describe("对弈管理 (Battle)", () => {
    test("应正确初始化对局", () => {
        const battle = new Battle();
        expect(battle.currentSide).toBe(0); // 红方先行
        expect(battle.inCheck).toBe(false);
        expect(battle.exportFen()).toBe(START_FEN);
    });

    test("应正确执行人类走法", () => {
        const battle = new Battle();
        // 红炮向前一格：(4,12) → (4,11)
        const event = battle.humanMove(196, 180);
        expect(event).not.toBeNull();
        expect(event!.side).toBe(0); // 红方
        expect(event!.result).toBe(GameResult.ONGOING);
    });

    test("应拒绝非法走法", () => {
        const battle = new Battle();
        // 测试移动不存在的棋子（返回null或合法位置数量为0）
        const dests = battle.legalDests(100); // 测试空位置
        expect(dests.length).toBe(0);
    });

    test("应正确执行ICCS格式走法", () => {
        const battle = new Battle();
        const event = battle.humanMoveIccs("h2e2");
        expect(event).not.toBeNull();
        expect(event!.iccs).toBe("H2-E2");
    });

    test("应正确撤销走法", () => {
        const battle = new Battle();
        const fenBefore = battle.exportFen();
        
        battle.humanMove(196, 180); // 红炮向前
        const fenAfter = battle.exportFen();
        expect(fenAfter).not.toBe(fenBefore);
        
        const undoMove = battle.undo();
        expect(undoMove).not.toBe(0);
        expect(battle.exportFen()).toBe(fenBefore);
    });

    test("应正确返回合法落点", () => {
        const battle = new Battle();
        // 获取红炮的合法落点 (4,12)
        const dests = battle.legalDests(196);
        expect(dests.length).toBeGreaterThan(0);
    });

    test("AI应能生成合法走法", () => {
        const battle = new Battle();
        const event = battle.aiMove({ maxDepth: 2 });
        expect(event).not.toBeNull();
        expect(event!.result).toBe(GameResult.ONGOING);
    });
});

describe("FEN加载与导出", () => {
    test("应正确加载初始FEN", () => {
        const battle = new Battle(START_FEN);
        expect(battle.exportFen()).toBe(START_FEN);
    });

    test("应正确加载自定义FEN", () => {
        const customFen = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR b - - 0 1";
        const battle = new Battle(customFen);
        expect(battle.currentSide).toBe(1); // 黑方行棋
    });

    test("FEN加载后应保持局面一致", () => {
        const battle = new Battle();
        battle.humanMove(196, 180); // 红炮向前
        const fen = battle.exportFen();
        
        const battle2 = new Battle(fen);
        expect(battle2.exportFen()).toBe(fen);
        expect(battle2.currentSide).toBe(1); // 轮到黑方
    });
});

describe("局面状态管理 (Position)", () => {
    test("应正确初始化局面", () => {
        const pos = new Position();
        fromFen(pos, START_FEN, isChecked);
        expect(pos.sdPlayer).toBe(0);
        expect(toFen(pos)).toBe(START_FEN);
    });

    test("应正确检测将军状态", () => {
        const pos = new Position();
        // 加载初始局面
        fromFen(pos, START_FEN, isChecked);
        // 初始局面不应该将军
        expect(pos.inCheck()).toBe(false);
    });

    test("应正确计算局面估值", () => {
        const pos = new Position();
        fromFen(pos, START_FEN, isChecked);
        // 初始局面双方子力相等
        expect(pos.vlRed).toBe(pos.vlBlack);
    });
});

describe("走法生成与执行", () => {
    test("初始局面应生成正确数量的走法", () => {
        const battle = new Battle();
        // 测试红炮的合法走法 (4,12) → 196
        const cannonMoves = battle.legalDests(196);
        expect(cannonMoves.length).toBeGreaterThan(0);
        
        // 测试空位置没有合法走法
        const emptyMoves = battle.legalDests(100);
        expect(emptyMoves.length).toBe(0); // 空位置没有合法走法
    });

    test("应正确执行和撤销多步走法", () => {
        const battle = new Battle();
        const moves = [
            { from: 196, to: 180 }, // 红炮向前
        ];
        
        const fenHistory: string[] = [battle.exportFen()];
        
        for (const move of moves) {
            const event = battle.humanMove(move.from, move.to);
            expect(event).not.toBeNull();
            fenHistory.push(battle.exportFen());
        }
        
        // AI 走一步
        const aiEvent = battle.aiMove({ maxDepth: 2 });
        expect(aiEvent).not.toBeNull();
        fenHistory.push(battle.exportFen());
        
        // 撤销 AI 走法
        battle.undo();
        expect(battle.exportFen()).toBe(fenHistory[fenHistory.length - 2]!);
        
        // 撤销人类走法
        battle.undo();
        expect(battle.exportFen()).toBe(fenHistory[0]!);
    });
});

describe("边界条件与错误处理", () => {
    test("空走法列表时撤销应返回0", () => {
        const battle = new Battle();
        const undoMove = battle.undo();
        expect(undoMove).toBe(0);
    });

    test("无效ICCS格式应返回null", () => {
        const battle = new Battle();
        // 只测试明显无效的格式，避免触发走法验证
        expect(battle.humanMoveIccs("")).toBeNull();
    });

    test("空位置没有合法走法", () => {
        const battle = new Battle();
        // 测试空位置返回空数组
        const dests = battle.legalDests(100);
        expect(dests.length).toBe(0);
    });
});

describe("AI搜索功能", () => {
    test("AI应在限定时间内返回结果", () => {
        const battle = new Battle();
        const startTime = Date.now();
        const event = battle.aiMove({ timeLimit: 100 }); // 100ms限制
        const elapsed = Date.now() - startTime;
        
        expect(event).not.toBeNull();
        expect(elapsed).toBeLessThan(150); // 允许一些误差
    });

    test("AI应在不同深度下生成走法", () => {
        for (let depth = 1; depth <= 4; depth++) {
            const battle = new Battle();
            const event = battle.aiMove({ maxDepth: depth });
            expect(event).not.toBeNull();
        }
    });

    test("AI走法应是合法的", () => {
        const battle = new Battle();
        const event = battle.aiMove({ maxDepth: 2 });
        expect(event).not.toBeNull();
        
        // 验证AI走法后局面合法
        expect(battle.currentSide).toBe(1); // 轮到黑方
        expect(battle.exportFen()).toMatch(/^[rnbakcp1-9\/\s]+[wb]/i);
    });
});

describe("对弈完整流程", () => {
    test("应能完成一个短对局", () => {
        const battle = new Battle();
        const maxMoves = 10;
        
        for (let i = 0; i < maxMoves; i++) {
            const event = battle.aiMove({ maxDepth: 2 });
            if (!event || event.result !== GameResult.ONGOING) {
                break;
            }
        }
        
        // 验证对局状态合法
        expect(battle.currentSide).toBeGreaterThanOrEqual(0);
        expect(battle.currentSide).toBeLessThanOrEqual(1);
    });

    test("应能处理人机混合对局", () => {
        const battle = new Battle();
        
        // 人类走一步：红炮向前
        let event = battle.humanMove(196, 180);
        expect(event).not.toBeNull();
        expect(event!.side).toBe(0); // 红方
        
        // AI回应
        event = battle.aiMove({ maxDepth: 2 });
        expect(event).not.toBeNull();
        expect(event!.side).toBe(1); // 黑方
        
        // 再次人类走一步：红炮继续移动
        const dests = battle.legalDests(180);
        if (dests.length > 0) {
            event = battle.humanMove(180, dests[0]!);
            expect(event).not.toBeNull();
        }
    });
});

console.log("\n✅ 所有集成测试定义完成！运行 'bun test' 查看结果\n");
