// Next weekday at 9:30 AM local time
const next = Bun.cron.parse("30 9 * * MON-FRI", Date.now());
console.log(next);

// [Minute, Hour, Day of Month, Month, Day of Week]
// @daily / @midnight
// @hourly
// @weekly
const job = Bun.cron("* * * * *", async () => {
  await Bun.sleep(1000);
  console.log("Hello from cron job!");
  job.stop();
});

class MyUsing implements Disposable{
    [Symbol.dispose](): void {
        throw new Error("Method not implemented.");
    }

}
