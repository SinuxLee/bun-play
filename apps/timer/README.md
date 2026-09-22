# Timer example

The app starts background time synchronization, waits for its first successful
bootstrap, then runs a countdown using only `TimeService.getCurrentTime()`.

```powershell
$env:TIME_URL = "https://your-game.example.com/time"
$env:TIMER_DURATION_MS = "30000" # optional; defaults to 30 seconds
bun run apps/timer/index.ts
```

`TIME_URL` must return these headers in Unix milliseconds:

```text
X-Request-Timestamp
X-Response-Timestamp
```

The printed `game-wall` value is diagnostics only. Game deadlines use virtual
time, so changing the device wall clock after startup does not change them.
