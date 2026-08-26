/**
 * 性能测试：核心模块和AI搜索
 * 运行: bun run tests/test_performance.ts
 */

import { Position } from "../engine/position.ts";
import { fromFen, START_FEN } from "../engine/fen.ts";
import { generateMoves, isChecked } from "../engine/movegen.ts";
import { Searcher } from "../ai/search.ts";
import { evaluate } from "../engine/evaluate.ts";
import { makeCoord, flipSquare, mirrorSquare } from "../core/coords.ts";
import { makeMove, moveSource, moveDestination } from "../core/move.ts";

// ══════════════════════════════════════════════════════════════════
// 性能测试工具
// ══════════════════════════════════════════════════════════════════

interface BenchmarkResult {
    name: string;
    iterations: number;
    totalMs: number;
    avgMs: number;
    opsPerSec: number;
}

function benchmark(name: string, iterations: number, fn: () => void): BenchmarkResult {
    // 预热
    for (let i = 0; i < 10; i++) fn();
    
    // 正式测试
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const totalMs = performance.now() - start;
    const avgMs = totalMs / iterations;
    const opsPerSec = Math.floor(1000 / avgMs);
    
    return { name, iterations, totalMs, avgMs, opsPerSec };
}

function printResult(result: BenchmarkResult): void {
    console.log(`\n📊 ${result.name}`);
    console.log(`   迭代次数: ${result.iterations.toLocaleString()}`);
    console.log(`   总耗时:   ${result.totalMs.toFixed(2)} ms`);
    console.log(`   平均耗时: ${result.avgMs.toFixed(4)} ms`);
    console.log(`   吞吐量:   ${result.opsPerSec.toLocaleString()} ops/sec`);
}

// ══════════════════════════════════════════════════════════════════
// 坐标运算性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkCoords(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 坐标运算性能测试");
    console.log("═".repeat(60));
    
    const iterations = 1000000;
    
    // 坐标构造
    let result = benchmark("坐标构造 (makeCoord)", iterations, () => {
        for (let x = 3; x <= 11; x++) {
            for (let y = 3; y <= 12; y++) {
                makeCoord(x, y);
            }
        }
    });
    printResult(result);
    
    // 坐标翻转
    const testSquares = Array.from({ length: 90 }, (_, i) => 
        makeCoord(3 + (i % 9), 3 + Math.floor(i / 9))
    );
    
    result = benchmark("坐标翻转 (flipSquare)", iterations, () => {
        for (const square of testSquares) {
            flipSquare(square);
        }
    });
    printResult(result);
    
    // 坐标镜像
    result = benchmark("坐标镜像 (mirrorSquare)", iterations, () => {
        for (const square of testSquares) {
            mirrorSquare(square);
        }
    });
    printResult(result);
}

// ══════════════════════════════════════════════════════════════════
// 走法运算性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkMoves(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 走法运算性能测试");
    console.log("═".repeat(60));
    
    const iterations = 1000000;
    
    // 走法构造
    let result = benchmark("走法构造 (makeMove)", iterations, () => {
        for (let i = 0; i < 100; i++) {
            makeMove(50 + i, 100 + i);
        }
    });
    printResult(result);
    
    // 走法解码
    const testMoves = Array.from({ length: 100 }, (_, i) => makeMove(50 + i, 100 + i));
    
    result = benchmark("走法解码 (moveSource/Destination)", iterations, () => {
        for (const move of testMoves) {
            moveSource(move);
            moveDestination(move);
        }
    });
    printResult(result);
}

// ══════════════════════════════════════════════════════════════════
// 走法生成性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkMoveGeneration(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 走法生成性能测试");
    console.log("═".repeat(60));
    
    const pos = new Position();
    fromFen(pos, START_FEN, isChecked);
    
    const iterations = 100000;
    
    // 初始局面走法生成
    const result = benchmark("初始局面走法生成", iterations, () => {
        generateMoves(pos);
    });
    printResult(result);
    
    // 统计走法数量
    const moves = generateMoves(pos);
    console.log(`\n   初始局面合法走法数: ${moves.length}`);
}

