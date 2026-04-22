globalThis.count ??= 0;
globalThis.count++;

Bun.serve({
    fetch(req: Request) {
        return new Response(`Reloaded ${globalThis.count} times`);
    },
    port: 3009,
});

