/**
 * room/room.ts — 对局房间
 *
 * 一个 Room 包装一个 Battle 实例，管理双方 Player 的对局生命周期。
 * Room 不感知网络层 — 通过 Player.send() 抽象推送消息。
 */

import { Battle, GameResult } from "../game/battle.ts";
import type { Player, ServerMessage } from "./types.ts";
import { RoomState } from "./types.ts";
import { RobotPlayer } from "./player.ts";

export class Room {
    readonly id: string;
    state: RoomState = RoomState.WAITING;

    private _battle: Battle;
    /** [红方, 黑方] */
    private _players: [Player | null, Player | null] = [null, null];
    /** 当有玩家请求悔棋时记录请求方 side */
    private _undoRequester: number | null = null;

    /** 房间销毁时的回调，由 RoomManager 注册 */
    onDestroy: (() => void) | null = null;

    constructor(id: string, fen?: string) {
        this.id = id;
        this._battle = new Battle(fen);
    }

    // ─── 玩家管理 ─────────────────────────────────────────────

    /** 获取房间内当前玩家数 */
    get playerCount(): number {
        return (this._players[0] ? 1 : 0) + (this._players[1] ? 1 : 0);
    }

    /** 获取指定方的玩家 */
    getPlayer(side: 0 | 1): Player | null {
        return this._players[side];
    }

    /**
     * 玩家加入房间，返回分配的 side (0=红, 1=黑)
     * 如果房间已满，抛出 Error
     */
    join(player: Player, preferSide?: 0 | 1): 0 | 1 {
        if (this.state === RoomState.FINISHED) {
            throw new Error("房间已结束");
        }

        let side: 0 | 1;
        if (preferSide !== undefined && !this._players[preferSide]) {
            side = preferSide;
        } else if (!this._players[0]) {
            side = 0;
        } else if (!this._players[1]) {
            side = 1;
        } else {
            throw new Error("房间已满");
        }

        this._players[side] = player;

        // 如果是 Robot，注册回合回调
        if (player instanceof RobotPlayer) {
            player.onTurn(() => this._handleRobotTurn(side));
        }

        // 通知对手有人加入
        const opponent = this._players[side === 0 ? 1 : 0];
        if (opponent) {
            opponent.send({ type: "opponent_joined", opponentName: player.name });
        }

        // 房间满员，自动开始对局（延迟到下一个微任务，确保调用者先完成）
        if (this._players[0] && this._players[1]) {
            queueMicrotask(() => this._startGame());
        }

        return side;
    }

    // ─── 对局流程 ─────────────────────────────────────────────

    private _startGame(): void {
        this.state = RoomState.PLAYING;
        const fen = this._battle.exportFen();

        for (const side of [0, 1] as const) {
            const player = this._players[side];
            if (!player) continue;
            player.send({
                type: "game_start",
                fen,
                yourSide: side === 0 ? "red" : "black",
            });
        }

        // 通知红方走棋（先手）
        this._notifyTurn();
    }

    /** 通知当前方走棋 */
    private _notifyTurn(): void {
        const currentSide = this._battle.currentSide;
        const player = this._players[currentSide as 0 | 1];
        player?.send({ type: "your_turn" });
    }

    // ─── 走法处理 ─────────────────────────────────────────────

    /**
     * 处理玩家的走法
     * @returns true 如果走法合法并已执行
     */
    handleMove(playerId: string, src: number, dst: number): boolean {
        if (this.state !== RoomState.PLAYING) return false;

        // 验证是否轮到该玩家
        const side = this._playerSide(playerId);
        if (side === null) return false;
        if (this._battle.currentSide !== side) {
            this._sendError(playerId, "还没轮到你走棋");
            return false;
        }

        const event = this._battle.humanMove(src, dst);
        if (!event) {
            this._sendError(playerId, "非法走法");
            return false;
        }

        // 广播走法
        this._broadcast({
            type: "move_made",
            src,
            dst,
            iccs: event.iccs,
            fen: event.fen,
            side: side === 0 ? "red" : "black",
        });

        // 检查对局结果
        if (event.result !== GameResult.ONGOING) {
            this._endGame(event.result);
            return true;
        }

        // 通知下一方走棋
        this._notifyTurn();
        return true;
    }

    /** 处理 ICCS 格式走法（兼容 "b2e2" 和 "B2-E2" 两种格式） */
    handleMoveIccs(playerId: string, raw: string): boolean {
        // 标准化：去连字符、转小写
        const iccs = raw.replace("-", "").toLowerCase();

        if (iccs.length !== 4) {
            this._sendError(playerId, `无效 ICCS 格式: ${raw}`);
            return false;
        }

        const srcCol = iccs.charCodeAt(0) - 97; // 'a' = 0
        const srcRow = parseInt(iccs[1]!, 10);
        const dstCol = iccs.charCodeAt(2) - 97;
        const dstRow = parseInt(iccs[3]!, 10);

        if (srcCol < 0 || srcCol > 8 || dstCol < 0 || dstCol > 8 ||
            isNaN(srcRow) || isNaN(dstRow) || srcRow < 0 || srcRow > 9 || dstRow < 0 || dstRow > 9) {
            this._sendError(playerId, `ICCS 坐标越界: ${raw}`);
            return false;
        }

        // ICCS 坐标 → 16×16 内部坐标
        const src = (3 + srcCol) | ((12 - srcRow) << 4);
        const dst = (3 + dstCol) | ((12 - dstRow) << 4);

        return this.handleMove(playerId, src, dst);
    }

