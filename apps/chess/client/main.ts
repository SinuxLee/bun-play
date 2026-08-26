#!/usr/bin/env bun
/**
 * client/main.ts — CLI 联机对战客户端
 *
 * 用法:
 *   bun run client/main.ts [--host localhost] [--port 3000]
 */

import { renderGameState } from "./board-render.ts";
import { Position } from "../engine/position.ts";
import { fromFen } from "../engine/fen.ts";
import { isChecked } from "../engine/movegen.ts";
import { Searcher } from "../ai/search.ts";
import { moveToIccsCoord } from "../core/move.ts";
import type { ClientMessage, ServerMessage } from "../room/types.ts";

// ─── 配置 ─────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name: string, defaultValue: string): string {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && args[idx + 1] ? args[idx + 1]! : defaultValue;
}

const HOST = getArg("host", "localhost");
const PORT = getArg("port", "3000");
const WS_URL = `ws://${HOST}:${PORT}/ws`;

// ─── 客户端状态 ────────────────────────────────────────────────

let ws: WebSocket | null = null;
let currentFen = "";
let mySide: "red" | "black" = "red";
let myTurn = false;
let inGame = false;
let roomId = "";
let lastMove: { iccs: string; side: "red" | "black" } | undefined;
let robotProxy = false;
const localPos = new Position();
const localSearcher = new Searcher();
const ROBOT_PROXY_TIME = 2000; // 代打思考时间（毫秒）
// ─── 终端 I/O 工具 ─────────────────────────────────────────────

function print(text: string): void {
    process.stdout.write(text + "\n");
}

function clearAndRender(): void {
    if (!currentFen) return;
    const flipped = mySide === "black";
    const status = myTurn
        ? "\x1b[33m[你的回合] 输入走法 (如 b2e2)，或输入 help 查看命令\x1b[0m"
        : "\x1b[90m等待对手走棋...\x1b[0m";

    print(renderGameState(currentFen, flipped, lastMove, status));
}

// readline 接口 —— 全局单例，避免重复创建 async iterator
import * as readline from "node:readline";

const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
});

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
}

// ─── WebSocket 连接 ────────────────────────────────────────────

function connect(): Promise<void> {
    return new Promise((resolve, reject) => {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            print(`\x1b[32m已连接到服务器 ${WS_URL}\x1b[0m`);
            resolve();
        };

        ws.onerror = (err) => {
            reject(new Error(`连接失败: ${err}`));
        };

        ws.onclose = () => {
            if (inGame) {
                print("\n\x1b[31m与服务器的连接已断开\x1b[0m");
                process.exit(1);
            }
        };

        ws.onmessage = (event) => {
            const msg = JSON.parse(String(event.data)) as ServerMessage;
            handleServerMessage(msg);
        };
    });
}

function send(msg: ClientMessage): void {
    if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
    }
}

// ─── 服务端消息处理 ────────────────────────────────────────────

function handleServerMessage(msg: ServerMessage): void {
    switch (msg.type) {
        case "room_created":
            roomId = msg.roomId;
            mySide = msg.side;
            if (roomId === "MATCHING") {
                print("\x1b[33m正在匹配对手，请稍候...\x1b[0m");
            } else {
                print(`\x1b[32m房间已创建: ${roomId} (你是${msg.side === "red" ? "红方" : "黑方"})\x1b[0m`);
                print("等待对手加入...");
            }
            break;

        case "room_joined":
            roomId = msg.roomId;
            mySide = msg.side;
            print(`\x1b[32m已加入房间 ${roomId} (你是${msg.side === "red" ? "红方" : "黑方"})\x1b[0m`);
            print(`对手: ${msg.opponentName}`);
            break;

        case "opponent_joined":
            print(`\x1b[32m对手 ${msg.opponentName} 已加入\x1b[0m`);
            break;

        case "game_start":
            inGame = true;
            currentFen = msg.fen;
            mySide = msg.yourSide;
            myTurn = msg.yourSide === "red";
            lastMove = undefined;
            fromFen(localPos, currentFen, isChecked);
            print("\n\x1b[1m=== 对局开始 ===\x1b[0m");
            if (robotProxy) print("\x1b[35m[机器人代对局模式 - 思考时间 2s]\x1b[0m");
            clearAndRender();
            if (myTurn) {
                robotProxy ? doRobotProxyMove() : promptForMove();
            }
            break;

        case "move_made":
            currentFen = msg.fen;
            lastMove = { iccs: msg.iccs, side: msg.side };
            myTurn = msg.side !== mySide;
            fromFen(localPos, currentFen, isChecked);
            clearAndRender();
            if (myTurn) {
                robotProxy ? doRobotProxyMove() : promptForMove();
            }
            break;

        case "your_turn":
            myTurn = true;
            clearAndRender();
            robotProxy ? doRobotProxyMove() : promptForMove();
            break;

        case "game_over": {
            inGame = false;
            myTurn = false;
            const resultMap = { red_win: "红方胜", black_win: "黑方胜", draw: "平局" };
            const resultText = resultMap[msg.result];
            const isWin =
                (msg.result === "red_win" && mySide === "red") ||
                (msg.result === "black_win" && mySide === "black");
            const emoji = isWin ? "\x1b[33m" : msg.result === "draw" ? "\x1b[36m" : "\x1b[31m";
            print(`\n${emoji}=== 对局结束: ${resultText} (${msg.reason}) ===\x1b[0m`);
            showMainMenu();
            break;
        }

        case "undo_request":
            print("\n\x1b[33m对手请求悔棋，是否同意？(y/n)\x1b[0m");
            promptForUndoResponse();
            break;

        case "undo_result":
            if (msg.accepted) {
                currentFen = msg.fen;
                print("\x1b[32m悔棋成功\x1b[0m");
                clearAndRender();
            } else {
                print("\x1b[31m悔棋被拒绝\x1b[0m");
            }
            break;

        case "opponent_disconnected":
            print("\n\x1b[31m对手已断线\x1b[0m");
            // game_over 消息会紧跟着到达，由 game_over 处理结束流程
            break;

        case "error":
            print(`\x1b[31m错误: ${msg.message}\x1b[0m`);
            if (myTurn) promptForMove();
            break;

        case "chat":
            print(`\x1b[36m[${msg.from}] ${msg.text}\x1b[0m`);
            break;
    }
}

