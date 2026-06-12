// 专题 5：类型体操综合（实现工具类型、复杂推断、穷举检查）

// ─── 1. 从零实现标准工具类型 ─────────────────────────────────────────────────
type MyExclude<T, U> = T extends U ? never : T
type MyExtract<T, U> = T extends U ? T : never
type MyNonNullable<T> = T extends null | undefined ? never : T
type MyReturnType<T> = T extends (...args: any) => infer R ? R : never
type MyParameters<T> = T extends (...args: infer P) => any ? P : never
type MyAwaited<T> = T extends Promise<infer U> ? MyAwaited<U> : T
type MyPartial<T> = { [K in keyof T]?: T[K] }
type MyRequired<T> = { [K in keyof T]-?: T[K] }
type MyReadonly<T> = { readonly [K in keyof T]: T[K] }
type MyRecord<K extends keyof any, V> = { [P in K]: V }
type MyPick<T, K extends keyof T> = { [P in K]: T[P] }
type MyOmit<T, K extends keyof any> = MyPick<T, MyExclude<keyof T, K>>


// ─── 2. UnionToIntersection（联合转交叉）──────────────────────────────────────
// 利用函数参数的逆变位置：U 在逆变位置时，联合 → 交叉
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never

type UI1 = UnionToIntersection<{ a: 1 } | { b: 2 }>   // { a: 1 } & { b: 2 }
type UI2 = UnionToIntersection<string | number>         // string & number = never

// 原理：将每个联合成员包到函数参数（逆变位置）后，用 infer 反推 → 逆变位置推断结果为交叉类型


// ─── 3. Prettify（展开交叉类型为单一对象）────────────────────────────────────
// { a: 1 } & { b: 2 } 在 hover 时很难看，展开成 { a: 1; b: 2 }
// 业界惯用名：Prettify / Simplify / Expand
type Prettify<T> = { [K in keyof T]: T[K] } & {}

type FI = Prettify<{ a: 1 } & { b: 2 } & { c: 3 }>   // { a: 1; b: 2; c: 3 }


// ─── 4. IsUnion（判断是否是联合类型）──────────────────────────────────────────
// 利用分布式条件类型：T 被分布后如果和原 T 不等，说明是联合
type IsUnion<T, U = T> = T extends any ? ([U] extends [T] ? false : true) : never

type IU1 = IsUnion<string | number>  // true
type IU2 = IsUnion<string>           // false
type IU3 = IsUnion<never>            // never


// ─── 5. 穷举检查（Exhaustive Check）──────────────────────────────────────────
// 强制 switch/if 覆盖所有联合分支，漏掉时编译报错

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number }

function assertNever(x: never): never {
  throw new Error("Unhandled case: " + JSON.stringify(x))
}

function area(s: Shape): number {
  switch (s.kind) {
    case "circle": return Math.PI * s.radius ** 2
    case "rect": return s.width * s.height
    case "triangle": return 0.5 * s.base * s.height
    default: return assertNever(s)  // 漏写任何分支 → s 不是 never → 编译报错
  }
}


// ─── 6. 类型安全 Builder 模式 ─────────────────────────────────────────────────
// 问题：build() 只应在所有必填字段都已设置后才能调用
// 用类型累加记录"已设置哪些字段"

type BuilderState = { host?: string; port?: number; db?: string }

class QueryBuilder<TSet extends keyof BuilderState = never> {
  private state: BuilderState = {}

  setHost(host: string): QueryBuilder<TSet | "host"> {
    this.state.host = host
    return this as any
  }
  setPort(port: number): QueryBuilder<TSet | "port"> {
    this.state.port = port
    return this as any
  }
  setDb(db: string): QueryBuilder<TSet | "db"> {
    this.state.db = db
    return this as any
  }

  // build 只在 TSet 包含所有必填字段时可调用
  build(this: QueryBuilder<"host" | "port" | "db">): Required<BuilderState> {
    return this.state as Required<BuilderState>
  }
}

const config = new QueryBuilder()
  .setHost("localhost")
  .setPort(5432)
  .setDb("mydb")
  .build()  // ✅

// new QueryBuilder().setHost("x").build()  // ❌ "db" | "port" 未设置，build 不存在


// ─── 7. OmitNever（过滤掉值为 never 的键）────────────────────────────────────
type OmitNever<T> = { [K in keyof T as T[K] extends never ? never : K]: T[K] }

type WithNever = { a: string; b: never; c: number }
type Clean = OmitNever<WithNever>  // { a: string; c: number }
