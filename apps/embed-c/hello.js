import { cc } from "bun:ffi";
import source from "./hello.c" with { type: "file" };

const {symbols: { hello }} = cc({ source,symbols: {
    hello: { args: ["int"],returns: "int"},
  },
});

console.log("What is the answer to the universe?", hello(Date.now()));

