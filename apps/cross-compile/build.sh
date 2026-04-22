#!/usr/bin/env bash

bun build --compile ./hello.js --outfile myapp

# cross-compile
# bun build --compile --target=bun-linux-arm64 ./hello.js --outfile myapp

