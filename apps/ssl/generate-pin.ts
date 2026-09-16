// generate-pin.ts
// 发布前跑一次，把结果贴进 cert-pinning.ts 的 PINNED_SPKI_HASHES。
// 这个脚本本身、以及它读的 server-cert.pem，都不需要随客户端分发——
// 只有算出来的 pin 字符串是要打包进客户端的。
//
// 用法：bun run generate-pin.ts ./server-cert.pem

import { X509Certificate, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const certPath = process.argv[2];
if (!certPath) {
  console.error("用法: bun run generate-pin.ts <cert.pem 路径>");
  process.exit(1);
}

const pem = readFileSync(certPath);
const der = new X509Certificate(pem).publicKey.export({ type: "spki", format: "der" });
const pin = createHash("sha256").update(der).digest("base64");

console.log(pin);
