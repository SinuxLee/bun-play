import { MATE_VALUE } from "../core/constants.ts";
import type { Move } from "../core/constants.ts";

/**
 * 置换表（Transposition Table）
 *
 * 使用 Zobrist 哈希（key + lock 双重校验）标识局面，降低碰撞概率。
 *
 * 表项类型（hashFlag）：
 *   EXACT - 精确分（PV 节点）
 *   ALPHA - 上界分（All 节点）
 *   BETA  - 下界分（Cut 节点）
 */

export const HASH_ALPHA = 1;
export const HASH_BETA  = 2;
export const HASH_EXACT = 3;

export interface HashResult {
    readonly hit: boolean;
    readonly vl:  number;
    readonly mv:  Move;
}

const HASH_SIZE = 1 << 20; // ~100 万条目，必须是 2 的幂
const HASH_MASK = HASH_SIZE - 1;

/**
 * 置换表（平铺 TypedArray 实现，避免对象创建开销）
 */
export class HashTable {
    private readonly _key   = new Int32Array(HASH_SIZE);
    private readonly _lock  = new Int32Array(HASH_SIZE);
    private readonly _depth = new Int8Array(HASH_SIZE);
    private readonly _flag  = new Int8Array(HASH_SIZE);
    private readonly _value = new Int16Array(HASH_SIZE);
    private readonly _move  = new Int32Array(HASH_SIZE);

    clear(): void {
        this._key.fill(0);
        this._lock.fill(0);
        this._depth.fill(0);
        this._flag.fill(0);
        this._value.fill(0);
        this._move.fill(0);
    }

    /**
     * 写入置换表（深度优先替换策略）
     */
    set(
        key: number, lock: number,
        depth: number, flag: number,
        value: number, move: Move, distance: number,
    ): void {
        const idx = key & HASH_MASK;
        if (this._depth[idx]! > depth) return;
        this._key[idx]   = key;
        this._lock[idx]  = lock;
        this._depth[idx] = depth;
        this._flag[idx]  = flag;
        this._move[idx]  = move;
        this._value[idx] = _adjustValueStore(value, distance);
    }

    /**
     * 查询置换表
     * hit=true 时 vl 可直接用于剪枝/返回，mv 是最佳走法提示（可能为 0）
     */
    get(
        key: number, lock: number,
        depth: number, alpha: number, beta: number, distance: number,
    ): HashResult {
        const idx = key & HASH_MASK;
        if (this._key[idx] !== key || this._lock[idx] !== lock) {
            return { hit: false, vl: 0, mv: 0 };
        }

        const mv   = this._move[idx]!;
        const flag = this._flag[idx]!;
        const vl   = _adjustValueLoad(this._value[idx]!, distance);

        if (this._depth[idx]! >= depth) {
            if (flag === HASH_EXACT) return { hit: true, vl, mv };
            if (flag === HASH_ALPHA && vl <= alpha) return { hit: true, vl: alpha, mv };
            if (flag === HASH_BETA  && vl >= beta)  return { hit: true, vl: beta,  mv };
        }

        return { hit: false, vl: 0, mv };
    }
}

function _adjustValueStore(value: number, distance: number): number {
    if (value > MATE_VALUE - 100) return value + distance;
    if (value < -(MATE_VALUE - 100)) return value - distance;
    return value;
}

function _adjustValueLoad(value: number, distance: number): number {
    if (value > MATE_VALUE - 100) return value - distance;
    if (value < -(MATE_VALUE - 100)) return value + distance;
    return value;
}

/**
 * 历史表（走法历史启发）
 *
 * 按 (src << 8 | dst) 索引，大小为 65536。
 * 走法引发 beta 截断时，历史分 += 2^depth。
 * 每次迭代加深前，历史分右移 1 位（衰减）。
 */
export class HistoryTable {
    private readonly _table = new Int32Array(65536);

    clear(): void {
        this._table.fill(0);
    }

    decay(): void {
        for (let i = 0; i < this._table.length; i++) {
            this._table[i]! >>= 1;
        }
    }

    add(move: Move, depth: number): void {
        this._table[move & 0xFFFF]! += 1 << depth;
    }

    get(move: Move): number {
        return this._table[move & 0xFFFF]!;
    }

    /** 返回底层数组（供 MoveSort 直接访问，避免函数调用开销）*/
    get table(): Int32Array {
        return this._table;
    }
}
