import type { GameSession } from "../../types/GameSession";
import { PlaylistSelection } from "../handlers/PlaylistSelection";
import { players } from "../handlers/Message";
import logger from "../utils/logger";
import { SessionStates } from "../classes/SessionStateManager";
import { dev, sleep, db } from "..";
import type { MatchSize } from "../../types/MatchSize";
import type { AssignMatchPayload } from "../../types/AssignMatchPayload";
import { mmsessions } from "../database/models/sessions";
import { eq } from "drizzle-orm";

export class SessionManager {
  private static instance: SessionManager;
  private intervalId: any | null = null;
  public static previousMatchSizes: MatchSize[] = [];
  public static lastMatchPlayerCount: MatchSize[] = [];
  private isProcessing: boolean = false;
  private static readonly MAX_WAIT_TIME = 180000;
  private activeAssignments: Set<string> = new Set();
  private failedSessions: Map<
    string,
    { timestamp: number; retryCount: number }
  > = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 60000;
  private readonly ABSOLUTE_MIN_PLAYERS = 1;

  private constructor() {
    this.start();
  }

  static get(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager();
    }
    return this.instance;
  }

  private getMatchSize(
    region: string,
    playlist: string,
    matchSizes: MatchSize[]
  ): MatchSize | undefined {
    return matchSizes.find(
      (item) => item.playlist === playlist && item.region === region
    );
  }

  private calculateMinPlayers(previousSizes: number[]): number {
    const avg =
      previousSizes.reduce((sum, val) => sum + val, 0) / previousSizes.length;
    const variance =
      previousSizes.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
      previousSizes.length;
    const stdDev = Math.sqrt(variance);

    let minPlayers = Math.round(avg - stdDev * 0.5);
    minPlayers = Math.max(this.ABSOLUTE_MIN_PLAYERS, minPlayers);
    minPlayers = Math.min(minPlayers, 100);
    return minPlayers;
  }

  private calculateEMAMinPlayers(
    region: string,
    playlist: string,
    lastMatchSize: number
  ): number {
    const smoothingFactor = 0.6;
    const lastMatch = this.getMatchSize(
      region,
      playlist,
      SessionManager.lastMatchPlayerCount
    );

    const ema = lastMatch
      ? Math.round(
          smoothingFactor * lastMatchSize +
            (1 - smoothingFactor) * lastMatch.count
        )
      : lastMatchSize;

    const scalingFactor = lastMatchSize > 50 ? 0.9 : 0.8;
    let minPlayers = Math.round(ema * scalingFactor);
    minPlayers = !dev
      ? Math.max(this.ABSOLUTE_MIN_PLAYERS, minPlayers)
      : Math.max(this.ABSOLUTE_MIN_PLAYERS, minPlayers);
    minPlayers = Math.min(minPlayers, 100);
    return minPlayers;
  }

  private calculateTimeBasedMinPlayers(
    server: GameSession,
    baseMinPlayers: number
  ): number {
    const waitTime =
      Date.now() -
      (server?.startTime ? new Date(server.startTime).getTime() : 0);

    if (waitTime >= SessionManager.MAX_WAIT_TIME) {
      return this.ABSOLUTE_MIN_PLAYERS;
    }

    const timeRatio = Math.min(waitTime / SessionManager.MAX_WAIT_TIME, 1);
    const reduction = Math.round(
      (baseMinPlayers - this.ABSOLUTE_MIN_PLAYERS) * timeRatio
    );
    return Math.max(baseMinPlayers - reduction, this.ABSOLUTE_MIN_PLAYERS);
  }

  public async getMinPlayers(
    server: GameSession,
    playlist: string
  ): Promise<number> {
    const lastMatchSize =
      this.getMatchSize(
        server.region,
        playlist,
        SessionManager.lastMatchPlayerCount
      )?.count ?? 1;

    const previousSizes = SessionManager.previousMatchSizes
      .filter(
        (item) => item.playlist === playlist && item.region === server.region
      )
      .map((item) => item.count);

    let baseMinPlayers: number;
    if (previousSizes.length >= 3) {
      baseMinPlayers = this.calculateMinPlayers(previousSizes);
    } else {
      baseMinPlayers = this.calculateEMAMinPlayers(
        server.region,
        playlist,
        lastMatchSize
      );
    }

    if (dev) {
      return 1;
    }

    return this.calculateTimeBasedMinPlayers(server, baseMinPlayers);
  }

  private updateMatchSizes(
    region: string,
    playlist: string,
    playerCount: number
  ): void {
    const matchSize: MatchSize = {
      region,
      playlist,
      count: playerCount,
    };

    SessionManager.lastMatchPlayerCount.push(matchSize);
    SessionManager.previousMatchSizes.push({ ...matchSize });

    if (SessionManager.previousMatchSizes.length > 10) {
      SessionManager.previousMatchSizes =
        SessionManager.previousMatchSizes.slice(-10);
    }
    if (SessionManager.lastMatchPlayerCount.length > 5) {
      SessionManager.lastMatchPlayerCount =
        SessionManager.lastMatchPlayerCount.slice(-5);
    }
  }

  private createAssignMatch(
    session: GameSession,
    playlist: string
  ): AssignMatchPayload {
    return {
      bucketId: `Fortnite:Fortnite:${session.buildUniqueId}:0:${session.region}:${playlist}`,
      matchId: session.matchId,
      matchOptions: "",
      matchOptionsV2: {},
      spectators: [],
      teams: session.teams,
    };
  }

  private async handleMatchAssignment(
    session: GameSession,
    playlist: string
  ): Promise<boolean> {
    if (!session.connection) {
      logger.error(`Session ${session.sessionId} has no connection object.`);
      return false;
    }

    try {
      session.isAssigning = true;
      await sleep(2000);

      session.playlist = playlist;
      session.maxPlayers = playlist.toString().includes("playlist_default")
        ? 100
        : 50;

        /*
      await db
        .update(mmsessions)
        .set({ playlistName: playlist })
        .where(eq(mmsessions.sessionId, session.sessionId)); */

      await SessionStates.SessionAssignment(session);

      const updatedSession = (global.sessions as GameSession[]).find(
        (s) => s.sessionId === session.sessionId
      );

      if (!updatedSession) {
        logger.error(`Session ${session.sessionId} not found in global.sessions after assignment.`);
        this.resetSessionState(session);
        return false;
      }

      updatedSession.assignMatchSent = true;

      const payload = this.createAssignMatch(updatedSession, playlist);
      updatedSession.connection?.send(
        JSON.stringify({
          name: "AssignMatch",
          payload: payload,
        })
      );
      
      logger.info(`Successfully assigned match for session ${session.sessionId} on playlist ${playlist}.`);
      return true;
    } catch (error) {
      logger.error(`Error during handleMatchAssignment for session ${session.sessionId}: ${error}`);
      this.resetSessionState(session);
      return false;
    } finally {
      if (!session.assignMatchSent) {
        logger.warn(`Failed to send AssignMatch for session ${session.sessionId}. Resetting state.`);
        this.resetSessionState(session);
      }
    }
  }

  private resetSessionState(session: GameSession): void {
    session.isAssigning = false;
    session.isSending = false;

    const failedSession = this.failedSessions.get(session.sessionId);
    this.failedSessions.set(session.sessionId, {
      timestamp: Date.now(),
      retryCount: failedSession ? failedSession.retryCount + 1 : 1,
    });
  }

  private shouldSkipSession(session: GameSession): boolean {
    const baseSkip =
      session.isAssigned ||
      session.assignMatchSent ||
      session.isSending;

    if (baseSkip) {
       // Optional: logger.debug(`Skipping session ${session.sessionId} - Already Assigned: ${session.isAssigned}, MatchSent: ${session.assignMatchSent}, IsSending: ${session.isSending}`);
       return true;
    }

    const failedSession = this.failedSessions.get(session.sessionId);
    if (failedSession) {
      if (failedSession.retryCount >= this.MAX_RETRIES) {
        logger.warn(`Skipping session ${session.sessionId} - Max retries (${this.MAX_RETRIES}) reached.`);
        return true;
      }

      if (Date.now() - failedSession.timestamp < this.RETRY_DELAY) {
        logger.debug(`Skipping session ${session.sessionId} - In retry cooldown.`);
        return true;
      }
    }

    return false;
  }

  private async processSession(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    const processingStart = Date.now();

    try {
      const sessions = global.sessions as GameSession[];

      if (!sessions || sessions.length === 0) {
        return;
      }

      this.cleanupFailedSessions();

      const sessionsByRegion = new Map<string, GameSession[]>();

      sessions.forEach((session) => {
        if (!session.startTime) {
          session.startTime = new Date().toISOString();
        }
        const regionSessions = sessionsByRegion.get(session.region) || [];
        regionSessions.push(session);
        sessionsByRegion.set(session.region, regionSessions);
      });

      for (const [region, regionSessions] of sessionsByRegion) {
        if (this.activeAssignments.has(region)) {
          logger.debug(`Region ${region} has an active assignment processing. Skipping region.`);
          continue;
        }

        const activelyAssigningSession = regionSessions.find(
          (s) => (s.isAssigning || s.isSending) && !s.assignMatchSent
        );

        if (activelyAssigningSession) {
          logger.debug(`Region ${region} already has a session currently assigning (${activelyAssigningSession.sessionId}). Skipping region.`);
          continue;
        }

        const unassignedSessions = regionSessions.filter(session => !this.shouldSkipSession(session));
        
        if (unassignedSessions.length === 0) {
          const assignedCount = regionSessions.filter(s => s.isAssigned).length;
          const assigningCount = regionSessions.filter(s => s.isAssigning).length;
          
          if (assignedCount > 0 || assigningCount > 0) {
            logger.debug(`No unassigned sessions in region ${region}. Assigned: ${assignedCount}, Assigning: ${assigningCount}`);
          }
          continue;
        }

        const playlistInfo = PlaylistSelection(region);

        const sortedSessions = unassignedSessions.sort((a, b) => {
          const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
          const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
          return timeA - timeB;
        });

        let sessionProcessed = false;

        for (const session of sortedSessions) {
          const minPlayers = await this.getMinPlayers(
            session,
            playlistInfo.playlist
          );
          const startTime = session.startTime
            ? new Date(session.startTime).getTime()
            : Date.now();
          const waitTime = Math.round((Date.now() - startTime) / 1000);

          logger.info(`Evaluating session ${session.sessionId} | Region: ${region} | Version: ${session.version} | Playlist: ${playlistInfo.playlist} | Players: ${playlistInfo.count}/${minPlayers} | Wait Time: ${waitTime}s`);
          if (playlistInfo.count === 0 && players.length > 0) {
            logger.warn(`${players.length} player(s) queued but none match region ${region}: ${players.map(p => `${p.data.accountId} (region ${p.region}, playlist ${p.playlist}, version ${p.data.version})`).join(", ")}`);
          }

          if (playlistInfo.count >= minPlayers && session.connection) {
            logger.info(`Session ${session.sessionId} meets requirements. Starting assignment...`);
            this.activeAssignments.add(region);
            session.isSending = true;

            try {
              const success = await this.handleMatchAssignment(
                session,
                playlistInfo.playlist
              );
              if (success) {
                this.updateMatchSizes(
                  session.region,
                  playlistInfo.playlist,
                  playlistInfo.count
                );

                this.failedSessions.delete(session.sessionId);
                sessionProcessed = true;
              }
              await sleep(2000);
            } finally {
              this.activeAssignments.delete(region);
            }

            if (sessionProcessed) {
              break;
            }
          } else if (!session.connection) {
             logger.warn(`Session ${session.sessionId} skipped: Missing connection.`);
          } else {
             logger.info(`Session ${session.sessionId} skipped: Not enough players (${playlistInfo.count}/${minPlayers}).`);
             
             if (waitTime > SessionManager.MAX_WAIT_TIME / 1000) {
                logger.warn(`Session ${session.sessionId} has exceeded MAX_WAIT_TIME (${SessionManager.MAX_WAIT_TIME / 1000}s) but still isn't starting! Players: ${playlistInfo.count}/${minPlayers}`);
             }
          }
        }

        if (!sessionProcessed && sortedSessions.length > 0) {
          sortedSessions.forEach((session) => {
            const failedSession = this.failedSessions.get(session.sessionId);
            if (failedSession) {
               logger.warn(`Session ${session.sessionId} is currently failing. Retry count: ${failedSession.retryCount}/${this.MAX_RETRIES}`);
            }
          });
        }
      }
    } catch (error) {
      logger.error(`Error in processSession: ${error}`);
    } finally {
      this.isProcessing = false;
    }
  }

  private cleanupFailedSessions(): void {
    const now = Date.now();
    const expiredTime = now - this.RETRY_DELAY * this.MAX_RETRIES;

    for (const [sessionId, data] of this.failedSessions.entries()) {
      if (data.timestamp < expiredTime || data.retryCount >= this.MAX_RETRIES) {
        this.failedSessions.delete(sessionId);
      }
    }
  }

  private start(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(
      () =>
        this.processSession().catch((error) =>
          logger.error(`Failed to process session: ${error}`)
        ),
      2000
    );
  }
}

export const init = (): SessionManager => {
  return SessionManager.get();
};