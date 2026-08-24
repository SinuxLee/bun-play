import fs from 'node:fs/promises'
import * as jose from 'jose'

async function jwtDemo() {
    const secret = new TextEncoder().encode('your-256-bit-secret')

    // 签发
    const token = await new jose.SignJWT({ uid: 10086, role: 'player' })
        .setProtectedHeader({ alg: 'HS256' }) // HMAC-SHA256
        .setIssuedAt()
        .setIssuer('urn:game-gateway')
        .setAudience('urn:game-client')
        .setExpirationTime('2h')
        .sign(secret)

    // 验证
    const { payload } = await jose.jwtVerify(token, secret, {
        issuer: 'urn:game-gateway',
        audience: 'urn:game-client',
        algorithms: ['HS256'],
    })

    console.log(payload.uid, token)
}

async function generateAndSave(name: string, alg: string, options = {}) {
    // exportPKCS8 需要 privateKey 可导出
    const { privateKey, publicKey } = await jose.generateKeyPair(alg, {
        ...options,
        extractable: true,
    })

    const [privatePem, publicPem] = await Promise.all([
        jose.exportPKCS8(privateKey),
        jose.exportSPKI(publicKey),
    ])

    await Promise.all([
        fs.writeFile(`./keys/${name}-private.pem`, privatePem, {
            encoding: 'utf8',
            mode: 0o600,
        }),
        fs.writeFile(`./keys/${name}-public.pem`, publicPem, {
            encoding: 'utf8',
            mode: 0o644,
        }),
    ])
}

async function generateKeys() {
    const exists = await fs.exists('./keys')
    if (exists) return;

    await fs.mkdir('./keys', { recursive: true })
    // Ed25519：用于 EdDSA 签名
    await generateAndSave('eddsa-sign', 'EdDSA', { crv: 'Ed25519' })

    // RSA：用于 EncryptJWT
    await generateAndSave('rsa-encrypt', 'RSA-OAEP-256', { modulusLength: 2048 })

    console.log('密钥已生成到 ./keys/')
}

/** 
 * 非对称密钥签名，依然是明文 base64 编码的 JWT，签名部分是不可伪造的
*/
async function signAndVerify() {
    // 从文件读取 PEM
    const privatePem = await fs.readFile('./keys/eddsa-sign-private.pem', 'utf-8');
    const publicPem = await fs.readFile('./keys/eddsa-sign-public.pem', 'utf-8');

    // 导入密钥
    const privateKey = await jose.importPKCS8(privatePem, 'EdDSA');
    const publicKey = await jose.importSPKI(publicPem, 'EdDSA');

    // 签名 JWT (JWS)
    const jwt = await new jose.SignJWT({
        sub: 'user123',
        iss: 'https://myapp.com',
        aud: 'https://api.myapp.com',
        role: 'admin',
    })
        .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(privateKey);

    console.log('📄 JWT:', jwt);

    // 验证 JWT
    const { payload, protectedHeader } = await jose.jwtVerify(jwt, publicKey, {
        issuer: 'https://myapp.com',
        audience: 'https://api.myapp.com',
    });

    console.log('✅ 验证通过');
    console.log('Header:', protectedHeader);
    console.log('Payload:', payload);
}

/**
 * 非对称密钥加密，生成 JWE, payload 是加密的，解密后才能看到原始内容
 * 可以用于完成支付、传输敏感信息等场景，比如 payload 中包含用户的银行卡号、身份证号、密钥等敏感信息
 * 不适合高频场景，有一定的性能开销
 */
async function encryptAndDecrypt() {
    const readText = (file: string) => fs.readFile(file, 'utf8')

    // 加载 RSA 公钥：加密使用
    const encryptionPublicKey = await jose.importSPKI(
        await readText('./keys/rsa-encrypt-public.pem'),
        'RSA-OAEP-256',
    )

    // 加载 RSA 私钥：解密使用
    const decryptionPrivateKey = await jose.importPKCS8(
        await readText('./keys/rsa-encrypt-private.pem'),
        'RSA-OAEP-256',
    )

    const token = await new jose.EncryptJWT({
        sub: 'user-1001',
        role: 'admin',
        scope: 'read:users',
    })
        .setProtectedHeader({
            alg: 'RSA-OAEP-256',
            enc: 'A256GCM',
            typ: 'JWT',
        })
        .setIssuer('my-service')
        .setAudience('my-client')
        .setIssuedAt()
        .setExpirationTime('15m')
        .encrypt(encryptionPublicKey)

    console.log('加密 JWT:')
    console.log(token)

    // 解密并校验 JWT Claims
    const result = await jose.jwtDecrypt(token, decryptionPrivateKey, {
        issuer: 'my-service',
        audience: 'my-client',
        keyManagementAlgorithms: ['RSA-OAEP-256'],
        contentEncryptionAlgorithms: ['A256GCM'],
    })

    console.log('解密结果:')
    console.log(result.payload)
    console.log(result.protectedHeader)
}

async function nestedJWT() {
    const encoder = new TextEncoder();

    // EdDSA 签名密钥（从文件加载）
    const signPrivate = await jose.importPKCS8(
        await fs.readFile('./keys/eddsa-sign-private.pem', 'utf-8'), 'EdDSA'
    );
    const signPublic = await jose.importSPKI(
        await fs.readFile('./keys/eddsa-sign-public.pem', 'utf-8'), 'EdDSA'
    );

    // RSA 加密密钥（从文件加载）
    const encPrivate = await jose.importPKCS8(
        await fs.readFile('./keys/rsa-encrypt-private.pem', 'utf-8'), 'RSA-OAEP-256'
    );
    const encPublic = await jose.importSPKI(
        await fs.readFile('./keys/rsa-encrypt-public.pem', 'utf-8'), 'RSA-OAEP-256'
    );

    // Step 1: 签名（JWS）
    let signedJWT = await new jose.SignJWT({ sub: 'user123', role: 'admin' })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setIssuedAt()
        .setExpirationTime('2h')
        .sign(signPrivate);

    // Step 2: 加密（JWE，把签名后的 JWT 作为载荷）
    const nestedJWE = await new jose.CompactEncrypt(encoder.encode(signedJWT))
        .setProtectedHeader({
            alg: 'RSA-OAEP-256',
            enc: 'A256GCM',
            cty: 'JWT',
        })
        .encrypt(encPublic);

    console.log('嵌套 JWE:', nestedJWE);

    // 接收方解密
    const { plaintext } = await jose.compactDecrypt(nestedJWE, encPrivate);
    signedJWT = new TextDecoder().decode(plaintext);
    console.log('解密后的内部 JWT:', signedJWT);

    // 验证内部 JWT 签名
    const { payload: innerPayload } = await jose.jwtVerify(signedJWT, signPublic);
    console.log('最终载荷:', innerPayload);
}

await jwtDemo() // 对称签名, 用于内部系统

await generateKeys()
await signAndVerify() // 非对称签名，外部系统
await encryptAndDecrypt() // 非对称加密，信息敏感的外部系统
await nestedJWT() // 嵌套 JWT：先签名后加密。跨网络传输，网关侧做嵌套加解密处理
