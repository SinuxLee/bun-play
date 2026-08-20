// build.ts
import { $ } from "bun";

const version = await $`git describe --tags --always`.text();
const buildTime = new Date().toISOString();
const gitCommit = await $`git rev-parse HEAD`.text();

await Bun.build({
  entrypoints: ["./src/cli.ts"],
  outdir: "./dist",
  define: {
    BUILD_VERSION: JSON.stringify(version.trim()),
    BUILD_TIME: JSON.stringify(buildTime),
    GIT_COMMIT: JSON.stringify(gitCommit.trim()),
  },
});

console.log(`Built with version ${version.trim()}`);
