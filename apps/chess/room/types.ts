/**
 * room/types.ts — 多人对战协议定义与接口
 *
 * 所有客户端/服务端通信消息、房间状态、玩家接口集中定义于此。
 * 不依赖任何具体实现，为 room/ server/ client/ 三层共享。
 */

// ─── 房间状态 ─────────────────────────────────────────────────

export const RoomState = {
    WAITING:  0,   // 等待第二位玩家
    PLAYING:  1,   // 对局进行中
    FINISHED: 2,   // 对局已结束
} as const;
export type RoomState = (typeof RoomState)[keyof typeof RoomState];

// ─── 玩家接口 ─────────────────────────────────────────────────

export interface Player {
    readonly id:   string;
    readonly name: string;
    readonly type: "human" | "robot";

    /** 向该玩家推送服务端消息 */
    send(msg: ServerMessage): void;

    /** 清理资源 */
    dispose(): void;
}

// ─── 客户端 → 服务器 消息 ──────────────────────────────────────

export type ClientMessage =
    | { type: "create_room"; name: string; vsRobot?: boolean; robotDifficulty?: number }
    | { type: "join_room";   roomId: string; name: string }
    | { type: "quick_match"; name: string }
    | { type: "move";        src: number; dst: number }
    | { type: "move_iccs";   iccs: string }
    | { type: "undo_request" }
    | { type: "undo_respond"; accept: boolean }
    | { type: "resign" }
    | { type: "chat";        text: string };

// ─── 服务器 → 客户端 消息 ──────────────────────────────────────

export type ServerMessage =
    | { type: "room_created";  roomId: string; side: "red" | "black" }
    | { type: "room_joined";   roomId: string; side: "red" | "black"; opponentName: string }
    | { type: "opponent_joined"; opponentName: string }
    | { type: "game_start";    fen: string; yourSide: "red" | "black" }
    | { type: "move_made";     src: number; dst: number; iccs: string; fen: string; side: "red" | "black" }
    | { type: "your_turn" }
    | { type: "game_over";     result: "red_win" | "black_win" | "draw"; reason: string }
    | { type: "undo_request" }
    | { type: "undo_result";   accepted: boolean; fen: string }
    | { type: "opponent_disconnected" }
    | { type: "error";         message: string }
    | { type: "chat";          from: string; text: string };

// ─── WebSocket 连接附带数据 ────────────────────────────────────

export interface WsData {
    playerId: string;
    roomId:   string | null;
}
