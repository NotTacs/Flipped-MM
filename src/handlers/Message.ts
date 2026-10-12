import { verify } from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { Connecting } from "../states/Connecting";
import { Waiting } from "../states/Waiting";
import { Queued } from "../states/Queued";
import type { Player } from "../../types/Player";
import { sendMessage } from "./send";
import type { ServerWebSocket, Socket } from "bun";
import type { Payload } from "../../types/Payload";
import { teamManager } from "../classes/TeamManager";
import logger from "../utils/logger";

export const players: Player[] = [];
export const teams: any[] = [];

export async function handleStates(socket: ServerWebSocket<Socket>, data: Payload, type: string) {
	const status: any = socket;

	if (type === "close") {
		const playerIndex = players.findIndex(
			(p) => p.socket === socket && p.region === data.region && p.playlist === data.playlist
		);
		if (playerIndex !== -1) players.splice(playerIndex, 1);
		socket.close();
		return;
	}

	const player: Player = { socket, data, region: data.region, playlist: data.playlist };

	try {
		Connecting(status);
		await new Promise((resolve) => setTimeout(resolve, 800));
		players.push(player);
		logger.Iris(`[PLAYER] Queued ${data.accountId} for ${data.playlist} in ${data.region} (${players.length} player(s) waiting)`);

		Waiting(status);
		await new Promise((resolve) => setTimeout(resolve, 1000));

		const ticketId = uuid().replace(/-/gi, "");
		Queued(ticketId, status, data);

		const intervalId = setInterval(() => {
			let gs = globalThis.sessions.find(
				(f) =>
					f.playlist.toLowerCase() === data.playlist.toLowerCase() &&
					f.region.toLowerCase() === data.region.toLowerCase() && !f.stopAllowingConnections && f.version == player.data.version
			);
			if (gs?.isSending === true) {
				setTimeout(() => {
					let refindGs = globalThis.sessions.find(
						(f) =>
							f.playlist.toLowerCase() === data.playlist.toLowerCase() &&
							f.region.toLowerCase() === data.region.toLowerCase() && !f.stopAllowingConnections && f.version == player.data.version
					);
					if (refindGs?.isSending === true) {
						clearInterval(intervalId);
					}
				}, 3000);
				return;
			}
			
			if (gs == null) {
				Queued(ticketId, status, data);
			}
		}, 3500);
	} catch (error) {
		socket.close();
	}
}
