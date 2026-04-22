# Monorepo 重组设计

**日期：** 2026-04-22  
**状态：** 已批准

## 背景

当前项目 `bun-play` 是一个扁平结构，所有模块（`astar`、`lex`、`cluster` 等）直接放在根目录，共享一个 `package.json` 和 `tsconfig.json`，没有 workspace 配置。目标是将其改造为标准的 Bun workspaces monorepo，按功能分层管理。

## 目标

- 使用 Bun workspaces 管理所有子包
- 按功能分层：`packages/`（可复用库）和 `apps/`（可运行模块）
- 根 `tsconfig.json` 作为基础，各包通过 `extends` 继承
- 包名不使用 npm 作用域前缀
- 使用 `git mv` 移动文件，保留 git history

## 目录结构

```
bun-play/
├── package.json          ← 根包，声明 workspaces
├── tsconfig.json         ← 基础 tsconfig（内容不变）
├── bun.lock              ← 唯一 lock 文件
├── docs/
├── packages/
│   ├── astar/            ← A* 算法库（含堆实现和拼图求解器）
│   └── lex/              ← 词法分析器 / 计算器
└── apps/
    ├── cluster/          ← Bun 多进程集群示例
    ├── demo/             ← HTTP 服务器示例
    ├── hot-reload/       ← 热重载示例
    ├── shell/            ← Bun Shell 脚本示例
    ├── cross-compile/    ← 交叉编译脚本
    ├── embed-c/          ← C 嵌入示例
    └── sample/           ← 其他示例脚本
```

## 根 package.json

```json
{
  "name": "bun-play",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "apps/*"],
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

## 各 workspace 的 package.json

### packages/astar

```json
{
  "name": "astar",
  "private": true,
  "type": "module"
}
```

### packages/lex

```json
{
  "name": "lex",
  "private": true,
  "type": "module"
}
```

### apps/* （有入口文件的包）

以 `apps/cluster` 为例：

```json
{
  "name": "cluster",
  "private": true,
  "type": "module",
  "module": "cluster.ts"
}
```

各 app 的 `module` 字段指向该目录下的主入口文件。无明确入口的 app（如 `cross-compile`、`embed-c`、`sample`）省略 `module` 字段。

## tsconfig 继承

各子包新增 `tsconfig.json`：

```json
{
  "extends": "../../tsconfig.json"
}
```

根 `tsconfig.json` 内容保持不变，作为所有子包的共同基础。

## 实施方式

1. 创建 `packages/` 和 `apps/` 目录
2. 用 `git mv` 将各目录移动到对应位置
3. 更新根 `package.json`（添加 workspaces、scripts）
4. 为每个 workspace 新增 `package.json` 和 `tsconfig.json`
5. 删除已无用的根目录旧配置冗余字段（`module` 字段）
6. 运行 `bun install` 重建 `bun.lock`
7. 运行 `bun --filter '*' test` 验证迁移后测试仍通过

## 不在范围内

- 修改各包的源代码
- 添加包间依赖关系
- 配置 CI/CD
