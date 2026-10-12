import { v4 as uuidv4 } from "uuid";
import { players } from "../handlers/Message";
import type { Payload } from "../../types/Payload";

export function Queued(ticketId: string, socket: WebSocket, data: Payload) {
	const region = data.region;
	const playlist = data.playlist;

	socket.send(
		JSON.stringify({
			payload: {
				ticketId: ticketId,
				queuedPlayers: players.filter(
					(player) => player.region === region && player.playlist === playlist && player.data.version == data.version
				).length,
				estimatedWaitSec: 30 + Math.floor(60 * Math.random()),
				status: {},
				state: "Queued",
			},
			name: "StatusUpdate",
		})
	);
}
