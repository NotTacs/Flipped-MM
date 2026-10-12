import { eq } from "drizzle-orm";
import { db } from "..";
import type { GameSession } from "../../types/GameSession";
import { mmpayloads } from "../database/models/payloads";
import type { Player } from "../../types/Player";
import { sendMessage } from "../handlers/send";
import { teamManager } from "./TeamManager";
import { players } from "../handlers/Message";

export class SessionStateManager {
	private static instance: SessionStateManager;
	
	private constructor() {}

	public static getInstance(): SessionStateManager {
		if (!this.instance) this.instance = new SessionStateManager();
		return this.instance;
	}

	private async UpdatePlayer(player: Player, session: GameSession): Promise<boolean> {
		return true;
	}

	public async SessionAssignment(session: GameSession): Promise<void> {
		
		const playersInPlaylist = teamManager.getPlayers(session);
		
		teamManager.updateTeams(session, playersInPlaylist);
		teamManager.enforce(session);        
		const selectedPlayers = teamManager.getTeamMembers(session);
		for (const player of selectedPlayers) {
			sendMessage(player.socket, "StatusUpdate", {
				matchId: session.matchId,
				state: "SessionAssignment"
			});
		}
		
	}

	public async Play(session: GameSession): Promise<void> {
		const matchingPlayers = teamManager.getTeamMembers(session);
		
		for (const player of matchingPlayers) {
			const isValid = await this.UpdatePlayer(player, session);
			
			if (!isValid) continue;
			
			sendMessage(player.socket, "Play", {
				matchId: session.matchId,
				sessionId: session.sessionId,
				joinDelaySec: 0
			});
			
			const index = players.findIndex(p => p === player);
			if (index !== -1) {
				players.splice(index, 1);
			}
			
			player.socket.close(1000);
		}
	}
}

export const SessionStates = SessionStateManager.getInstance();

