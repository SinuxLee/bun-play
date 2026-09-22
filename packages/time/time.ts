/** Options needed to synchronize the game clock in Cocos Creator or H5. */
export interface TimeSyncOptions {
    /** Return the response headers. `fetch(url).then(response => response.headers)` works in H5. */
    request(): Promise<{ get(name: string): string | null }>;
    /** Delay after one attempt completes before the next attempt. Default: 5000ms. */
    intervalMs?: number;
    /** Sequential samples used for initial calibration. Default: 3. */
    bootstrapSamples?: number;
    /** Called after an accepted sample; useful for diagnostics only. */
    onSync?(info: { offset: number; rtt: number }): void;
    onError?(error: Error): void;
}

export interface TimeSyncController {
    /** Resolves whether the shared clock is calibrated when this controller finishes startup. */
    readonly ready: Promise<boolean>;
    stop(): void;
}

interface Sample {
    offset: number;
    rtt: number;
}

const DEFAULT_INTERVAL = 5_000;
const DEFAULT_BOOTSTRAP_SAMPLES = 3;
const MAX_RTT = 1_000;
const MAX_RUNTIME_OFFSET_CHANGE = 2_000;
const MAX_SLEW_RATE = 0.05; // 50ms correction per second.

const monotonicNow = (): number => {
    const now = globalThis.performance?.now;
    return typeof now === "function" ? now.call(globalThis.performance) : Date.now();
};

/**
 * Shared virtual game clock.
 *
 * The system wall clock is read once at construction. Afterwards this class
 * advances only with a monotonic clock, so changing device time cannot rewind
 * or fast-forward game business time.
 */
export default class TimeService {
    private static instance: TimeService | undefined;

    private localTime: number;
    private lastMonotonicTime: number;
    private visibleOffset = 0;
    private targetOffset = 0;
    private synchronized = false;
    private readonly bootstrap: Sample[] = [];
    private stopCurrentSync?: () => void;

    private constructor(
        private readonly now: () => number = monotonicNow,
        initialTime = Date.now(),
    ) {
        if (!Number.isFinite(initialTime)) {
            throw new Error("Initial time must be finite.");
        }
        this.lastMonotonicTime = now();
        if (!Number.isFinite(this.lastMonotonicTime)) {
            throw new Error("Monotonic clock must return a finite number.");
        }
        this.localTime = initialTime;
    }

    public static getInstance(
        now: () => number = monotonicNow,
        initialTime = Date.now(),
    ): TimeService {
        return this.instance ??= new TimeService(now, initialTime);
    }

    /** The only clock game business should read. It never moves backward. */
    public getCurrentTime(): number {
        return this.tick();
    }

    public isReady(): boolean {
        return this.synchronized;
    }

