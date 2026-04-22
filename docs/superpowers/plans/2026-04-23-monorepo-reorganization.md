# Monorepo 重组实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 bun-play 从扁平目录结构重组为标准 Bun workspaces monorepo，按 `packages/`（库）和 `apps/`（应用）分层。

**Architecture:** 根 `package.json` 声明 workspaces，`packages/*` 存放可复用库（`astar`、`lex`），`apps/*` 存放所有可运行模块。各子包继承根 `tsconfig.json`，`bun install` 统一管理依赖和 lock 文件。

**Tech Stack:** Bun workspaces, TypeScript（extends tsconfig）

---

## 文件变更总览

**移动（git mv）：**
- `astar/` → `packages/astar/`
- `lex/` → `packages/lex/`
- `cluster/` → `apps/cluster/`
- `demo/` → `apps/demo/`
- `hot-reload/` → `apps/hot-reload/`
- `shell/` → `apps/shell/`
- `cross-compile/` → `apps/cross-compile/`
- `embed-c/` → `apps/embed-c/`
- `sample/` → `apps/sample/`

**修改：**
- `package.json` ← 添加 workspaces、scripts，删除 module 字段

**新建（每个 workspace）：**
- `packages/astar/package.json`
- `packages/astar/tsconfig.json`
- `packages/lex/package.json`
- `packages/lex/tsconfig.json`
- `apps/cluster/package.json`
- `apps/cluster/tsconfig.json`
- `apps/demo/package.json`
- `apps/demo/tsconfig.json`
- `apps/hot-reload/package.json`
- `apps/hot-reload/tsconfig.json`
- `apps/shell/package.json`
- `apps/shell/tsconfig.json`
- `apps/cross-compile/package.json`
- `apps/cross-compile/tsconfig.json`
- `apps/embed-c/package.json`
- `apps/embed-c/tsconfig.json`
- `apps/sample/package.json`
- `apps/sample/tsconfig.json`

---

### Task 1: 创建目录并移动 packages（astar、lex）

**Files:**
- Move: `astar/` → `packages/astar/`
- Move: `lex/` → `packages/lex/`

- [ ] **Step 1: 创建 packages/ 和 apps/ 目录**

```bash
mkdir -p packages apps
```

- [ ] **Step 2: 用 git mv 移动 astar**

```bash
git mv astar packages/astar
```

- [ ] **Step 3: 用 git mv 移动 lex**

```bash
git mv lex packages/lex
```

- [ ] **Step 4: 验证移动结果**

```bash
git status --short
```

期望输出中包含（R 表示 renamed）：
```
R  astar/astar.test.ts -> packages/astar/astar.test.ts
R  astar/heap.ts -> packages/astar/heap.ts
...
R  lex/calc.ts -> packages/lex/calc.ts
...
```

- [ ] **Step 5: 提交**

```bash
git add -A
git commit -m "chore: move astar and lex to packages/"
```

---

### Task 2: 移动所有 apps 目录

**Files:**
- Move: `cluster/` → `apps/cluster/`
- Move: `demo/` → `apps/demo/`
- Move: `hot-reload/` → `apps/hot-reload/`
- Move: `shell/` → `apps/shell/`
- Move: `cross-compile/` → `apps/cross-compile/`
- Move: `embed-c/` → `apps/embed-c/`
- Move: `sample/` → `apps/sample/`

- [ ] **Step 1: 移动所有 app 目录**

```bash
git mv cluster apps/cluster
git mv demo apps/demo
git mv hot-reload apps/hot-reload
git mv shell apps/shell
git mv cross-compile apps/cross-compile
git mv embed-c apps/embed-c
git mv sample apps/sample
```

- [ ] **Step 2: 验证移动结果**

```bash
ls apps/
```

期望输出：
```
cluster  cross-compile  demo  embed-c  hot-reload  sample  shell
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: move all app directories to apps/"
```

---

### Task 3: 更新根 package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 将 package.json 替换为新内容**

将 `package.json` 完整替换为：

```json
{
  "name": "bun-play",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "devDependencies": {
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^5"
  },
  "scripts": {
    "test": "bun --filter '*' test"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add package.json
git commit -m "chore: configure bun workspaces in root package.json"
```

---

### Task 4: 为 packages/astar 和 packages/lex 添加 workspace 配置

**Files:**
- Create: `packages/astar/package.json`
- Create: `packages/astar/tsconfig.json`
- Create: `packages/lex/package.json`
- Create: `packages/lex/tsconfig.json`

- [ ] **Step 1: 创建 packages/astar/package.json**

```json
{
  "name": "astar",
  "private": true,
  "type": "module"
}
```

