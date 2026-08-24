# jose (panva/jose) 功能与应用场景速查

`jose` 是 [panva](https://github.com/panva/jose) 维护的 JOSE（JSON Object Signing and Encryption）标准实现库，覆盖 JWT / JWS / JWE / JWK 全家桶，可运行在 Node.js、浏览器、Deno、Bun、Cloudflare Workers 等环境，零依赖、ESM tree-shakeable。

安装：`npm install jose`

---

## 1. JWT 签发与验证 — `SignJWT` / `jwtVerify`

**应用场景**：最常见的鉴权场景 —— 用户登录后签发 access token / refresh token，客户端后续请求携带 token 完成鉴权。例如网关校验小程序/H5 客户端登录态。

```ts
import * as jose from 'jose'

const secret = new TextEncoder().encode('your-256-bit-secret')

// 签发
const token = await new jose.SignJWT({ uid: 10086, role: 'player' })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setIssuer('urn:game-gateway')
  .setAudience('urn:game-client')
  .setExpirationTime('2h')
  .sign(secret)

// 验证（务必显式指定 algorithms，见文末安全提示）
const { payload } = await jose.jwtVerify(token, secret, {
  issuer: 'urn:game-gateway',
  audience: 'urn:game-client',
  algorithms: ['HS256'],
})
console.log(payload.uid)
```

---

## 2. 加密 JWT — `EncryptJWT` / `jwtDecrypt`

**应用场景**：token 里要带敏感字段（实名信息、支付信息、内部会话状态）时，光签名不够——JWS 的 payload 只是 base64，明文可读。这时把整个 claims 加密成 JWE，常用于跨服务传递 PII，或者服务间传递不希望网关本身能读懂的内部状态。

```ts
import * as jose from 'jose'

const secret = await jose.generateSecret('A256GCM') // 对称密钥，需持久化保存

const jwe = await new jose.EncryptJWT({ uid: 10086, phone: '138****0000' })
  .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
  .setIssuedAt()
  .setExpirationTime('10m')
  .encrypt(secret)

const { payload } = await jose.jwtDecrypt(jwe, secret)
```

---

## 3. JWS 任意 payload 签名 — `CompactSign` / `compactVerify`

**应用场景**：不局限于 JWT 的声明结构，对任意二进制/文本消息做完整性校验和防篡改。比如网关和后端之间传递的 protobuf 消息体加签、下发给客户端的配置/资源清单做防篡改校验。

```ts
import * as jose from 'jose'

const privateKey = await jose.importPKCS8(pem, 'ES256')
const jws = await new jose.CompactSign(protobufBytes)
  .setProtectedHeader({ alg: 'ES256' })
  .sign(privateKey)

const publicKey = await jose.importSPKI(pubPem, 'ES256')
const { payload } = await jose.compactVerify(jws, publicKey) // payload 抛出即代表被篡改
```

---

## 4. JWE 任意内容加密 — `CompactEncrypt` / `compactDecrypt`

**应用场景**：加密的不是 JWT 结构，而是任意数据。例如网关下发给客户端的临时房间密钥、服务间传递的敏感配置片段。

```ts
import * as jose from 'jose'

const publicKey = await jose.importSPKI(pubPem, 'RSA-OAEP-256')
const jwe = await new jose.CompactEncrypt(new TextEncoder().encode('room-secret-key'))
  .setProtectedHeader({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
  .encrypt(publicKey)

const privateKey = await jose.importPKCS8(privPem, 'RSA-OAEP-256')
const { plaintext } = await jose.compactDecrypt(jwe, privateKey)
```

> 注意：JWE 只保证机密性，不保证来源真实性——需要防伪造时要配合 JWS 签名或使用嵌套 JWT。

---

## 5. 密钥管理 — JWK / JWKS

**应用场景**：
- 生成/导入/导出密钥对，供不同服务共享；
- 多服务共用一套公钥验签（JWKS），典型用法是网关本身不持有私钥，只从鉴权服务的 JWKS 端点拉取公钥来验证 token，实现"签发方"和"验证方"解耦，也便于密钥轮换。

```ts
import * as jose from 'jose'

// 生成密钥对（鉴权服务侧）
const { publicKey, privateKey } = await jose.generateKeyPair('ES256')

// 导出为 JWK，发布到 /.well-known/jwks.json
const jwk = await jose.exportJWK(publicKey)

// 网关侧：从远程 JWKS 拉取公钥并验证，内置缓存与轮换
const JWKS = jose.createRemoteJWKSet(
  new URL('https://auth.example.com/.well-known/jwks.json'),
)
const { payload } = await jose.jwtVerify(token, JWKS, {
  issuer: 'urn:auth-service',
  algorithms: ['ES256'],
})
```

---

## 6. 其它工具函数

| 功能 | 应用场景 |
|---|---|
| `calculateJwkThumbprint` | 计算密钥指纹，作为 `kid` 标识，配合多密钥轮换 |
| `decodeJwt` / `decodeProtectedHeader` | **不验证签名**，仅读取声明/头部，用于日志调试；绝不能当作鉴权依据 |
| `UnsecuredJWT` | 生成不带签名的 JWT，仅用于本地开发/测试 mock，不可用于生产鉴权 |

---

## 安全实践提醒（对网关类鉴权场景尤其重要）

- `jwtVerify` / `compactVerify` 务必显式传 `algorithms` 白名单，防止 alg 混淆攻击（例如把 `alg: none` 或用公钥当 HMAC secret 的伪造 token 蒙混过关）。
- 优先用 `createRemoteJWKSet` 而非硬编码公钥，方便密钥轮换、避免单点密钥泄露影响面过大。
- 签发时设置合理的 `exp`，敏感场景（如包含房间/支付信息）优先用 JWE 而非仅签名。



四者的关系是：**JWK 提供密钥 → 密钥被 JWS 或 JWE 使用 → JWT 是用 JWS 或 JWE 序列化出来的、专门用来装 claims 的令牌格式**。具体每个解决的问题：

**JWS（JSON Web Signature）**
解决的问题：如何证明一段任意数据**没被篡改、且来自可信方**（完整性 + 来源认证）。payload 本身是明文（base64url 编码，不是加密），任何人都能读到内容，但改一个字节签名就验证不过。适合"我不在乎你看不看得到内容,但你不能改"的场景——比如你们组里的 protobuf 网关消息防篡改。

**JWE（JSON Web Encryption）**
解决的问题：如何让一段数据**只有指定接收方能读到**（机密性）。它本身不天然保证来源真实——如果用对称密钥且泄露，攻击者一样能造出合法密文。需要"既要保密又要防伪造"时通常是签名+加密叠加用（比如先 JWS 签名，再把结果整体 JWE 加密，即 nested JWT）。

**JWK（JSON Web Key）/ JWKS（JWK Set）**
解决的问题：**密钥本身如何用一种与语言/平台无关的标准 JSON 格式来表示、交换、发布**。没有它，JWS/JWE 用到的公钥私钥在不同系统间传递就得各自定义格式。JWKS 进一步解决"如何发布一组密钥供他人按 `kid` 查找"，让签发方和验证方解耦——验证方不需要硬编码公钥，改成定期拉取 JWKS 端点即可支持密钥轮换。

**JWT（JSON Web Token）**
解决的问题：**如何用一种紧凑、URL 安全、自包含的格式在各方之间传递一组身份/会话声明（claims）**，且不需要服务端保存 session 状态。JWT 不是独立的密码学原语，它是"claims 这种特定 payload + JWS 或 JWE 序列化"的组合规范——签名版就是 `header.payload.signature` 三段式，加密版是 JWE 的五段式。这也是为什么你上次问的 `SignJWT`/`jwtVerify` 走的是 JWS 路径，`EncryptJWT`/`jwtDecrypt` 走的是 JWE 路径。

对应到你的网关场景：客户端登录态用 JWT(JWS) 足够；如果 token 里要塞实名/支付这类敏感字段，才需要上 JWT(JWE)；而 JWK/JWKS 是让网关和鉴权服务解耦、支持密钥轮换的基础设施。


- SignJWT + jwtVerify → 使用 EdDSA 做数字签名（防篡改、身份认证）
- EncryptJWT + jwtDecrypt → 使用 ECDH-ES 或 RSA 等做内容加密（防窃听）
组合方法：签名 + 加密
