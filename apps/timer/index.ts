import TimeService from "@bun-play/time";

const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const configuredDuration = Number(process.env.TIMER_DURATION_MS ?? "30000");
const duration = Number.isFinite(configuredDuration) && configuredDuration > 0
    ? configuredDuration
    : 100_000;

async function main(): Promise<void> {
    const timeUrl = process.env.TIME_URL ?? "http://ffa-game7.xxx.info/center-inner/v1/account/summary/30";
    if (!timeUrl) {
        throw new Error("Set TIME_URL to an endpoint returning X-Request-Timestamp and X-Response-Timestamp.");
    }

    const time = TimeService.getInstance();
    const sync = time.startBackgroundSync({
        intervalMs: 8_000,
        request: async () => {
            const response = await fetch(timeUrl, { cache: "no-store" });
            return response.headers;
        },
        onSync: ({ offset, rtt }) => {
            console.log(`[sync] offset=${offset.toFixed(3)}ms rtt=${rtt.toFixed(3)}ms`);
        },
        onError: (error) => console.warn(`[sync] ${error.message}`),
    });

    try {
        if (!await sync.ready || !time.isReady()) {
            throw new Error("Initial time synchronization failed.");
        }

        // This deadline is based entirely on virtual game time.
        const deadline = time.getCurrentTime() + duration;
        console.log(`[timer] started: ${Math.round(duration / 1000)} seconds`);

        while (true) {
            const gameNow = time.getCurrentTime();
            const remaining = Math.max(0, deadline - gameNow);
            const wallDifference = gameNow - Date.now(); // Diagnostic only; never game logic.
            console.log(
                `[timer] game=${new Date(gameNow).toISOString()} `
                + `remaining=${(remaining / 1000).toFixed(3)}s `
                + `game-wall=${wallDifference.toFixed(3)}ms`,
            );

            if (remaining === 0) {
                break;
            }
            await sleep(Math.min(1_000, remaining));
        }
        console.log("[timer] finished");
    } finally {
        sync.stop();
    }
}

if (import.meta.main) {
    await main();
}
