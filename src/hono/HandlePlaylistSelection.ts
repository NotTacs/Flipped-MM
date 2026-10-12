import type { Context } from "hono";
import { players } from "../handlers/Message";

export const lastSelectedPlaylist: Record<string, string> = {};

export function HandlePlaylistSelection(c: Context) {
	const region = c.req.param("region");

	if (!lastSelectedPlaylist[region]) {
		lastSelectedPlaylist[region] = "playlist_showdownalt_solo";
	}
	
	if (lastSelectedPlaylist[region] == "playlist_showdownalt_duos") {
		lastSelectedPlaylist[region] = "playlist_showdownalt_solo";
	}

	const playerCounts = players.reduce((acc, player) => {
		if (player.region === region) {
			acc[player.playlist] = (acc[player.playlist] || 0) + 1;
		}
		return acc;
	}, {} as Record<string, number>);

	const serverCounts = sessions.reduce((acc, session) => {
		if (session.region === region) {
			acc[session.playlist] = (acc[session.playlist] || 0) + 1;
		}
		return acc;
	}, {} as Record<string, number>);

	if (Object.keys(playerCounts).length === 0) {
		return c.json({
			playlist: lastSelectedPlaylist[region],
			count: 0
		});
	}

	const Metrics = Object.entries(playerCounts).map(([playlist, playerCount]) => {
		const serverCount = serverCounts[playlist] || 0;
		const playersPerServer = serverCount > 0 ? playerCount / serverCount : playerCount;
		const maxPlayersPerServer = playlist.includes("playlist_default") ? 100 : 50;
		const needsServer = playersPerServer >= maxPlayersPerServer || serverCount === 0;

		return {
			playlist: playlist.toLowerCase(),
			playerCount,
			serverCount,
			playersPerServer,
			needsServer
		};
	});

	const playlistNeedingServer = Metrics.find(p => p.needsServer);
	if (playlistNeedingServer) {
		lastSelectedPlaylist[region] = playlistNeedingServer.playlist;
		return c.json({
			playlist: playlistNeedingServer.playlist,
			count: playlistNeedingServer.playerCount
		});
	}

	const defaultPlaylist = Metrics.reduce(
		(max, curr) => curr.playerCount > max.playerCount ? curr : max,
		Metrics[0]
	);

	lastSelectedPlaylist[region] = defaultPlaylist.playlist;

	return c.json({
		playlist: defaultPlaylist.playlist,
		count: defaultPlaylist.playerCount
	});
}