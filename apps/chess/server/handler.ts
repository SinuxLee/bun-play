/**
 * server/handler.ts — WebSocket 消息路由
 *
 * 将 WebSocket 生命周期事件转化为 RoomManager / Room 操作。
 * 不含网络层细节，可独立测试。
 */

import type { ServerWebSocket } from "bun";
import { RoomManager } from "../room/room-manager.ts";
import { HumanPlayer } from "../room/player.ts";
import type { ClientMessage, WsData, ServerMessage } from "../room/types.ts";

export class WsHandler {
    private readonly _manager = new RoomManager();
    /** playerId → ws, 用于断线时反查 */
    private readonly _connections = new Map<string, ServerWebSocket<WsData>>();

    get stats() {
        return {
            connections: this._connections.size,
            rooms: this._manager.roomCount,
            queue: this._manager.queueLength,
        };
    }

    // ─── WebSocket 生命周期 ────────────────────────────────────

    onOpen(ws: ServerWebSocket<WsData>): void {
        this._connections.set(ws.data.playerId, ws);
        console.log(`[ws] connected: ${ws.data.playerId}`);
    }

    onMessage(ws: ServerWebSocket<WsData>, raw: string | Buffer): void {
        const text = typeof raw === "string" ? raw : raw.toString();
        let msg: ClientMessage;
        try {
            msg = JSON.parse(text) as ClientMessage;
        } catch {
            this._sendError(ws, "无效的 JSON 消息");
            return;
        }

        try {
            this._dispatch(ws, msg);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._sendError(ws, message);
        }
    }

    onClose(ws: ServerWebSocket<WsData>): void {
        const { playerId } = ws.data;
        console.log(`[ws] disconnected: ${playerId}`);
        this._connections.delete(playerId);

        // 从匹配队列中移除
        this._manager.removeFromQueue(playerId);

        // 通知所在房间
        const room = this._manager.findRoomByPlayer(playerId);
        if (room) {
            room.handleDisconnect(playerId);
        }
    }

    // ─── 消息分发 ──────────────────────────────────────────────

    private _dispatch(ws: ServerWebSocket<WsData>, msg: ClientMessage): void {
        switch (msg.type) {
            case "create_room":
                this._handleCreateRoom(ws, msg.name, msg.vsRobot, msg.robotDifficulty);
                break;

            case "join_room":
                this._handleJoinRoom(ws, msg.roomId, msg.name);
                break;

            case "quick_match":
                this._handleQuickMatch(ws, msg.name);
                break;

            case "move":
                this._handleMove(ws, msg.src, msg.dst);
                break;

            case "move_iccs":
                this._handleMoveIccs(ws, msg.iccs);
                break;

            case "undo_request":
                this._handleUndoRequest(ws);
                break;

            case "undo_respond":
                this._handleUndoRespond(ws, msg.accept);
                break;

            case "resign":
                this._handleResign(ws);
                break;

            case "chat":
                this._handleChat(ws, msg.text);
                break;

            default:
                this._sendError(ws, `未知消息类型: ${(msg as ClientMessage).type}`);
        }
    }

    // ─── 房间操作 ──────────────────────────────────────────────

    private _handleCreateRoom(
        ws: ServerWebSocket<WsData>,
        name: string,
        vsRobot?: boolean,
        robotDifficulty?: number,
    ): void {
        const player = new HumanPlayer(ws.data.playerId, name, ws);
        const { room, side } = this._manager.createRoom(
            player,
            vsRobot,
            robotDifficulty != null ? { depth: robotDifficulty } : undefined,
        );
        ws.data.roomId = room.id;

        ws.send(JSON.stringify({
            type: "room_created",
            roomId: room.id,
            side: side === 0 ? "red" : "black",
        } satisfies ServerMessage));

        console.log(`[room] created: ${room.id} by ${name} (vsRobot=${!!vsRobot})`);
    }

    private _handleJoinRoom(
        ws: ServerWebSocket<WsData>,
        roomId: string,
        name: string,
    ): void {
        const player = new HumanPlayer(ws.data.playerId, name, ws);
        const { room, side } = this._manager.joinRoom(roomId, player);
        ws.data.roomId = room.id;

        // 告知加入者房间信息
        const opponent = room.getPlayer(side === 0 ? 1 : 0);
        player.send({
            type: "room_joined",
            roomId: room.id,
            side: side === 0 ? "red" : "black",
            opponentName: opponent?.name ?? "Unknown",
        });

        console.log(`[room] ${name} joined ${room.id}`);
    }

    private _handleQuickMatch(ws: ServerWebSocket<WsData>, name: string): void {
        const player = new HumanPlayer(ws.data.playerId, name, ws);
        const result = this._manager.quickMatch(player);

        if (result) {
            // 匹配成功
            ws.data.roomId = result.room.id;
            console.log(`[match] ${name} matched into ${result.room.id}`);
        } else {
            // 入队等待
            ws.send(JSON.stringify({
                type: "room_created",
                roomId: "MATCHING",
                side: "red",
            } satisfies ServerMessage));
            console.log(`[match] ${name} queued for matching`);
        }
    }

    // ─── 游戏操作 ──────────────────────────────────────────────

    private _handleMove(ws: ServerWebSocket<WsData>, src: number, dst: number): void {
        const room = this._requireRoom(ws);
        room.handleMove(ws.data.playerId, src, dst);
    }

    private _handleMoveIccs(ws: ServerWebSocket<WsData>, iccs: string): void {
        const room = this._requireRoom(ws);
        room.handleMoveIccs(ws.data.playerId, iccs);
    }

    private _handleUndoRequest(ws: ServerWebSocket<WsData>): void {
        const room = this._requireRoom(ws);
        room.handleUndoRequest(ws.data.playerId);
    }

    private _handleUndoRespond(ws: ServerWebSocket<WsData>, accept: boolean): void {
        const room = this._requireRoom(ws);
        room.handleUndoRespond(ws.data.playerId, accept);
    }

    private _handleResign(ws: ServerWebSocket<WsData>): void {
        const room = this._requireRoom(ws);
        room.handleResign(ws.data.playerId);
    }

    private _handleChat(ws: ServerWebSocket<WsData>, text: string): void {
        const room = this._requireRoom(ws);
        room.handleChat(ws.data.playerId, text);
    }

    // ─── 工具方法 ──────────────────────────────────────────────

    private _requireRoom(ws: ServerWebSocket<WsData>) {
        const room = ws.data.roomId
            ? this._manager.getRoom(ws.data.roomId)
            : null;
        if (!room) {
            throw new Error("你还未加入任何房间");
        }
        return room;
    }

    private _sendError(ws: ServerWebSocket<WsData>, message: string): void {
        try {
            ws.send(JSON.stringify({ type: "error", message } satisfies ServerMessage));
        } catch {
            // 连接已断开
        }
    }
}
