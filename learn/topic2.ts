// 映射类型 & 模板字面量	类型变换、字符串操作

// 挑战 1 ：把对象的所有方法名提取成 `on${Capitalize<Key>}` 形式
type EventMap<T> = {[
  K in keyof T as
  T[K] extends (...args: any) => any ? `on${Capitalize<K & string>}` : never
  ]: T[K]
}

type E1 = EventMap<{
  click: () => void,
  focus: () => void,
  name: string
}>

const e1: E1 = {
  onClick: () => console.log('clicked'),
  onFocus: () => console.log('focused')
}

e1.onClick()  // clicked
e1.onFocus()  // focused


// ─── 挑战 2：自动生成 getter/setter 类型 ───────────────────────────────────────
// 在映射时重命名键
// 输入：{ name: string; age: number }
// 输出：{ getName: () => string; setName: (v: string) => void;
//         getAge: () => number; setAge: (v: number) => void }
type Getters<T> = { [K in keyof T as `get${Capitalize<K & string>}`]: () => T[K] }
type Setters<T> = { [K in keyof T as `set${Capitalize<K & string>}`]: (v: T[K]) => void }
type GetterSetter<T> = Getters<T> & Setters<T>

type GS = GetterSetter<{ name: string; age: number }>
// 期望：{ getName: () => string; setName: (v: string) => void; getAge: () => number; setAge: (v: number) => void }


// ─── 挑战 3：路径类型（点号访问所有叶子路径）────────────────────────────────────
// 输入：{ a: { b: { c: string }; d: number }; e: boolean }
// 输出："a.b.c" | "a.d" | "e"
// 注意：只要叶子节点路径（非中间路径）
type Paths<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends object
    ? Paths<T[K], `${Prefix}${K & string}.`>  // 递归处理子对象，累积路径前缀
    : `${Prefix}${K & string}`  // 叶子节点，返回完整路径
}[keyof T]  // 联合所有路径字符串

type NestedObj = { a: { b: { c: string }; d: number }; e: boolean }
type AllPaths = Paths<NestedObj>  // "a.b.c" | "a.d" | "e"


// ─── 挑战 4：路由参数解析（资深难度）────────────────────────────────────────────
// 把路由模式字符串解析为参数对象类型
// ParseRoute<"/user/:id/post/:postId"> => { id: string; postId: string }
type ParseRoute<S extends string> = S extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? { [K in Param | keyof ParseRoute<`/${Rest}`>]: string }
  : S extends `${infer _Start}:${infer Param}`
    ? { [K in Param]: string }
    : {}

type RouteParams = ParseRoute<"/user/:id/post/:postId">
// 期望：{ id: string; postId: string }
