const id = Math.random().toString(36).slice(2);
Bun.serve({
  port: 6000,
  reusePort: true,
  fetch(req: Request) {
    return new Response("Hello from Bun #" + id + "!\n");
  },
});

