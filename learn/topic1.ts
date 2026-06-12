// 条件类型 & infer	类型推导、类型拆解

type IsString<T> = T extends string ? true : false

type A = IsString<string | number>  // ?
type B = IsString<string | number | boolean>  // ?
type C = IsString<never>  // ?


// 1. 要求：递归解包任意深度的 Promise
type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T
type D = UnwrapPromise<Promise<Promise<string>>>  // string
type E = UnwrapPromise<number>  // number


// 2. 用 infer 从函数类型中提取参数和返回值
type MyParameters<T extends (...args: any) => any> = T extends (...args: infer P) => any ? P : never
type MyReturnType<T extends (...args: any) => any> = T extends (...args: any) => infer U ? U : never

// 测试
declare function foo(a: string, b: number): boolean
type P = MyParameters<typeof foo>  // [string, number]
type R = MyReturnType<typeof foo>  // boolean

// 官方用法
type M = Parameters<typeof foo>  // [string, number]
type N = ReturnType<typeof foo>  // boolean

// 3. 内置 ReturnType 对重载函数只取最后一个，实现取第一个
declare function overloaded(x: string): string
declare function overloaded(x: number): number
declare function overloaded(x: boolean): boolean

// TypeScript 分配规则：将最后的重载填入第一个 slot，依次往前
// 用 "slot 饱和" 消耗后面的重载，最末 slot 就捕获第一个重载
type FirstOverloadReturnType<T> = T extends {
  (...args: any): any       // slot1 ← 第3个重载 (boolean):boolean  [consumed]
  (...args: any): any       // slot2 ← 第2个重载 (number):number    [consumed]
  (...args: any): infer R   // slot3 ← 第1个重载 (string):string    [captured]
} ? R : never

type O  = FirstOverloadReturnType<typeof overloaded>  // string ✅ 第一个重载
type P1 = ReturnType<typeof overloaded>               // boolean (内置：最后一个)

let o:O = true
console.log(typeof o)  // string
