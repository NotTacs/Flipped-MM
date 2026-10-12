import type { ServerWebSocket, Socket } from "bun";
import type { Payload } from "./Payload";

export interface Player {
	socket: ServerWebSocket<Socket>;
	data: Payload;
	region: string;
	playlist: string;
}