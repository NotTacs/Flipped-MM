import type { ServerWebSocket, Socket } from "bun";

export interface GameSession {
	matchId: string;
	connection: ServerWebSocket<Socket>;
	isAssigned: boolean;
	isAssigning: boolean;
	sessionId: string;
	teams: string[][][];
	region: string;
	playlist: string;
	bucketId: string;
	buildUniqueId: string;
	version: string;
	isSending: boolean;
	assignMatchSent: boolean;
	minPlayers: number;
	maxPlayers: number;
	stopAllowingConnections: boolean;
	startTime?: string;
}
