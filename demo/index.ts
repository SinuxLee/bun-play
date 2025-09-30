import { SQL } from "bun";

// Connect to a MySQL or MariaDB database
const sql = new SQL({
    adapter: "mysql",
    hostname: "127.0.0.1",
    username: "root",
    password: "Admin123",
    database: "test",
});


const server = Bun.serve({
    port: 6000,
    routes: {
        // Static route - content is buffered in memory at startup
        // "/logo.png": new Response(await Bun.file("./logo.png").bytes()),

        // File route - content is read from filesystem on each request
        "/download.zip": new Response(Bun.file("./download.zip")),

        "/game-play": {
            async POST(req) {
                const { name, email } = await req.json() as any;
                const user = { name, email }
                return Response.json(user);
            }
        },

        "/api/users": {
            async GET(req) {
                try {
                    let users = await sql`SELECT * FROM user;`;
                    console.log(users);
                    return Response.json(users);
                } catch (error) {
                    console.error("Error executing query:", error);
                }
            },

            async POST(req) {
                const { name, email } = await req.json() as any;
                const [user] = await sql`INSERT INTO users (name, email) VALUES (${name}, ${email})`;
                return Response.json(user);
            },
        },
    },

    // fallback for unmatched routes
    fetch(req, server) {
        const cookies = new Bun.CookieMap(req.headers.get("cookie")!);

        server.upgrade(req, {
            data: {
                createdAt: Date.now(),
                channelId: new URL(req.url).searchParams.get("channelId"),
                authToken: cookies.get("X-Token"),
            },
        });
        return new Response("Upgrade failed", { status: 500 });
    },

    websocket: {
        perMessageDeflate: true,
        message(ws, message) {
            console.log(ws.data)
        }, // a message is received
        open(ws) { }, // a socket is opened
        close(ws, code, message) { }, // a socket is closed
        drain(ws) { }, // the socket is ready to receive more data
    },
});

console.log(`Listening on ${server.url}`);
