// pin-test-server.ts
// 配合 cert-pinning.ts 的本地测试服务器：用你的 server-cert.pem / server-key.pem
// 起一个同时支持 HTTPS fetch 和 wss:// 长连接的 Bun 服务。
//
// 用来验证客户端的证书锁定逻辑：
//   1. 正常启动 → 客户端 pinnedCheckServerIdentity 应该通过
//   2. 换成另一张证书（比如临时生成的自签证书）重启这个服务、不改客户端的
//      PINNED_SPKI_HASHES → 客户端应该被直接拒绝，报 "[证书锁定失败]"
//   3. 用同一把私钥重新签发一张证书（模拟续期）重启 → 客户端应该照常通过，
//      验证"续期对客户端透明"这件事

import { readFileSync } from "node:fs";

type WSData = { connectedAt: number };

const server = Bun.serve<WSData>({
  port: 8443,
  tls: {
    cert: readFileSync("./server-cert.pem"),
    key: readFileSync("./server-key.pem"),
    // 多域名/SNI 场景可以传数组：
    // tls: [
    //   { serverName: "a.example.com", cert: certA, key: keyA },
    //   { serverName: "b.example.com", cert: certB, key: keyB },
    // ],
  },

  fetch(req, server) {
    const url = new URL(req.url);

    // wss:// 升级，对应 client 里的 testWebSocket()
    if (url.pathname === "/ws") { 
      const ok = server.upgrade(req, { data: { connectedAt: Date.now() } });
      return ok ? undefined : new Response("Upgrade failed", { status: 400 });
    }

    // 对应 client 里的 testFetch()
    if (url.pathname === "/api/ping") {
      return new Response("pong");
    }

    return new Response("Not found", { status: 404 });
  },

  websocket: {
    open(ws) {
      console.log("WS 已连接:", new Date(ws.data.connectedAt).toISOString());
      ws.send("welcome");
    },
    message(ws, message) {
      ws.send(`echo: ${message}`); // 简单 echo，方便验证收发正常
    },
    close() {
      console.log("WS 已断开");
    },
  },
});

console.log(`测试服务已启动：https://localhost:${server.port}  wss://localhost:${server.port}/ws`);
