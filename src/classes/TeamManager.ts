import type { GameSession } from "../../types/GameSession";
import type { Player } from "../../types/Player";
import { players } from "../handlers/Message";

export class TeamManager {
	private static instance: TeamManager;

	private constructor() { }

	public static getInstance(): TeamManager {
		if (!this.instance) this.instance = new TeamManager();
		return this.instance;
	}

	public getPlayers(session: GameSession): Player[] {
		return players.filter(p =>
			p.playlist === session.playlist &&
			p.region === session.region && p.data.version == session.version
		);
	}

	public getTeamMembers(session: GameSession): Player[] {
		return players.filter(p =>
			p.playlist === session.playlist &&
			p.region === session.region && p.data.version == session.version &&
			session.teams.some(team =>
				team.flat().some(memberId =>
					p.data.party.split(",").includes(memberId)
				)
			)
		);
	}

	public updateTeams(session: GameSession, playersInPlaylist: Player[]): void {
		if (!session.teams) session.teams = [];
	   
		const parties = playersInPlaylist.map(p => p.data.party.split(","));
   
		parties.forEach(party => {
			const sortedParty = [...party].sort();
			
			const partyPlayer = playersInPlaylist.find(p => p.data.party.split(",").includes(party[0]));
			const isCorrectSize = partyPlayer && ((partyPlayer.playlist.includes("duo") && party.length === 2) || 
								(partyPlayer.playlist.includes("squad") && party.length === 4));
	
			const partyExists = session.teams.some(team => {
				const sortedTeam = [...team[0]].sort();
				return JSON.stringify(sortedParty) === JSON.stringify(sortedTeam);
			});
	   
			if (!partyExists && (isCorrectSize || !playersInPlaylist.find(p => 
				p.data.party.split(",").includes(party[0]) && 
				p.data.bIsFill === "true"))) {
				session.teams.push([party]);
			}
		});
		
		const fillPlayers = playersInPlaylist.filter(p => p.data.bIsFill === "true");
		
		for (let i = 0; i < fillPlayers.length; i++) {
			const currentPlayer = fillPlayers[i];
			if (!session.teams.some(team => 
				team[0].includes(currentPlayer.data.party.split(",")[0]))) {
				
				const isDuo = currentPlayer.playlist.includes("duo");
				const targetTeamSize = isDuo ? 2 : 4;
	
				const fillTeam = [currentPlayer.data.party.split(",")[0]];
				
				for (let j = i + 1; j < fillPlayers.length && fillTeam.length < targetTeamSize; j++) {
					const otherPlayer = fillPlayers[j];
					if (!session.teams.some(team => 
						team[0].includes(otherPlayer.data.party.split(",")[0]))) {
						fillTeam.push(otherPlayer.data.party.split(",")[0]);
					}
				}
	
				session.teams.push([fillTeam]);
			}
		}
	}

	public enforce(session: GameSession): void {
		const totalPlayers = session.teams.reduce((total: number, team: Array<string[]>) =>
			total + team.flat().length, 0
		);

		if (totalPlayers > session.maxPlayers) {
			let currentCount = 0;
			session.teams = session.teams.filter((team: Array<string[]>) => {
				const teamSize = team.flat().length;
				if (currentCount + teamSize <= session.maxPlayers) {
					currentCount += teamSize;
					return true;
				}
				return false;
			});
		}
	}
}

export const teamManager = TeamManager.getInstance();