// ─── 用户交互 ──────────────────────────────────────────────────

async function promptForMove(): Promise<void> {
    while (myTurn && inGame) {
        const input = await prompt("\x1b[33m> \x1b[0m");
        if (!input) continue;

        const cmd = input.toLowerCase();

        if (cmd === "help") {
            print("命令列表:");
            print("  b2e2    走法 (ICCS 格式: 列行列行)");
            print("  undo    请求悔棋");
            print("  resign  认输");
            print("  chat    发送消息");
            print("  board   重新显示棋盘");
            print("  quit    退出游戏");
            continue;
        }

        if (cmd === "undo") {
            send({ type: "undo_request" });
            print("已发送悔棋请求，等待对手回应...");
            return;
        }

        if (cmd === "resign") {
            send({ type: "resign" });
            return;
        }

        if (cmd.startsWith("chat ")) {
            send({ type: "chat", text: input.slice(5) });
            continue;
        }

        if (cmd === "board") {
            clearAndRender();
            continue;
        }

        if (cmd === "quit") {
            send({ type: "resign" });
            process.exit(0);
        }

        // 尝试解析为 ICCS 走法
        if (/^[a-i][0-9][a-i][0-9]$/.test(cmd)) {
            send({ type: "move_iccs", iccs: cmd });
            myTurn = false; // 等待服务器确认
            return;
        }

        print("\x1b[31m无效输入，输入 help 查看帮助\x1b[0m");
    }
}

async function promptForUndoResponse(): Promise<void> {
    const input = await prompt("(y/n) > ");
    const accept = input.toLowerCase().startsWith("y");
    send({ type: "undo_respond", accept });
}

// ─── 主菜单 ───────────────────────────────────────────────────

async function showMainMenu(): Promise<void> {
    robotProxy = false;
    print("");
    print("╔══════════════════════════╗");
    print("║    中国象棋 · 联机对战    ║");
    print("╚══════════════════════════╝");
    print("");
    print("  1. 创建房间 (等待对手)");
    print("  2. 加入房间 (输入房间号)");
    print("  3. 快速匹配");
    print("  4. 人机对战");
    print("  5. 机器人代对局 (AI 自动下棋)");
    print("  6. 退出");
    print("");

    const choice = await prompt("请选择 (1-6): ");

    switch (choice) {
        case "1": {
            const name = await prompt("输入你的昵称: ");
            send({ type: "create_room", name: name || "Player" });
            break;
        }
        case "2": {
            const name = await prompt("输入你的昵称: ");
            const rid = await prompt("输入房间号: ");
            send({ type: "join_room", roomId: rid.toUpperCase(), name: name || "Player" });
            break;
        }
        case "3": {
            const name = await prompt("输入你的昵称: ");
            send({ type: "quick_match", name: name || "Player" });
            break;
        }
        case "4": {
            const name = await prompt("输入你的昵称: ");
            const diff = await prompt("AI 难度 (搜索深度 1-8, 默认 4): ");
            const depth = parseInt(diff, 10) || 4;
            send({
                type: "create_room",
                name: name || "Player",
                vsRobot: true,
                robotDifficulty: Math.max(1, Math.min(8, depth)),
            });
            break;
        }
        case "5": {
            print("\x1b[35m机器人代对局: AI 将在快速匹配中替你下棋\x1b[0m");
            const name = await prompt("输入你的昵称: ");
            robotProxy = true;
            send({ type: "quick_match", name: name || "RoboPlayer" });
            break;
        }
        case "6":
            print("再见!");
            process.exit(0);
            showMainMenu();
    }
}

// ─── 机器人代对局 ─────────────────────────────────────────────

function doRobotProxyMove(): void {
    if (!inGame || !myTurn) return;

    print("\x1b[35m[AI 思考中...2s]\x1b[0m");

    // 使用 setTimeout 让搜索异步执行，不阻塞消息接收
    setTimeout(() => {
        if (!inGame || !myTurn) return;

        const mv = localSearcher.search(localPos, { timeLimit: ROBOT_PROXY_TIME });
        if (mv === 0) {
            print("\x1b[31m[AI 无法找到走法]\x1b[0m");
            return;
        }

        const iccs = moveToIccsCoord(mv);
        print(`\x1b[35m[AI 走法: ${iccs}]\x1b[0m`);
        send({ type: "move_iccs", iccs });
        myTurn = false;
    }, 50);
}

// ─── 入口 ─────────────────────────────────────────────────────

async function main(): Promise<void> {
    print("\x1b[2J\x1b[H"); // 清屏
    print("正在连接服务器...");

    try {
        await connect();
    } catch (err) {
        print(`\x1b[31m${err}\x1b[0m`);
        print(`请确保服务器已启动: bun run server/main.ts`);
        process.exit(1);
    }

    await showMainMenu();
}

main().catch(console.error);