    /**
     * Starts one background loop and stops a previous one automatically.
     * Custom Cocos HTTP code only needs to adapt its response headers to the
     * `get(name)` shape accepted by TimeSyncOptions.request().
     */
    public startBackgroundSync(options: TimeSyncOptions): TimeSyncController {
        const interval = options.intervalMs ?? DEFAULT_INTERVAL;
        const sampleCount = options.bootstrapSamples ?? DEFAULT_BOOTSTRAP_SAMPLES;
        if (!Number.isFinite(interval) || interval <= 0 || !Number.isInteger(sampleCount) || sampleCount <= 0) {
            throw new Error("Invalid background synchronization options.");
        }

        this.stopCurrentSync?.();
        let stopped = false;
        let timer: ReturnType<typeof setTimeout> | undefined;

        const syncOnce = async (bootstrapSamples = 1): Promise<"accepted" | "collecting" | "rejected"> => {
            const t1 = this.tickLocalTime();
            try {
                const headers = await options.request();
                if (stopped) {
                    return "rejected";
                }
                const t4 = this.tickLocalTime();
                const sample = this.readSample(t1, t4, headers);
                if (!sample) {
                    this.fail(options, "Invalid or slow time synchronization sample.");
                    return "rejected";
                }
                return this.accept(sample, bootstrapSamples, options);
            } catch (cause) {
                this.fail(options, "Time synchronization request failed.", cause);
                return "rejected";
            }
        };

        const bootstrap = async (): Promise<boolean> => {
            const maxAttempts = sampleCount * 3;
            for (let index = 0; !this.synchronized && index < maxAttempts; index++) {
                if (await syncOnce(sampleCount) === "rejected") {
                    this.bootstrap.length = 0;
                }
            }
            return this.synchronized;
        };

        const schedule = (): void => {
            if (!stopped) {
                timer = setTimeout(async () => {
                    if (this.synchronized) {
                        await syncOnce();
                    } else {
                        await bootstrap();
                    }
                    schedule();
                }, interval);
            }
        };

        const ready = (async (): Promise<boolean> => {
            const wasSynchronized = this.synchronized;
            const success = wasSynchronized ? (await syncOnce()) === "accepted" : await bootstrap();
            schedule();
            return wasSynchronized ? this.synchronized : success;
        })();

        const stop = (): void => {
            stopped = true;
            if (timer !== undefined) {
                clearTimeout(timer);
            }
            if (this.stopCurrentSync === stop) {
                this.stopCurrentSync = undefined;
            }
        };
        this.stopCurrentSync = stop;
        return { ready, stop };
    }

    private accept(sample: Sample, requiredSamples: number, options: TimeSyncOptions): "accepted" | "collecting" | "rejected" {
        if (!this.synchronized) {
            this.bootstrap.push(sample);
            if (this.bootstrap.length < requiredSamples) {
                return "collecting";
            }
            const best = this.bootstrap.reduce((current, item) => item.rtt < current.rtt ? item : current);
            this.bootstrap.length = 0;
            this.visibleOffset = best.offset;
            this.targetOffset = best.offset;
            this.synchronized = true;
            options.onSync?.({ offset: best.offset, rtt: best.rtt });
            return "accepted";
        }

        if (Math.abs(sample.offset - this.targetOffset) > MAX_RUNTIME_OFFSET_CHANGE) {
            this.fail(options, "Time synchronization offset changed too much; sample ignored.");
            return "rejected";
        }
        this.targetOffset = sample.offset;
        options.onSync?.({ offset: sample.offset, rtt: sample.rtt });
        return "accepted";
    }

    private readSample(t1: number, t4: number, headers: { get(name: string): string | null }): Sample | undefined {
        const t2 = this.readHeader(headers, "X-Request-Timestamp");
        const t3 = this.readHeader(headers, "X-Response-Timestamp");
        if (!Number.isFinite(t2) || !Number.isFinite(t3) || t3 < t2) {
            return undefined;
        }

        const rtt = t4 - t1 - (t3 - t2);
        if (rtt < 0 || rtt > MAX_RTT) {
            return undefined;
        }
        return { offset: ((t2 - t1) + (t3 - t4)) / 2, rtt };
    }

    private tick(): number {
        this.tickLocalTime();
        return this.localTime + this.visibleOffset;
    }

    private tickLocalTime(): number {
        const current = this.now();
        if (!Number.isFinite(current)) {
            throw new Error("Monotonic clock must return a finite number.");
        }
        const elapsed = Math.max(0, current - this.lastMonotonicTime);
        this.lastMonotonicTime += elapsed;
        this.localTime += elapsed;

        const maxAdjustment = elapsed * MAX_SLEW_RATE;
        const difference = this.targetOffset - this.visibleOffset;
        this.visibleOffset += Math.max(-maxAdjustment, Math.min(difference, maxAdjustment));
        return this.localTime;
    }

    private readHeader(headers: { get(name: string): string | null }, name: string): number {
        const value = headers.get(name);
        return value === null || value.trim() === "" ? Number.NaN : Number(value);
    }

    private fail(options: TimeSyncOptions, message: string, cause?: unknown): void {
        const error = new Error(message);
        if (cause !== undefined) {
            error.cause = cause;
        }
        options.onError?.(error);
    }
}
