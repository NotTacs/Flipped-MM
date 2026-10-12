import { players } from "./handlers/Message";
import Database from "./database/connect";
import { Hono } from "hono";
import type { GameSession } from "../types/GameSession";
import { init } from "./classes/SessionManager";
import { HandlePlaylistSelection } from "./hono/HandlePlaylistSelection";
import { HandlePlaylists } from "./hono/HandlePlaylists";

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

await import("./sockets/Flipped");
await import("./sockets/FlippedSessions")
const args = Bun.argv;

const dbIndex = args.findIndex(arg => arg.startsWith("-db="));
export const configuredDB = process.env.DB_URL || "";
declare global {
	var sessions: GameSession[];
	var lastSelectedPlaylist: Record<string, string>;
}

if (!global.sessions) {
	global.sessions = [];
	global.lastSelectedPlaylist = {};
}

export const sessions = global.sessions;
export const dev = args.includes("-dev");
export const prod = args.includes("prod");

const loadedb = new Database(configuredDB);
await loadedb.connect();
export const db = loadedb.db;

const app = new Hono({ strict: false });

Bun.serve({
	port: 38912,
	fetch: app.fetch,
});

app.get("/s/session/playlist/:region", async (c) => {
	return HandlePlaylistSelection(c); 
});

app.get("/s/session/playlists", async (c) => {
	return HandlePlaylists(c);
});

app.delete("/s/session/playlists", async (c) => {
	return HandlePlaylists(c);
});

app.get("/s/players", async (c) => {
	return c.json({
		amount: players.length,
		players: players.map(p => p.data)
	})
});

app.get("/s/servers", async (c) => {
	return c.json(sessions);
})

init();

