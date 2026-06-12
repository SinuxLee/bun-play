// 专题 4：递归类型（深层嵌套、链式类型、元组操作）

// ─── 1. JSON 类型（最经典的递归类型）────────────────────────────────────────
type JSONValue =
  | string | number | boolean | null
  | JSONValue[]
  | { [key: string]: JSONValue }

const data: JSONValue = {
  name: "Alice",
  scores: [98, 87],
  meta: { active: true, tags: ["ts", "type"] }
}


// ─── 2. DeepReadonly ─────────────────────────────────────────────────────────
// 内置 Readonly 只有一层，递归版本覆盖任意深度
type DeepReadonly<T> =
  T extends (infer U)[] ? ReadonlyArray<DeepReadonly<U>>
  : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : T

type Config = DeepReadonly<{
  server: { host: string; port: number }
  tags: string[]
}>
// config.server.host  →  只读 ✅
// config.server.host = "x"  →  ❌ 编译报错
// config.tags.push("x")     →  ❌ ReadonlyArray 没有 push


// ─── 3. 元组操作（Tuple Manipulation）───────────────────────────────────────
// 利用可变元组语法拆解和重组元组

type Head<T extends any[]> = T extends [infer H, ...any[]] ? H : never
type Tail<T extends any[]> = T extends [any, ...infer T] ? T : never
type Last<T extends any[]> = T extends [...any[], infer L] ? L : never
type Init<T extends any[]> = T extends [...infer I, any] ? I : never
type Length<T extends any[]> = T['length']

type Reverse<T extends any[]> =
  T extends [infer H, ...infer Rest] ? [...Reverse<Rest>, H] : []

// 测试
type T1 = Head<[1, 2, 3]>     // 1
type T2 = Tail<[1, 2, 3]>     // [2, 3]
type T3 = Last<[1, 2, 3]>     // 3
type T4 = Init<[1, 2, 3]>     // [1, 2]
type T5 = Length<[1, 2, 3]>   // 3
type T6 = Reverse<[1, 2, 3]>  // [3, 2, 1]


// ─── 4. Flatten（展平嵌套数组类型）──────────────────────────────────────────
type Flatten<T extends any[]> =
  T extends [infer H, ...infer Rest]
  ? H extends any[] ? [...Flatten<H>, ...Flatten<Rest>]
  : [H, ...Flatten<Rest>]
  : []

type F1 = Flatten<[1, [2, [3, [4]]]]>   // [1, 2, 3, 4]
type F2 = Flatten<[[1, 2], [3, 4]]>     // [1, 2, 3, 4]


// ─── 5. 类型级别的加法（用元组长度模拟数字）─────────────────────────────────
// 原理：N 长度的元组 → 展开两个元组 → 取 length
type BuildTuple<N extends number, T extends unknown[] = []> =
  T['length'] extends N ? T : BuildTuple<N, [...T, unknown]>

type Add<A extends number, B extends number> =
  [...BuildTuple<A>, ...BuildTuple<B>]['length']

type Sum = Add<3, 4>   // 7
// 局限：递归深度限制（TS 默认约 1000 层），不适合大数运算


// ─── 6. 递归树结构 ───────────────────────────────────────────────────────────
type TreeNode<T> = {
  value: T
  children?: TreeNode<T>[]
}

const tree: TreeNode<string> = {
  value: "root",
  children: [
    { value: "a", children: [{ value: "a1" }] },
    { value: "b" }
  ]
}

// 递归遍历树，收集所有 value 的类型（运行时）
function collectValues<T>(node: TreeNode<T>): T[] {
  return [node.value, ...(node.children ?? []).flatMap(collectValues)]
}

console.log(collectValues(tree))  // ["root", "a", "a1", "b"]


// ─── 挑战：实现 DeepPartial ──────────────────────────────────────────────────
// 内置 Partial 只有一层，实现任意深度的可选版本
// DeepPartial<{ a: { b: { c: string } } }>
// → { a?: { b?: { c?: string } } }

type DeepPartial<T> =
  T extends (infer U)[] ? DeepPartial<U>[]
  : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> }
  : T

type DP = DeepPartial<{ a: { b: { c: string }; d: number[] } }>
// { a?: { b?: { c?: string }; d?: number[] } }
