/**
 * room/room-manager.ts — 房间管理器
 *
 * 管理所有房间的创建、加入、匹配和销毁。
 * 服务器全局持有一个 RoomManager 实例。
 */

import { Room } from "./room.ts";
import { RobotPlayer } from "./player.ts";
import type { Player } from "./types.ts";
import type { RobotOptions } from "./player.ts";

export class RoomManager {
    private _rooms = new Map<string, Room>();
    /** 快速匹配等待队列 */
    private _matchQueue: { player: Player; joinedAt: number }[] = [];

    /** 获取当前房间数 */
    get roomCount(): number { return this._rooms.size; }

    /** 获取匹配队列长度 */
    get queueLength(): number { return this._matchQueue.length; }

    // ─── 创建房间 ─────────────────────────────────────────────

    /**
     * 创建新房间
     * @param creator  创建者
     * @param vsRobot  是否创建人机对战房间
     * @param robotDifficulty  Robot 难度
     * @returns 创建的房间和分配给创建者的 side
     */
    createRoom(
        creator: Player,
        vsRobot = false,
        robotDifficulty?: RobotOptions,
    ): { room: Room; side: 0 | 1 } {
        const roomId = this._generateId();
        const room = new Room(roomId);
        room.onDestroy = () => this._rooms.delete(roomId);
        this._rooms.set(roomId, room);

        // 创建者加入红方
        const side = room.join(creator, 0);

        if (vsRobot) {
            // 自动创建 Robot 并加入黑方
            const robot = new RobotPlayer(
                `robot_${roomId}`,
                "AI",
                robotDifficulty ?? { depth: 4 },
            );
            room.join(robot, 1);
        }

        return { room, side };
    }

    // ─── 加入房间 ─────────────────────────────────────────────

    /**
     * 通过房间号加入
     * @returns 房间和分配的 side
     */
    joinRoom(roomId: string, player: Player): { room: Room; side: 0 | 1 } {
        const room = this._rooms.get(roomId);
        if (!room) {
            throw new Error(`房间 ${roomId} 不存在`);
        }
        const side = room.join(player);
        return { room, side };
    }

    // ─── 快速匹配 ─────────────────────────────────────────────

    /**
     * 快速匹配：如果队列中有人，立刻配对；否则入队等待
     * @returns room + side（如果匹配成功），或 null（入队等待）
     */
    quickMatch(player: Player): { room: Room; side: 0 | 1 } | null {
        // 从队列中取出第一个等待者
        if (this._matchQueue.length > 0) {
            const waiting = this._matchQueue.shift()!;

            // 创建房间，等待者为红方，新来者为黑方
            const roomId = this._generateId();
            const room = new Room(roomId);
            room.onDestroy = () => this._rooms.delete(roomId);
            this._rooms.set(roomId, room);

            room.join(waiting.player, 0);
            const side = room.join(player, 1);

            // 更新等待者的房间绑定（HumanPlayer 有 bindRoom）
            if ("bindRoom" in waiting.player && typeof waiting.player.bindRoom === "function") {
                waiting.player.bindRoom(roomId);
            }

            // 通知等待者
            waiting.player.send({
                type: "room_joined",
                roomId,
                side: "red",
                opponentName: player.name,
            });
            return { room, side };
        }

        // 没有等待者，入队
        this._matchQueue.push({ player, joinedAt: Date.now() });
        return null;
    }

    /** 从匹配队列中移除某玩家（断线时调用） */
    removeFromQueue(playerId: string): void {
        const idx = this._matchQueue.findIndex(e => e.player.id === playerId);
        if (idx >= 0) {
            this._matchQueue.splice(idx, 1);
        }
    }

    // ─── 查询 ─────────────────────────────────────────────────

    /** 根据玩家 ID 查找所在房间 */
    findRoomByPlayer(playerId: string): Room | null {
        for (const room of this._rooms.values()) {
            if (room.getPlayer(0)?.id === playerId || room.getPlayer(1)?.id === playerId) {
                return room;
            }
        }
        return null;
    }

    getRoom(roomId: string): Room | null {
        return this._rooms.get(roomId) ?? null;
    }

    // ─── 内部工具 ─────────────────────────────────────────────

    /** 生成 4 位大写字母房间号 */
    private _generateId(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // 去掉 I/O 避免混淆
        let id: string;
        do {
            id = Array.from({ length: 4 }, () =>
                chars[Math.floor(Math.random() * chars.length)],
            ).join("");
        } while (this._rooms.has(id));
        return id;
    }
}
