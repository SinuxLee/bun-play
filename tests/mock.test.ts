import { test, expect, mock } from "bun:test";

const random = mock(() => Math.random());

test("random", () => {
  const val = random();
  expect(val).toBeGreaterThan(0);
  expect(random).toHaveBeenCalled();
  expect(random).toHaveBeenCalledTimes(1);
});


const random2 = mock((multiplier: number) => multiplier * Math.random());
random2(2);
random2(10);

console.log(random2.mock.calls);
console.log(random2.mock.results);
