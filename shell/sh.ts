#!/usr/bin/env bun
import { $ } from "bun";

try{
    for await (const line of $`command -v git`.lines()) {
        console.log(line);
    }
}catch(err :any){
    console.log(`Failed with code ${err.exitCode}`);
    console.log(err.stdout.toString());
    console.log(err.stderr.toString());
}

console.log("haha")