// ══════════════════════════════════════════════════════════════════
// 局面估值性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkEvaluation(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 局面估值性能测试");
    console.log("═".repeat(60));
    
    const pos = new Position();
    fromFen(pos, START_FEN, isChecked);
    
    const iterations = 1000000;
    
    const result = benchmark("静态估值", iterations, () => {
        evaluate(pos);
    });
    printResult(result);
    
    console.log(`\n   初始局面估值: ${evaluate(pos)}`);
}

// ══════════════════════════════════════════════════════════════════
// AI 搜索性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkSearch(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 AI 搜索性能测试");
    console.log("═".repeat(60));
    
    const pos = new Position();
    const searcher = new Searcher();
    
    // 测试不同深度的搜索性能
    const depths = [2, 3, 4, 5, 6];
    
    for (const depth of depths) {
        fromFen(pos, START_FEN, isChecked);
        
        const start = performance.now();
        const bestMove = searcher.search(pos, { maxDepth: depth });
        const elapsed = performance.now() - start;
        
        console.log(`\n📊 深度 ${depth} 搜索`);
        console.log(`   耗时: ${elapsed.toFixed(2)} ms`);
        console.log(`   最佳走法: ${bestMove.toString(16)}`);
        
        // 深度6及以上太慢，只测试一次
        if (depth >= 5) break;
    }
}

// ══════════════════════════════════════════════════════════════════
// 将军检测性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkCheckDetection(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 将军检测性能测试");
    console.log("═".repeat(60));
    
    const pos = new Position();
    fromFen(pos, START_FEN, isChecked);
    
    const iterations = 500000;
    
    const result = benchmark("将军检测 (isChecked)", iterations, () => {
        isChecked(pos);
    });
    printResult(result);
}

// ══════════════════════════════════════════════════════════════════
// 走法执行/撤销性能测试
// ══════════════════════════════════════════════════════════════════

function benchmarkMakeUndo(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🎯 走法执行/撤销性能测试");
    console.log("═".repeat(60));
    
    const pos = new Position();
    fromFen(pos, START_FEN, isChecked);
    
    const moves = generateMoves(pos);
    const legalMoves = moves.filter(move => {
        const ok = pos.makeMove(move, isChecked);
        if (ok) pos.undoMakeMove();
        return ok;
    });
    
    const iterations = 100000;
    
    const result = benchmark("makeMove + undoMakeMove", iterations, () => {
        for (const move of legalMoves) {
            pos.makeMove(move, isChecked);
            pos.undoMakeMove();
        }
    });
    printResult(result);
    
    console.log(`\n   测试走法数: ${legalMoves.length}`);
}

// ══════════════════════════════════════════════════════════════════
// 综合性能报告
// ══════════════════════════════════════════════════════════════════

function generatePerformanceReport(): void {
    console.log("\n" + "═".repeat(60));
    console.log("🏆 综合性能报告");
    console.log("═".repeat(60));
    
    const pos = new Position();
    fromFen(pos, START_FEN, isChecked);
    
    // 走法生成效率
    const moveGenStart = performance.now();
    let totalMoves = 0;
    for (let i = 0; i < 10000; i++) {
        totalMoves += generateMoves(pos).length;
    }
    const moveGenTime = performance.now() - moveGenStart;
    console.log(`\n📈 走法生成效率: ${(totalMoves / moveGenTime * 1000).toFixed(0)} moves/sec`);
    
    // 节点搜索速度（深度4）
    const searcher = new Searcher();
    const searchStart = performance.now();
    searcher.search(pos, { maxDepth: 4, timeLimit: 5000 });
    const searchTime = performance.now() - searchStart;
    console.log(`📈 深度4搜索耗时: ${searchTime.toFixed(2)} ms`);
    
    // 内存使用（粗略估计）
    const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    console.log(`💾 堆内存使用: ${memUsed} MB`);
}

// ══════════════════════════════════════════════════════════════════
// 主函数
// ══════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
    console.log("\n" + "█".repeat(60));
    console.log("⚡ 象棋引擎性能测试套件");
    console.log("█".repeat(60));
    
    benchmarkCoords();
    benchmarkMoves();
    benchmarkMoveGeneration();
    benchmarkEvaluation();
    benchmarkCheckDetection();
    benchmarkMakeUndo();
    benchmarkSearch();
    generatePerformanceReport();
    
    console.log("\n" + "█".repeat(60));
    console.log("✅ 性能测试完成！");
    console.log("█".repeat(60) + "\n");
}

main().catch(console.error);
