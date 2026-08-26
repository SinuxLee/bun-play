/**
 * server/main.ts — Bun WebSocket 游戏服务器入口
 *
 * 用法: bun run server/main.ts [--port 3000]
 */

import { WsHandler } from "./handler.ts";
import type { WsData } from "../room/types.ts";

const PORT = parseInt(
    process.env["PORT"] ??
    process.argv.find((_, i, a) => a[i - 1] === "--port") ??
    "3000",
    10,
);

const handler = new WsHandler();

const server = Bun.serve<WsData, any>({
    port: PORT,

    fetch(req, server) {
        const url = new URL(req.url);

        // WebSocket 升级
        if (url.pathname === "/ws") {
            const upgraded = server.upgrade(req, {
                data: {
                    playerId: crypto.randomUUID(),
                    roomId: null,
                } satisfies WsData,
            });
            if (upgraded) return undefined;
            return new Response("WebSocket upgrade failed", { status: 400 });
        }

        // 简单状态页
        if (url.pathname === "/status") {
            return Response.json(handler.stats);
        }

        return new Response(
            "中国象棋对战服务器\n\n" +
            "WebSocket: ws://localhost:" + PORT + "/ws\n" +
            "状态查询: http://localhost:" + PORT + "/status\n",
            { headers: { "content-type": "text/plain; charset=utf-8" } },
        );
    },

    websocket: {
        open(ws)          { handler.onOpen(ws); },
        message(ws, msg)  { handler.onMessage(ws, msg); },
        close(ws)         { handler.onClose(ws); },
    },
});

console.log(`象棋对战服务器已启动: ws://localhost:${server.port}/ws`);
