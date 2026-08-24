import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import {
  importPKCS8,
  importSPKI,
  SignJWT,
  jwtVerify,
  CompactEncrypt,
  compactDecrypt,
} from 'jose'

const readText = (file: string) => readFile(file, 'utf8')

const signPrivateKey = await importPKCS8(
  await readText('./keys/eddsa-sign-private.pem'),
  'EdDSA',
)

const signPublicKey = await importSPKI(
  await readText('./keys/eddsa-sign-public.pem'),
  'EdDSA',
)

const encryptPublicKey = await importSPKI(
  await readText('./keys/rsa-encrypt-public.pem'),
  'RSA-OAEP-256',
)

const decryptPrivateKey = await importPKCS8(
  await readText('./keys/rsa-encrypt-private.pem'),
  'RSA-OAEP-256',
)

const encoder = new TextEncoder()

const payload = {
  sub: 'user-1001',
  role: 'admin',
}

async function createSignedJwt() {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
    .setIssuer('my-service')
    .setAudience('my-client')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(signPrivateKey)
}

async function createEncryptedJwt(signedJwt) {
  return new CompactEncrypt(encoder.encode(signedJwt))
    .setProtectedHeader({
      alg: 'RSA-OAEP-256',
      enc: 'A256GCM',
      cty: 'JWT',
    })
    .encrypt(encryptPublicKey)
}

async function benchmark(name, action, count = 1000) {
  for (let i = 0; i < 50; i++) {
    await action()
  }

  const start = performance.now()

  for (let i = 0; i < count; i++) {
    await action()
  }

  const elapsed = performance.now() - start

  console.log(
    `${name}: ${elapsed.toFixed(2)} ms, ` +
    `${(count / elapsed * 1000).toFixed(0)} ops/s`,
  )
}

const signedJwt = await createSignedJwt()
const encryptedJwt = await createEncryptedJwt(signedJwt)

await benchmark('EdDSA 签名', () => createSignedJwt())

await benchmark(
  'RSA-OAEP + A256GCM 加密',
  () => createEncryptedJwt(signedJwt),
)

await benchmark(
  'RSA 私钥解密',
  () => compactDecrypt(encryptedJwt, decryptPrivateKey),
)

await benchmark(
  'EdDSA 验签',
  () => jwtVerify(signedJwt, signPublicKey, {
    algorithms: ['EdDSA'],
    issuer: 'my-service',
    audience: 'my-client',
  }),
)