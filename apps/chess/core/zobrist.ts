import type { Piece } from "./constants.ts";

/**
 * Zobrist 哈希基础设施
 *
 * 使用 RC4 伪随机流生成哈希密钥，保证分布均匀。
 *
 * pcIdx 对应关系：
 *   0-6  → 红方 将士相马车炮卒（pc - 8）
 *   7-13 → 黑方 将士相马车炮卒（pc - 16 + 7）
 */

// ─── RC4 伪随机流生成器 ──────────────────────────────────────────

class RC4 {
    private x = 0;
    private y = 0;
    private state: number[] = [];

    constructor(key: number[]) {
        for (let i = 0; i < 256; i++) {
            this.state.push(i);
        }
        let j = 0;
        for (let i = 0; i < 256; i++) {
            j = (j + this.state[i]! + key[i % key.length]!) & 0xFF;
            this._swap(i, j);
        }
    }

    private _swap(i: number, j: number): void {
        const t = this.state[i]!;
        this.state[i] = this.state[j]!;
        this.state[j] = t;
    }

    nextByte(): number {
        this.x = (this.x + 1) & 0xFF;
        this.y = (this.y + this.state[this.x]!) & 0xFF;
        this._swap(this.x, this.y);
        return this.state[(this.state[this.x]! + this.state[this.y]!) & 0xFF]!;
    }

    nextLong(): number {
        const n0 = this.nextByte();
        const n1 = this.nextByte();
        const n2 = this.nextByte();
        const n3 = this.nextByte();
        return n0 + (n1 << 8) + (n2 << 16) + ((n3 << 24) & 0xFFFFFFFF);
    }
}

// ─── Zobrist 哈希表结构 ──────────────────────────────────────────

export interface ZobristTables {
    readonly playerKey:  number;
    readonly playerLock: number;
    readonly keyTable:   readonly (readonly number[])[];
    readonly lockTable:  readonly (readonly number[])[];
}

function buildZobristTables(): ZobristTables {
    const rc4 = new RC4([0]);

    const playerKey  = rc4.nextLong();
    rc4.nextLong(); // 与原始实现保持一致：跳过一个随机数
    const playerLock = rc4.nextLong();

    const keyTable:  number[][] = [];
    const lockTable: number[][] = [];

    for (let i = 0; i < 14; i++) {
        const keys:  number[] = [];
        const locks: number[] = [];
        for (let j = 0; j < 256; j++) {
            keys.push(rc4.nextLong());
            rc4.nextLong(); // 与原始实现保持一致：跳过一个随机数
            locks.push(rc4.nextLong());
        }
        keyTable.push(keys);
        lockTable.push(locks);
    }

    return { playerKey, playerLock, keyTable, lockTable };
}

/** 单例 Zobrist 表，模块加载时初始化一次，所有 Position 实例共享 */
export const ZOBRIST: ZobristTables = buildZobristTables();

/**
 * 计算棋子对应的 Zobrist 表索引（0-13）
 * @param pc 棋子编码（8-14 红方，16-22 黑方）
 */
export function zobristPcIdx(pc: Piece): number {
    return pc < 16 ? pc - 8 : pc - 16 + 7;
}
