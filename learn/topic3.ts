// 专题 3：泛型约束 & 变型（协变 / 逆变）

// ─── 背景知识 ─────────────────────────────────────────────────────────────────
// Dog extends Animal（Dog 是子类型，更具体）
type Animal = { name: string }
type Dog    = { name: string; breed: string }

// 协变（covariant）：子类型可替换父类型 → 返回值位置
// 逆变（contravariant）：父类型可替换子类型 → 参数位置
// 口诀：返回值"向下兼容"，参数"向上接受"


// ─── 热身答案 + 解析 ──────────────────────────────────────────────────────────
// declare = 仅类型声明，运行时不存在；这里只做类型推演，不实际调用
declare let f1: (x: Animal) => Dog
declare let f2: (x: Dog)    => Animal
declare let f3: (x: Animal) => Animal
declare let f4: (x: Dog)    => Dog

// 将 fx 赋给 f1，需满足：
//   fx 的参数类型 是 Animal 的超类型（参数逆变：接受范围 ≥）
//   fx 的返回类型 是 Dog    的子类型（返回协变：返回范围 ≤）

// f1 = f2  ❌  参数 Dog < Animal（太窄），返回 Animal > Dog（太宽），双重不满足
// f1 = f3  ❌  参数 Animal = Animal ✅，返回 Animal > Dog ❌
// f1 = f4  ❌  参数 Dog < Animal ❌，返回 Dog = Dog ✅
//              （注意：无 strictFunctionTypes 时参数双变，f4 会被接受；
//               开启 strict 后三个全部报错）


// ─── 挑战 1：method 双变 vs property 逆变 ────────────────────────────────────
interface BivariantHandler {
  handle(e: MouseEvent): void         // method 语法 → TypeScript 历史遗留，双变
}
interface StrictHandler {
  handle: (e: MouseEvent) => void     // property 函数语法 → strictFunctionTypes 生效，逆变
}

declare let bh: BivariantHandler
declare let sh: StrictHandler

// bh = { handle(e: KeyboardEvent) { console.log(e.key) } }
// ✅ 编译通过（双变：KeyboardEvent extends MouseEvent 就行）
// ❌ 运行时：调用方用 MouseEvent 调它，e.key 会 undefined

// sh = { handle: (e: KeyboardEvent) => console.log(e.key) }
// ❌ 编译报错（逆变：要求参数类型是 MouseEvent 的超类型，KeyboardEvent 不是）

// 结论：method 语法存在类型安全漏洞；API 设计时优先用 property 函数语法


// ─── 挑战 2：类型安全工具函数 ────────────────────────────────────────────────
function pick<T, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  return keys.reduce((acc, key) => {
    acc[key] = obj[key]
    return acc
  }, {} as Pick<T, K>)
}

function deepGet<T, K1 extends keyof T, K2 extends keyof T[K1]>(
  obj: T, k1: K1, k2: K2
): T[K1][K2] {
  return obj[k1][k2]  // 两层索引，类型全程推断
}

const user = { name: "Alice", addr: { city: "BJ", zip: "100000" } }
const p    = pick(user, ["name"])            // { name: string }
const city = deepGet(user, "addr", "city")   // string


// ─── 挑战 3：in / out 变型标注 ───────────────────────────────────────────────
// out T → 协变：T 只能出现在"输出"（返回值）位置
// in  T → 逆变：T 只能出现在"输入"（参数）位置

interface Producer<out T> {
  get(): T
  // set(v: T): void ← 加这行报错："Type parameter 'T' is declared out but is used in an 'in' position"
}

interface Consumer<in T> {
  set(v: T): void
  // get(): T ← 加这行报错："Type parameter 'T' is declared in but is used in an 'out' position"
}

function transform<T>(source: Producer<T>, sink: Consumer<T>): void {
  sink.set(source.get())
}

const dogProducer:    Producer<Dog>     = { get: () => ({ name: "Rex", breed: "Lab" }) }
const animalConsumer: Consumer<Animal>  = { set: (a) => console.log("consumed:", a.name) }

