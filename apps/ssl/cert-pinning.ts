// cert-pinning.ts
// Bun runtime 下的 TLS 证书锁定（Certificate Pinning）—— SPKI 公钥锁定版
// SPKI（Subject Public Key Info，即公钥）pin：只要续期时复用同一把
// 私钥，pin 就不会变，续期对客户端完全透明。下面这套实现已经用本地 TLS
// 握手对 RSA 和 EC(P-256) 两种密钥类型实测验证过。

import { X509Certificate, createHash } from "node:crypto";
import { checkServerIdentity as defaultCheckServerIdentity, connect } from "node:tls";
import { readFileSync } from "node:fs";
import type { PeerCertificate, TLSSocket } from "node:tls";

// ---------- 1. 生成 pin ----------
// 只需要 cert.pem。key.pem 是私钥，只在你自己起 TLS 服务端
// （Bun.serve 的 tls: { cert, key }）时才用得上，不参与这里的客户端校验。
//
// 重要：不要直接哈希握手拿到的 PeerCertificate.pubkey 字段——对 RSA
// 证书它恰好等于 SPKI DER，但对 EC 证书它只是裸的曲线点，缺了算法标识
// 前缀，跟本地算出来的 SPKI 对不上，pin 会悄悄失效。正确做法是把完整
// 证书（DER）重新丢进 X509Certificate 解析，再统一导出 SPKI 来算哈希。

function spkiPinFromPem(pem: string | Buffer): string {
  // 等价于：
  // openssl x509 -in diandian.info.pem -pubkey -noout | \
  // openssl pkey -pubin -outform der | \
  // openssl dgst -sha256 -binary   | openssl base64
  const der = new X509Certificate(pem).publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64");
}

function spkiPinFromPeerCert(cert: PeerCertificate): string {
  const der = new X509Certificate(cert.raw).publicKey.export({ type: "spki", format: "der" });
  return createHash("sha256").update(der).digest("base64");
}

// 支持同时放多个 pin：当前证书 + 预留的下一把密钥。
// 这样即使将来要整体轮换密钥（不只是续期），也能提前把新 pin 打包进
// 客户端版本，留出灰度窗口，不会出现"新旧证书都对不上"的空档期。
const PINNED_SPKI_HASHES = [
  spkiPinFromPem(readFileSync("./diandian.info.pem")), // 当前在用的证书
  // spkiPinFromPem(readFileSync("./server-cert-next.pem")), // 预留下一把，轮换密钥前先加进来
];

console.log(PINNED_SPKI_HASHES);

// ---------- 2. 通用校验函数：fetch / WebSocket / tls.connect 都能复用 ----------

function pinnedCheckServerIdentity(hostname: string, cert: PeerCertificate) {
  // 先跑一遍标准主机名校验，做了 pinning 也不要跳过它
  const err = defaultCheckServerIdentity(hostname, cert);
  if (err) return err;

  const actualPin = spkiPinFromPeerCert(cert);
  if (!PINNED_SPKI_HASHES.includes(actualPin)) {
    return new Error(
      `[证书锁定失败] host=${hostname} 收到的公钥指纹 ${actualPin} ` +
        `不在允许列表内，可能正在遭受中间人攻击。`
    );
  }
  return undefined; // 通过校验
}

// ---------- 3a. 用在 Bun 的 fetch 上 ----------
async function testFetch() {
  const res = await fetch("https://ffa-windev.diandian.info:8443/api/ping", {
    tls: {
      checkServerIdentity: pinnedCheckServerIdentity,
      // 如果目标证书是自签的（不是公共 CA 签发），还需要显式信任它：
      // ca: [readFileSync("./server-cert.pem", "utf8")],
    },
  });
  console.log(await res.text());
}

// ---------- 3b. 用在 wss:// 长连接上（贴近网关场景）----------
function testWebSocket() {
  const ws = new WebSocket("wss://ffa-windev.diandian.info:8443/ws", {
    tls: { checkServerIdentity: pinnedCheckServerIdentity },
  });
  ws.addEventListener("open", () => console.log("WSS 已连接，证书校验通过"));
  ws.addEventListener("error", (e) => console.error("连接失败 / 证书不匹配:", e));
}

// ---------- 3c. 底层 node:tls.connect，需要更细粒度控制时使用 ----------
function testTlsConnect() {
  connect(
    {
      host: "ffa-windev.diandian.info",
      port: 8443,
      checkServerIdentity: pinnedCheckServerIdentity,
    },
    function (this: TLSSocket) {
      console.log("tls.connect 证书校验通过");
      this.end();
    }
  ).on("error", (err) => console.error(err.message));
}

// 按需调用其中一个来跑一下
await testFetch();
testWebSocket();
testTlsConnect();