    // ─── AI 走法 ──────────────────────────────────────────────

    private _handleRobotTurn(side: 0 | 1): void {
        if (this.state !== RoomState.PLAYING) return;
        if (this._battle.currentSide !== side) return;

        const robot = this._players[side];
        if (!(robot instanceof RobotPlayer)) return;

        const event = this._battle.aiMove({
            maxDepth: robot.difficulty.depth,
            timeLimit: robot.difficulty.timeLimit,
        });

        if (!event) {
            // AI 无法走棋（极端情况），认输
            this._endGame(side === 0 ? GameResult.BLACK_WIN : GameResult.RED_WIN);
            return;
        }

        const src = event.move & 0xFF;
        const dst = (event.move >>> 8) & 0xFF;

        this._broadcast({
            type: "move_made",
            src,
            dst,
            iccs: event.iccs,
            fen: event.fen,
            side: side === 0 ? "red" : "black",
        });

        if (event.result !== GameResult.ONGOING) {
            this._endGame(event.result);
            return;
        }

        this._notifyTurn();
    }

    // ─── 悔棋 ─────────────────────────────────────────────────

    handleUndoRequest(playerId: string): void {
        if (this.state !== RoomState.PLAYING) return;
        const side = this._playerSide(playerId);
        if (side === null) return;

        const opponent = this._players[side === 0 ? 1 : 0];
        if (!opponent) return;

        if (opponent.type === "robot") {
            // 对 Robot 直接接受悔棋
            this._executeUndo(side);
            return;
        }

        this._undoRequester = side;
        opponent.send({ type: "undo_request" });
    }

    handleUndoRespond(playerId: string, accept: boolean): void {
        if (this._undoRequester === null) return;
        const side = this._playerSide(playerId);
        if (side === null || side === this._undoRequester) return; // 只有对手能回应

        if (accept) {
            this._executeUndo(this._undoRequester);
        } else {
            const requester = this._players[this._undoRequester as 0 | 1];
            requester?.send({
                type: "undo_result",
                accepted: false,
                fen: this._battle.exportFen(),
            });
        }
        this._undoRequester = null;
    }

    private _executeUndo(_requesterSide: number): void {
        // 撤销两步（回到请求方的上一步）
        this._battle.undo();
        this._battle.undo();
        const fen = this._battle.exportFen();

        this._broadcast({
            type: "undo_result",
            accepted: true,
            fen,
        });

        this._notifyTurn();
    }

    // ─── 认输 / 断线 ─────────────────────────────────────────

    handleResign(playerId: string): void {
        if (this.state !== RoomState.PLAYING) return;
        const side = this._playerSide(playerId);
        if (side === null) return;

        const result = side === 0 ? GameResult.BLACK_WIN : GameResult.RED_WIN;
        this._endGame(result, "认输");
    }

    handleDisconnect(playerId: string): void {
        const side = this._playerSide(playerId);
        if (side === null) return;

        this._players[side as 0 | 1] = null;

        // 通知对手
        const opponent = this._players[side === 0 ? 1 : 0];
        if (opponent) {
            opponent.send({ type: "opponent_disconnected" });
        }

        if (this.state === RoomState.PLAYING) {
            // 进行中的对局，断线方判负
            const result = side === 0 ? GameResult.BLACK_WIN : GameResult.RED_WIN;
            this._endGame(result, "对手断开连接");
        }

        // 如果房间空了，触发销毁
        if (!this._players[0] && !this._players[1]) {
            this.onDestroy?.();
        }
    }

    // ─── 聊天 ─────────────────────────────────────────────────

    handleChat(playerId: string, text: string): void {
        const side = this._playerSide(playerId);
        if (side === null) return;
        const player = this._players[side as 0 | 1];
        if (!player) return;

        this._broadcast({ type: "chat", from: player.name, text });
    }

    // ─── 内部工具 ─────────────────────────────────────────────

    private _playerSide(playerId: string): 0 | 1 | null {
        if (this._players[0]?.id === playerId) return 0;
        if (this._players[1]?.id === playerId) return 1;
        return null;
    }

    private _broadcast(msg: ServerMessage): void {
        this._players[0]?.send(msg);
        this._players[1]?.send(msg);
    }

    private _sendError(playerId: string, message: string): void {
        const side = this._playerSide(playerId);
        if (side !== null) {
            this._players[side]?.send({ type: "error", message });
        }
    }

    private _endGame(result: GameResult, reason?: string): void {
        this.state = RoomState.FINISHED;

        let resultStr: "red_win" | "black_win" | "draw";
        let defaultReason: string;
        if (result === GameResult.RED_WIN) {
            resultStr = "red_win";
            defaultReason = "红方胜";
        } else if (result === GameResult.BLACK_WIN) {
            resultStr = "black_win";
            defaultReason = "黑方胜";
        } else {
            resultStr = "draw";
            defaultReason = "和棋";
        }

        this._broadcast({
            type: "game_over",
            result: resultStr,
            reason: reason ?? defaultReason,
        });

        // 清理 robot 回调
        for (const player of this._players) {
            player?.dispose();
        }

        this.onDestroy?.();
    }
}
