import type { ServerWebSocket, Socket } from "bun";

export function sendMessage(socket: ServerWebSocket<Socket>, type: string, payload: any) {
    socket.send(JSON.stringify({
        payload: payload,
        name: type
    }));
}