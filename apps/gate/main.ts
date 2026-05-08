import { Hono } from 'hono'
import { type ServerWebSocket } from 'bun'

type WSData = {
    uid: string;
    roomId: string;
};

const app = new Hono()
const clients = new Map<string, ServerWebSocket<WSData>>()
app.get('/', (c) => {
    return c.text('Gate is running')
})

app.post('/login', async (c) => {
    const body = await c.req.json()
    const { uid } = body

    if (!uid) {
        return c.json({ error: 'invalid uid' }, 400)
    }

    // 实际应签发 JWT
    const token = `mock-token-${uid}`

    return c.json({ token })
})

const server = Bun.serve<WSData, any>({
    port: 3000,
    routes: {
        "/ws": async (req, server) => {
            const url = new URL(req.url)
            // WebSocket 升级
            const token = url.searchParams.get('token')

            if (!token) {
                return new Response('unauthorized', { status: 401 })
            }

            const uid = token.replace('mock-token-', '')
            const success = server.upgrade<WSData>(req, { data: { uid, roomId: '' } })
            if (success) return

            return new Response('upgrade failed', { status: 400 })
        }
    },

    fetch(req, server) {
        return app.fetch(req, server)
    },

    websocket: {
        open(ws) {
            const { uid } = ws.data
            clients.set(uid, ws)
            console.log('connected:', uid)
        },

        message(ws, message) {
            const { uid } = ws.data

            console.log('recv:', uid, message)

            // 简单 echo
            ws.send(`echo: ${message}`)

            // 示例：广播
            // for (const client of clients.values()) {
            //   client.send(message)
            // }
        },

        close(ws) {
            const { uid } = ws.data
            clients.delete(uid)
            console.log('closed:', uid)
        },
    },
})

console.log(`🚀 Gate running at http://localhost:${server.port}`)