写入路径：`packages/astar/package.json`

- [ ] **Step 2: 创建 packages/astar/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

写入路径：`packages/astar/tsconfig.json`

- [ ] **Step 3: 创建 packages/lex/package.json**

```json
{
  "name": "lex",
  "private": true,
  "type": "module"
}
```

写入路径：`packages/lex/package.json`

- [ ] **Step 4: 创建 packages/lex/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

写入路径：`packages/lex/tsconfig.json`

- [ ] **Step 5: 提交**

```bash
git add packages/astar/package.json packages/astar/tsconfig.json \
        packages/lex/package.json packages/lex/tsconfig.json
git commit -m "chore: add package.json and tsconfig.json to packages/*"
```

---

### Task 5: 为 apps（有 TS 入口）添加 workspace 配置

这四个 app 有明确的 TypeScript 入口文件：`cluster`（入口 `cluster.ts`）、`demo`（入口 `index.ts`）、`hot-reload`（入口 `index.ts`）、`shell`（入口 `sh.ts`）。

**Files:**
- Create: `apps/cluster/package.json`
- Create: `apps/cluster/tsconfig.json`
- Create: `apps/demo/package.json`
- Create: `apps/demo/tsconfig.json`
- Create: `apps/hot-reload/package.json`
- Create: `apps/hot-reload/tsconfig.json`
- Create: `apps/shell/package.json`
- Create: `apps/shell/tsconfig.json`

- [ ] **Step 1: 创建 apps/cluster/package.json**

```json
{
  "name": "cluster",
  "private": true,
  "type": "module",
  "module": "cluster.ts"
}
```

- [ ] **Step 2: 创建 apps/cluster/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 3: 创建 apps/demo/package.json**

```json
{
  "name": "demo",
  "private": true,
  "type": "module",
  "module": "index.ts"
}
```

- [ ] **Step 4: 创建 apps/demo/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 5: 创建 apps/hot-reload/package.json**

```json
{
  "name": "hot-reload",
  "private": true,
  "type": "module",
  "module": "index.ts"
}
```

- [ ] **Step 6: 创建 apps/hot-reload/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 7: 创建 apps/shell/package.json**

```json
{
  "name": "shell",
  "private": true,
  "type": "module",
  "module": "sh.ts"
}
```

- [ ] **Step 8: 创建 apps/shell/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 9: 提交**

```bash
git add apps/cluster/ apps/demo/ apps/hot-reload/ apps/shell/
git commit -m "chore: add package.json and tsconfig.json to TS apps"
```

---

### Task 6: 为 apps（无 TS 入口）添加 workspace 配置

`cross-compile`、`embed-c`、`sample` 没有 TypeScript 主入口，省略 `module` 字段。

**Files:**
- Create: `apps/cross-compile/package.json`
- Create: `apps/cross-compile/tsconfig.json`
- Create: `apps/embed-c/package.json`
- Create: `apps/embed-c/tsconfig.json`
- Create: `apps/sample/package.json`
- Create: `apps/sample/tsconfig.json`

- [ ] **Step 1: 创建 apps/cross-compile/package.json**

```json
{
  "name": "cross-compile",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 2: 创建 apps/cross-compile/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 3: 创建 apps/embed-c/package.json**

```json
{
  "name": "embed-c",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 4: 创建 apps/embed-c/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 5: 创建 apps/sample/package.json**

```json
{
  "name": "sample",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 6: 创建 apps/sample/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json"
}
```

- [ ] **Step 7: 提交**

```bash
git add apps/cross-compile/ apps/embed-c/ apps/sample/
git commit -m "chore: add package.json and tsconfig.json to script apps"
```

---

### Task 7: 重建 bun.lock 并验证测试

**Files:**
- Regenerate: `bun.lock`

- [ ] **Step 1: 运行 bun install 重建 lock 文件**

```bash
bun install
```

期望输出类似：
```
bun install v1.x.x
+ astar@workspace:packages/astar
+ lex@workspace:packages/lex
+ cluster@workspace:apps/cluster
...
```

- [ ] **Step 2: 验证 workspace 已正确识别**

```bash
bun pm ls
```

期望输出列出所有 workspace 包（astar、lex、cluster、demo 等）。

- [ ] **Step 3: 运行全局测试**

```bash
bun --filter '*' test
```

期望输出：所有 `packages/astar` 和 `packages/lex` 下的测试通过，无失败项。

- [ ] **Step 4: 提交更新后的 bun.lock**

```bash
git add bun.lock
git commit -m "chore: rebuild bun.lock after monorepo restructure"
```
