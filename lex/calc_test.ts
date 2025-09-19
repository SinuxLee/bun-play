import { expect, test } from "bun:test";
import { __test__ as calc } from "./calc";

test("parseToken", () => {
  expect(calc.parseToken("2 + 2")).toEqual(["2", "+", "2"]);
  expect(calc.parseToken("2$+2")).toEqual(["2", "+", "2"]);
});
