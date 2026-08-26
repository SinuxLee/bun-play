/**
 * room/player.ts — 玩家实现
 *
 * HumanPlayer: 包装 WebSocket 连接，消息通过网络推送
 * RobotPlayer: 内置 AI，收到 your_turn 后自动搜索走法
 */

import type { ServerWebSocket } from "bun";
import type { Player, ServerMessage, WsData } from "./types.ts";

// ─── 人类玩家 ─────────────────────────────────────────────────

export class HumanPlayer implements Player {
    readonly type = "human" as const;

    constructor(
        readonly id:   string,
        readonly name: string,
        private _ws:   ServerWebSocket<WsData>,
    ) {}

    send(msg: ServerMessage): void {
        try {
            this._ws.send(JSON.stringify(msg));
        } catch {
            // 连接已断开，静默忽略
        }
    }

    /** 绑定房间 ID 到 WebSocket 连接数据（用于匹配成功时更新等待者） */
    bindRoom(roomId: string): void {
        this._ws.data.roomId = roomId;
    }

    dispose(): void {
        // WebSocket 生命周期由 server 层管理，此处无需关闭
    }
}
// ─── AI 玩家 ──────────────────────────────────────────────────

export interface RobotOptions {
    depth?:     number;   // 搜索深度（默认 4）
    timeLimit?: number;   // 搜索时间上限（毫秒）
}

/**
 * 当 Room 发送 your_turn 时，Robot 通过 onTurnCallback 通知
 * Room 驱动 AI 搜索并执行走法。
 *
 * 注意：Robot 不直接持有 Searcher/Position，搜索逻辑由 Room 调度，
 * 保持 Player 接口的轻量和通用。
 */
export class RobotPlayer implements Player {
    readonly type = "robot" as const;
    readonly difficulty: RobotOptions;

    private _onTurnCallback: (() => void) | null = null;

    constructor(
        readonly id:   string,
        readonly name: string,
        difficulty?: RobotOptions,
    ) {
        this.difficulty = {
            depth:     difficulty?.depth ?? 4,
            timeLimit: difficulty?.timeLimit,
        };
    }

    send(msg: ServerMessage): void {
        if (msg.type === "your_turn" && this._onTurnCallback) {
            // 异步触发，避免阻塞当前调用栈
            setTimeout(() => this._onTurnCallback?.(), 0);
        }
        // Robot 不关心其他消息（game_start, move_made 等）
    }

    /** 注册回合回调，由 Room 在绑定 Robot 时调用 */
    onTurn(cb: () => void): void {
        this._onTurnCallback = cb;
    }

    dispose(): void {
        this._onTurnCallback = null;
    }
}
