import { RedisClient } from "bun";

// 创建自定义客户端
const client = new RedisClient("redis://localhost:6379", {
    connectionTimeout: 1000,
});

try {
    await client.connect();
    // await client.ping();
} catch (error: any) {
    console.error("Error connecting to Redis:", error.code);
    process.exit(1);
}

async function serverInfo() {
    const resp: string = await client.send("info", ["server"]);
    const serverInfo: Record<string, string> = {};

    resp.split("\n").forEach((line) => {
        if (line.startsWith("#")) return;
        const [key, value] = line.split(":") as [string, string];
        if (key && value) {
            serverInfo[key.trim()] = value.trim();
        }
    });

    console.log("Server info:", serverInfo);
}

async function counter() {
    await client.set("counter", "10");
    await client.incr("counter");
    const counter = await client.get("counter");
    console.log("Counter value:", counter);

    await client.del("counter");
    await client.exists("counter")
}

async function hashTable() {
    await client.hmset("myhash", ["name", "libz"]);
    const value = await client.hgetall("myhash");
    console.log("Hash field value:", value);

    const resp: Record<string, string> = await client.send("hgetall", ["myhash"]);
    console.log("send result:", resp);
    
    await client.del("myhash");
}

await hashTable();