transform(dogProducer, animalConsumer)
// ✅ 可以！原因：
//   Producer<out T>：covariant → Producer<Dog> extends Producer<Animal>（Dog ≤ Animal）
//   Consumer<in  T>：contravariant → Consumer<Animal> extends Consumer<Dog>（翻转）
//   TypeScript 推断 T = Animal，两个参数均满足约束
//
// 如果没有 in/out 标注，T 被视为 invariant，
// Consumer<Animal> 不兼容 Consumer<Dog>，编译报错


// ─── 挑战 4：类型安全事件总线（完整实现）──────────────────────────────────────
interface AppEvents {
  login:  { userId: string }
  logout: { userId: string; reason: string }
  error:  { code: number; message: string }
}

class EventBus<TMap extends object> {
  // 内部存储用 any，类型安全由 public API 保证
  private handlers = new Map<keyof TMap, Array<(payload: any) => void>>()

  on<K extends keyof TMap>(event: K, handler: (payload: TMap[K]) => void): void {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event)!.push(handler)
  }

  emit<K extends keyof TMap>(event: K, payload: TMap[K]): void {
    this.handlers.get(event)?.forEach(h => h(payload))
  }
}

const bus = new EventBus<AppEvents>()

bus.on("login", ({ userId }) => console.log(userId))   // userId: string ✅
bus.emit("login", { userId: "u1" })                    // ✅
// bus.emit("login", { userId: 123 })                  // ❌ Type 'number' is not assignable to 'string'
// bus.on("login", ({ code }) => {})                   // ❌ Property 'code' does not exist on type '{ userId: string }'

// 关键设计：K extends keyof TMap 约束事件名；TMap[K] 将名称与 payload 精确绑定
// 内部 any 不泄漏，所有边界都被泛型锁死

// ─── 挑战 4 改进：EventKey 令牌模式（消灭魔术字符串）─────────────────────────
//
// 原版问题：bus.on("logni", ...) 拼错字符串 → 运行时静默失败，编译期无感知
// 改进思路：把"事件名"和"payload 类型"绑定到同一个对象（令牌）上
//           调用处引用对象，不再手写字符串

// 幻象类型（phantom type）：仅存在于编译期，运行时完全消失
class EventKey<Payload> {
  declare readonly _type: Payload   // phantom：不赋值、不占内存，只携带类型信息
  constructor(readonly name: string) {}
}

// 集中定义：事件名和 payload 类型一一绑定，单一真相来源
const AppEvent = {
  login:  new EventKey<{ userId: string }>('login'),
  logout: new EventKey<{ userId: string; reason: string }>('logout'),
  error:  new EventKey<{ code: number; message: string }>('error'),
} as const

class TypedEventBus {
  private handlers = new Map<string, Array<(payload: any) => void>>()

  on<T>(key: EventKey<T>, handler: (payload: T) => void): void {
    if (!this.handlers.has(key.name)) this.handlers.set(key.name, [])
    this.handlers.get(key.name)!.push(handler)
  }

  emit<T>(key: EventKey<T>, payload: T): void {
    this.handlers.get(key.name)?.forEach(h => h(payload))
  }

  off<T>(key: EventKey<T>, handler: (payload: T) => void): void {
    const list = this.handlers.get(key.name)
    if (list) {
      const idx = list.indexOf(handler)
      if (idx !== -1) list.splice(idx, 1)
    }
  }
}

const bus2 = new TypedEventBus()

bus2.on(AppEvent.login, ({ userId }) => console.log(userId))  // userId: string ✅
bus2.emit(AppEvent.login, { userId: 'u123' })                   // ✅
// bus2.emit(AppEvent.login, { userId: 123 })                 // ❌ 编译报错
// bus2.on(AppEvent.login, ({ code }) => {})                  // ❌ 编译报错
// bus2.emit(AppEvnt.login, ...)                              // ❌ "Cannot find name 'AppEvnt'"

// 对比原版的改进：
//   1. 无魔术字符串  → 引用 AppEvent.login 而非 "login"
//   2. 重命名安全    → IDE F2 重命名 AppEvent.login，所有调用处自动跟随
//   3. 类型与名称同源 → EventKey<Payload> 同时承载路由 key 和 payload 类型
//   4. 幻象类型零开销 → _type 字段只在编译期存在，不影响运行时体积
