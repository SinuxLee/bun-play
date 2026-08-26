/**
 * tests/test_e2e_server.ts — 端到端测试
 *
 * 1. 启动 WebSocket 服务器
 * 2. 客户端 A 创建人机房间，AI 自动回应
 * 3. 客户端 B 创建房间，客户端 C 加入，双人对战
 * 4. 快速匹配测试
 * 5. 清理退出
 */

import type { ServerMessage, ClientMessage } from "../room/types.ts";

// 运行期选择空闲端口，避免本机端口占用导致不稳定
let PORT = 0;

// ─── 工具函数 ──────────────────────────────────────────────────

function send(ws: WebSocket, msg: ClientMessage): void {
    ws.send(JSON.stringify(msg));
}

function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}

async function streamToString(stream: ReadableStream<Uint8Array> | null): Promise<string> {
    if (!stream) return "";
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let out = "";
    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) out += decoder.decode(value, { stream: true });
    }
    out += decoder.decode();
    return out;
}

async function waitForServerReady(port: number, timeoutMs = 5000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`http://localhost:${port}/status`);
            if (res.ok) return;
        } catch {
            // ignore and retry
        }
        await sleep(100);
    }
    throw new Error(`Server not ready on port ${port}`);
}

async function startServerOnPort(port: number): Promise<ReturnType<typeof Bun.spawn>> {
    const proc = Bun.spawn(["bun", "run", "server/main.ts"], {
        env: { ...process.env, PORT: String(port) },
        stdout: "pipe",
        stderr: "pipe",
    });

    // 若提前退出，尽量把 stderr 打出来，方便定位问题
    const exitEarly = proc.exited.then(async (code) => {
        const stderr = await streamToString(proc.stderr);
        throw new Error(`Server exited early (code=${code}).\n${stderr}`.trim());
    });

    await Promise.race([waitForServerReady(port, 7000), exitEarly]);
    return proc;
}

async function startServerFindPort(tries = 30): Promise<{ proc: ReturnType<typeof Bun.spawn>; port: number }> {
    let lastError: unknown = null;
    for (let i = 0; i < tries; i++) {
        const port = 20000 + Math.floor(Math.random() * 20000); // 20000-39999
        try {
            const proc = await startServerOnPort(port);
            return { proc, port };
        } catch (err) {
            lastError = err;
            const msg = String(err);
            if (msg.includes("EADDRINUSE") || msg.includes("Is port") || msg.includes("listen")) {
                continue;
            }
            throw err;
        }
    }
    const suffix = lastError ? `\nLast error:\n${String(lastError)}` : "";
    throw new Error(`Could not find a free port after ${tries} tries.${suffix}`);
}

/**
 * 创建一个带消息缓冲的 WebSocket 包装器。
 * 所有收到的消息都会入队，waitFor 从队列中取消息。
 */
interface BufferedWs {
    readonly ws: WebSocket;
    waitFor(type: string, timeoutMs?: number): Promise<ServerMessage>;
    close(): void;
}

function bufferWs(ws: WebSocket): BufferedWs {
    const queue: ServerMessage[] = [];
    const waiters: { type: string; resolve: (msg: ServerMessage) => void; timer: ReturnType<typeof setTimeout> }[] = [];

    ws.addEventListener("message", (event) => {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        // 检查是否有等待者要这种类型
        const idx = waiters.findIndex(w => w.type === msg.type);
        if (idx >= 0) {
            const waiter = waiters.splice(idx, 1)[0]!;
            clearTimeout(waiter.timer);
            waiter.resolve(msg);
        } else {
            queue.push(msg);
        }
    });

    return {
        ws,
        waitFor(type: string, timeoutMs = 10000): Promise<ServerMessage> {
            // 先从缓冲队列中找
            const idx = queue.findIndex(m => m.type === type);
            if (idx >= 0) {
                return Promise.resolve(queue.splice(idx, 1)[0]!);
            }
            // 否则等待
            return new Promise((resolve, reject) => {
                const timer = setTimeout(
                    () => {
                        const i = waiters.findIndex(w => w.resolve === resolve);
                        if (i >= 0) waiters.splice(i, 1);
                        reject(new Error(`Timeout waiting for: ${type}`));
                    },
                    timeoutMs,
                );
                waiters.push({ type, resolve, timer });
            });
        },
        close() { ws.close(); },
    };
}

