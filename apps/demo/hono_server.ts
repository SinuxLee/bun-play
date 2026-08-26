import type { ServerWebSocket } from 'bun';
import { Hono, Context } from "hono";
import { logger } from 'hono/logger'
import { websocket, upgradeWebSocket } from 'hono/bun'
import { type WSEvents, WSContext } from 'hono/ws'
import { decode, sign, verify } from 'hono/jwt'

const book = new Hono().basePath('/book')
book.get('/', (c) => c.text('List Books'))

book.get('/:id', (c) => {
    const id = c.req.param('id')
    return c.text('Get Book: ' + id)
})

book.post('/', (c) => c.text('Create Book'))


const auth = new Hono().basePath('auth')
auth.get('/login', async (c) => {
    const alg = 'HS256'
    const payload = {
        sub: 'user123',
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + 60 * 5,
    }

    const secret = 'mySecretKey'
    const token = await sign(payload, secret, alg)
    // const decodedPayload = await verify(token, secret, alg)
    // console.log(decodedPayload)
    // console.log(decode(token))

    return c.text(token)
});

export const customLogger = (message: string, ...rest: string[]) => {
    console.log(message, ...rest)
}

async function isValidToken(token: string) {
    try {
        const payload = await verify(token, 'your-secret', 'HS256')
        return payload
    } catch {
        return false
    }
}

const app = new Hono()
// app.use(logger(customLogger))
app.route('/', book)
app.route('/', auth)

interface UserData {
    playerId: number;
}

class Handler implements WSEvents<ServerWebSocket<UserData>> {
    private valid: boolean = false;
    constructor(private token: string) {
        this.valid = this.token != ""
    }

    onOpen(event: Event, ws: WSContext<ServerWebSocket<UserData>>) {
        if (!this.valid) {
            ws.close(1008, 'Unauthorized')
            return
        }

        const rawWs = ws.raw!
        rawWs.subscribe('topic');
        rawWs.data.playerId = 1000;

        event.isTrusted
    }

    onMessage(event: MessageEvent, ws: WSContext<ServerWebSocket<UserData>>) {
        console.log(`Message from client: ${event.data}`)
        ws.send('Hello from server!')
    }

    onClose(event: CloseEvent, ws: WSContext<ServerWebSocket<UserData>>) {
        console.log('Connection closed')
    }

    onError(event: Event, ws: WSContext<ServerWebSocket<UserData>>) {

    }
}

app.get('/ws', async (c, next) => {
    const token = c.req.query('token')
    if (!token || !(await isValidToken(token))) {
        return c.text('Unauthorized', 401)
    }
    await next()
}, upgradeWebSocket((c) => {
    const token = c.req.query('token')!
    return new Handler(token)
}))

Bun.serve({
    fetch: app.fetch,
    port: 3000,
    websocket,
})

console.log('Server running at http://localhost:3000')

