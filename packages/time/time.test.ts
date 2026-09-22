import { expect, test } from "bun:test";

import TimeService from "./time";

let localNow = 1_000;
const time = TimeService.getInstance(() => localNow, 1_000);

const headers = (t2: number, t3: number) => ({
    get(name: string): string | null {
        if (name === "X-Request-Timestamp") return String(t2);
        if (name === "X-Response-Timestamp") return String(t3);
        return null;
    },
});

const gateway = (offset: number, up = 30, processing = 10, down = 30) => async () => {
    localNow += up;
    const t2 = localNow + offset;
    localNow += processing;
    const t3 = localNow + offset;
    localNow += down;
    return headers(t2, t3);
};

test("initial bootstrap chooses a server time before the clock becomes ready", async () => {
    localNow = 1_000;
    const accepted: number[] = [];
    let requestCount = 0;
    const sync = time.startBackgroundSync({
        intervalMs: 60_000,
        bootstrapSamples: 3,
        request: async () => {
            requestCount++;
            return requestCount === 1
                ? gateway(100, 600, 0, 600)()
                : gateway(100)();
        },
        onSync: ({ offset }) => accepted.push(offset),
    });

    expect(time.isReady()).toBeFalse();
    expect(await sync.ready).toBeTrue();
    expect(accepted).toEqual([100]);
    expect(time.isReady()).toBeTrue();
    expect(time.getCurrentTime()).toBe(2_510);
    sync.stop();
});

test("a later server correction never makes game time go backward", async () => {
    localNow = 3_000;
    const sync = time.startBackgroundSync({ intervalMs: 60_000, request: gateway(50) });
    expect(await sync.ready).toBeTrue();
    const before = time.getCurrentTime();
    localNow += 100;
    const after = time.getCurrentTime();

    expect(before).toBe(3_170);
    expect(after).toBe(3_265);
    expect(after).toBeGreaterThan(before);
    sync.stop();
});

test("invalid, slow, and anomalous samples are ignored", async () => {
    localNow = 4_000;
    const errors: string[] = [];

    const slow = time.startBackgroundSync({
        intervalMs: 60_000,
        request: gateway(100, 1_000, 0, 1_000),
        onError: (error) => errors.push(error.message),
    });
    expect(await slow.ready).toBeTrue();
    slow.stop();

    const anomalous = time.startBackgroundSync({
        intervalMs: 60_000,
        request: gateway(5_000),
        onError: (error) => errors.push(error.message),
    });
    expect(await anomalous.ready).toBeTrue();
    anomalous.stop();

    localNow += 100;
    expect(time.getCurrentTime()).toBe(localNow + 50);
    expect(errors).toEqual([
        "Invalid or slow time synchronization sample.",
        "Time synchronization offset changed too much; sample ignored.",
    ]);
});

test("starting a new loop prevents an old in-flight request from changing time", async () => {
    localNow = 8_000;
    let releaseOld: (() => void) | undefined;
    let oldSyncs = 0;
    const old = time.startBackgroundSync({
        intervalMs: 60_000,
        request: () => new Promise((resolve) => {
            releaseOld = () => resolve(headers(4_100, 4_100));
        }),
        onSync: () => oldSyncs++,
    });

    const current = time.startBackgroundSync({ intervalMs: 60_000, request: gateway(100) });
    expect(await current.ready).toBeTrue();
    releaseOld?.();
    await old.ready;
    expect(oldSyncs).toBe(0);
    const before = time.getCurrentTime();
    localNow += 10;
    expect(time.getCurrentTime()).toBeGreaterThan(before);
    current.stop();
});
