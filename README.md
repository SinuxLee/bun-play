# bun-play

- https://bun.zhcndoc.com/
- https://www.npmleaderboard.org/
- https://www.packfolio.dev/?q=hono
- https://npm.anvaka.com/
- https://npmtrends.com/
- https://www.npmcharts.com/compare/lodash,debug,typescript
- https://www.pkgpulse.com/
- https://stateofjs.com/zh-Hans


### builtin
- S3
- redis
- env
- SQL
    - MySQL
    - PostgreSQL
    - SQLite
- Archive
    - tar/tar.gz
    - Gzip
- Shell
- WebView
- Cron
- Network
    - HTTP server
    - Fetch
    - WebSockets
    - TCP
    - UDP
- Test
    - UnitTest
    - Mocks
    - Code coverage
    - Test Reporters


#### api
- Bun.deepEquals(a, b)
- await Bun.sleep(1000)
- await Bun.password.hash
- Bun.randomUUIDv7()
- toBase64/fromBase64
- Bun.gc() 主动垃圾回收
- Bun.mmap()
- 


## pacakge(zero-deps)
- Zod
- Hono
- Drizzle ORM
- es-toolkit
- picocolors
- superjson
- jose
- pino/LogTape
- Deno @std/*
- semver
- minimatch/picomatch
- ms
- lru-cache
- iconv-lite
- type-fest
- argparse/yargs-parser/commander
- js-yaml/yaml
- uuid/nanoid
- camelcase
- fs-extra/readdirp
- timer-wheel

## release

bun build ./cli.ts --compile --minify --outfile mycli