function connect(): Promise<BufferedWs> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${PORT}/ws`);
        ws.addEventListener("open", () => resolve(bufferWs(ws)));
        ws.addEventListener("error", (e) => reject(e));
    });
}

// ─── 测试入口 ─────────────────────────────────────────────────────

let serverProc: ReturnType<typeof Bun.spawn> | null = null;

async function main() {
    console.log("═══ 端到端测试开始 ═══\n");

    // 1. 启动服务器
    console.log("[1] 启动服务器...");
    const started = await startServerFindPort();
    serverProc = started.proc;
    PORT = started.port;
    console.log(`    服务器已启动 (PID: ${serverProc.pid}, PORT: ${PORT})`);

    // 2. 测试 1: 人机对战
    console.log("\n[2] 测试人机对战...");
    {
        const c = await connect();
        console.log("    已连接");

        send(c.ws, { type: "create_room", name: "TestPlayer", vsRobot: true, robotDifficulty: 2 });
        const created = await c.waitFor("room_created") as { roomId: string };
        console.log(`    房间创建成功: ${created.roomId}`);

        const start = await c.waitFor("game_start") as { fen: string };
        console.log(`    对局开始, FEN: ${start.fen.substring(0, 30)}...`);

        await c.waitFor("your_turn");
        console.log("    收到 your_turn");

        // 炮二平五
        send(c.ws, { type: "move_iccs", iccs: "b2e2" });
        const moveMade = await c.waitFor("move_made") as { iccs: string };
        console.log(`    走法确认: ${moveMade.iccs}`);

        // 等待 AI 回应
        const aiMove = await c.waitFor("move_made", 15000) as { iccs: string };
        console.log(`    AI 回应: ${aiMove.iccs}`);

        await c.waitFor("your_turn");
        console.log("    收到第二回合 your_turn");

        // 认输
        send(c.ws, { type: "resign" });
        const gameOver = await c.waitFor("game_over") as { result: string; reason: string };
        console.log(`    对局结束: ${gameOver.result} (${gameOver.reason})`);

        c.close();
        console.log("    ✅ 人机对战测试通过");
    }

    // 3. 测试 2: 双人对战（创建+加入房间）
    console.log("\n[3] 测试双人对战...");
    {
        const a = await connect();
        const b = await connect();
        console.log("    两个客户端已连接");

        // A 创建房间
        send(a.ws, { type: "create_room", name: "Alice" });
        const created = await a.waitFor("room_created") as { roomId: string };
        console.log(`    Alice 创建房间: ${created.roomId}`);

        // B 加入房间
        send(b.ws, { type: "join_room", roomId: created.roomId, name: "Bob" });
        const joined = await b.waitFor("room_joined") as { roomId: string };
        console.log(`    Bob 加入房间: ${joined.roomId}`);

        // A 收到 opponent_joined
        const oppJoined = await a.waitFor("opponent_joined") as { opponentName: string };
        console.log(`    Alice 收到对手加入: ${oppJoined.opponentName}`);

        // 双方收到 game_start
        await a.waitFor("game_start");
        await b.waitFor("game_start");
        console.log("    对局开始");

        // A (红方) 收到 your_turn
        await a.waitFor("your_turn");
        console.log("    Alice 收到 your_turn");

        // A 走棋
        send(a.ws, { type: "move_iccs", iccs: "b2e2" });
        await a.waitFor("move_made");
        const bMove = await b.waitFor("move_made") as { iccs: string };
        console.log(`    走法广播: ${bMove.iccs}`);

        // B 收到 your_turn
        await b.waitFor("your_turn");
        console.log("    Bob 收到 your_turn");

        // B 走棋
        send(b.ws, { type: "move_iccs", iccs: "h7e7" });
        await a.waitFor("move_made");
        await b.waitFor("move_made");
        console.log("    Bob 走法广播成功");

        // B 认输
        send(b.ws, { type: "resign" });
        const overA = await a.waitFor("game_over") as { result: string };
        const overB = await b.waitFor("game_over") as { result: string };
        console.log(`    对局结束: A=${overA.result} B=${overB.result}`);

        a.close();
        b.close();
        console.log("    ✅ 双人对战测试通过");
    }

    // 4. 测试 3: 快速匹配
    console.log("\n[4] 测试快速匹配...");
    {
        const a = await connect();
        const b = await connect();

        // A 请求匹配（入队等待）
        send(a.ws, { type: "quick_match", name: "Player1" });
        const queued = await a.waitFor("room_created") as { roomId: string };
        console.log(`    Player1 入队: roomId=${queued.roomId}`);

        // B 请求匹配（应立即配对）
        send(b.ws, { type: "quick_match", name: "Player2" });

        // A 收到 room_joined (匹配成功通知)
        const matchedA = await a.waitFor("room_joined") as { roomId: string };
        console.log(`    Player1 匹配成功: room=${matchedA.roomId}`);

        // 双方收到 game_start
        await a.waitFor("game_start");
        await b.waitFor("game_start");
        console.log("    匹配对局开始");

        a.close();
        b.close();
        console.log("    ✅ 快速匹配测试通过");
    }

    // 5. 测试 4: 错误处理
    console.log("\n[5] 测试错误处理...");
    {
        const c = await connect();

        // 走棋但未加入房间
        send(c.ws, { type: "move_iccs", iccs: "b2e2" });
        const err1 = await c.waitFor("error") as { message: string };
        console.log(`    未加入房间走棋: "${err1.message}"`);

        // 加入不存在的房间
        send(c.ws, { type: "join_room", roomId: "ZZZZ", name: "Nobody" });
        const err2 = await c.waitFor("error") as { message: string };
        console.log(`    加入不存在房间: "${err2.message}"`);

        c.close();
        console.log("    ✅ 错误处理测试通过");
    }

    console.log("\n═══ 所有端到端测试通过 ═══");
}

// ─── 运行 ─────────────────────────────────────────────────────

main()
    .catch(err => {
        console.error("❌ 测试失败:", err);
        process.exitCode = 1;
    })
    .finally(() => {
        if (serverProc) {
            serverProc.kill();
            console.log("\n服务器已停止");
        }
    });
