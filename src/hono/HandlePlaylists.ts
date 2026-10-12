import type { Context } from "hono";
import { SessionManager } from "../classes/SessionManager";

export function HandlePlaylists(c: Context) {
	if (c.req.method == "DELETE") {
		SessionManager.lastMatchPlayerCount = [];
		SessionManager.previousMatchSizes = [];
	}
	
	return c.json({
		SessionManager: {
			lastMatchPlayerCount: SessionManager.lastMatchPlayerCount,
			previousMatchSizes: SessionManager.previousMatchSizes
		}
	})
} 