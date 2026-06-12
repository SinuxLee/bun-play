// 专题 6：运行时与类型的桥接（类型守卫、品牌类型、satisfies、mini Zod）

// ─── 1. 类型守卫（Type Guards）───────────────────────────────────────────────
// is 关键字：让编译器相信你的运行时检查

type Cat = { kind: "cat"; meow(): void }
type DogG = { kind: "dog"; bark(): void }
type Pet = Cat | DogG

function isCat(pet: Pet): pet is Cat {
  return pet.kind === "cat"
}

function greet(pet: Pet) {
  if (isCat(pet)) {
    pet.meow()   // 这里 pet 已收窄为 Cat
  } else {
    pet.bark()   // 这里 pet 已收窄为 DogG
  }
}

// 断言函数（asserts）：如果不抛错，则 TypeScript 认为断言为真
function assertString(x: unknown): asserts x is string {
  if (typeof x !== "string") throw new TypeError(`Expected string, got ${typeof x}`)
}

function processInput(x: unknown) {
  assertString(x)
  console.log(x.toUpperCase())  // x 收窄为 string ✅
}


// ─── 2. 品牌类型（Branded / Nominal Types）───────────────────────────────────
// TypeScript 是结构类型系统：相同结构的类型可以互相赋值
// 品牌类型通过添加"虚假字段"来模拟名义类型，防止不同语义的 ID 混用

declare const brand: unique symbol  // unique symbol：每个声明都是独一无二的类型

type Brand<T, B extends string> = T & { readonly [brand]: B }

type UserId = Brand<string, "UserId">
type OrderId = Brand<string, "OrderId">

function createUserId(id: string): UserId { return id as UserId }
function createOrderId(id: string): OrderId { return id as OrderId }

function fetchUser(id: UserId) { console.log("fetching user", id) }

const uid = createUserId("u-123")
const oid = createOrderId("o-456")

fetchUser(uid)    // ✅
// fetchUser(oid) // ❌ OrderId 不能赋给 UserId（品牌不同）
// fetchUser("u-123")  // ❌ 裸字符串也不行，必须经过 createUserId 包装


// ─── 3. satisfies 操作符（TS 4.9+）───────────────────────────────────────────
// 问题：用类型注解会丢失字面量类型；用 as const 不做类型检查
// satisfies：既检查类型，又保留字面量类型

type Route = { path: string; method: "GET" | "POST" | "PUT" | "DELETE" }

const routes = {
  home: { path: "/", method: "GET" },
  create: { path: "/users", method: "POST" },
  // bad: { path: "/x",      method: "PATCH" },  // ❌ 编译报错
} satisfies Record<string, Route>

// 注解方式：routes.home.method 的类型是 "GET" | "POST" | "PUT" | "DELETE"（宽泛）
// satisfies：routes.home.method 的类型是 "GET"（字面量，窄）✅
type HomeMethod = typeof routes.home.method  // "GET"


// ─── 4. 迷你 Schema 验证（Zod 核心思想）─────────────────────────────────────
// Zod 的本质：用对象描述"如何把 unknown 变成 T"，类型跟着走

type Infer<S extends AnySchema> = S extends Schema<infer T> ? T : never
type AnySchema = Schema<any>

class Schema<T> {
  constructor(private readonly validator: (x: unknown) => T) { }

  parse(input: unknown): T {
    return this.validator(input)
  }

  optional(): Schema<T | undefined> {
    return new Schema(x => x === undefined ? undefined : this.parse(x))
  }

  // 运算符：and — 交叉验证（两个条件都满足）
  and<U>(other: Schema<U>): Schema<T & U> {
    return new Schema(x => {
      this.parse(x); other.parse(x)
      return x as T & U
    })
  }
}

// 基础类型工厂
const s = {
  string: () => new Schema<string>(x => {
    if (typeof x !== "string") throw new TypeError(`Expected string, got ${typeof x}`)
    return x
  }),
  number: () => new Schema<number>(x => {
    if (typeof x !== "number") throw new TypeError(`Expected number, got ${typeof x}`)
    return x
  }),
  boolean: () => new Schema<boolean>(x => {
    if (typeof x !== "boolean") throw new TypeError(`Expected boolean`)
    return x
  }),
  object: <T extends Record<string, AnySchema>>(shape: T) =>
    new Schema<{ [K in keyof T]: Infer<T[K]> }>(x => {
      if (typeof x !== "object" || x === null) throw new TypeError("Expected object")
      const result: any = {}
      for (const key in shape) {
        result[key] = shape[key].parse((x as any)[key])
      }
      return result
    }),
}

// 使用：类型从 Schema 自动推断，无需手写 interface
const UserSchema = s.object({
  name: s.string(),
  age: s.number(),
  vip: s.boolean().optional(),
})

type User = Infer<typeof UserSchema>
// { name: string; age: number; vip: boolean | undefined }

const validUser = UserSchema.parse({ name: "Alice", age: 30, vip: true })
console.log(validUser.name, validUser.age)  // Alice 30

try {
  UserSchema.parse({ name: 123, age: 30 })  // ❌ 运行时抛出
} catch (e) {
  console.log((e as Error).message)  // Expected string, got number
}


// ─── 5. 综合：用品牌类型 + Schema 构建强类型边界 ────────────────────────────
// 在系统边界（HTTP 入参、数据库读取）验证 + 打品牌，内部只接受品牌类型

type ValidatedUser = Brand<User, "ValidatedUser">

function validateUser(raw: unknown): ValidatedUser {
  return UserSchema.parse(raw) as ValidatedUser
}

function saveUser(user: ValidatedUser) {
  console.log("saving", user.name)
}

const raw = { name: "Bob", age: 25, vip: false }
saveUser(validateUser(raw))   // ✅ 经过验证
// saveUser(raw)              // ❌ 裸对象不是 ValidatedUser
