import { expect, test } from "bun:test";
import { __test__ as calc, evaluateExp } from "./calc";

test("parseToken", () => {
  expect(calc.parseToken("2 + 2")).toEqual(["2", "+", "2"]);
  expect(calc.parseToken("2+2")).toEqual(["2", "+", "2"]);
});

test("calc", () => {
  expect(evaluateExp("(2*(3-4))*5")).toEqual("-10")
  expect(evaluateExp("2+3*4")).toEqual("14")
  expect(evaluateExp("(2+3)*4")).toEqual("20")
  expect(evaluateExp("2^3+1")).toEqual("9")
  expect(evaluateExp("10/2+3*4")).toEqual("17")
  expect(evaluateExp("(11 + 112) * 223 - 3334 / 44445")).toEqual("27429")
  expect(evaluateExp("1/0")).toEqual("Error: Division by zero")
})
