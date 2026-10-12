import type { GameSession } from "../../types/GameSession";
import { SessionStates } from "../classes/SessionStateManager";
import logger from "../utils/logger";
import type { Socket } from "bun";
import { v4 } from "uuid";
import jwt from "jsonwebtoken";
import { db } from "..";
import { mmsessions } from "../database/models/sessions";
import { eq } from "drizzle-orm";

export const SessionsIris = Bun.serve<Socket>({
  port: 30213,
  async fetch(request, server) {
    const ah = request.headers.get("authorization");
    if (!ah) {
      logger.Iris(`[FETCH] Authorization header missing`);
      return new Response("No Authorization", { status: 401 });
    }
    
    const [sig1, sig2, session, payload] = ah.split(" ");
    
    if (sig1 !== "Epic-Signed" || sig2 !== "Flipped-Sessions") {
      return new Response("Invalid Authorization", { status: 401 });
    }

    try {
      const decoded = jwt.decode(payload);
      
      const upgradeData = {
        decoded,
        sig: session,
        id: v4().replace(/-/g, ""),
      };
      
      server.upgrade(request, {
        data: upgradeData,
      });
      return undefined;
    } catch (error) {
      return new Response("Invalid JWT", { status: 401 });
    }
  },
  websocket: {
    async open(socket) {
      const startTime = Date.now();
      
      try {
        const { decoded, sig, id } = socket.data as any;
        
        let parsedSessionId;
        try {
          parsedSessionId = JSON.parse(sig);
        } catch (parseError) {
          socket.close(1011, "Invalid session format");
          return;
        }

        const Session: GameSession = {
          matchId: id,
          connection: socket,
          isAssigned: false,
          isAssigning: false,
          sessionId: parsedSessionId,
          region: decoded.region,
          stopAllowingConnections: false,
          playlist: "",
          teams: [],
          bucketId: decoded.bucketId,
          buildUniqueId: decoded.buildUniqueId,
          isSending: false,
          assignMatchSent: false,
          minPlayers: 1,
          version: decoded.version,
          maxPlayers: 0,
        };
        
        sessions.push(Session);
        
        const registeredMessage = JSON.stringify({
          name: "Registered",
          payload: {},
        });
        
        socket.send(registeredMessage);
        
        // Log session state periodically
        const sessionCheckInterval = setInterval(() => {
          const currentSession = sessions.find(s => s.matchId === id);
          if (currentSession) {
            logger.Iris(`[CHECK] Session ${id} still active - isAssigned: ${currentSession.isAssigned}, isAssigning: ${currentSession.isAssigning}`);
          } else {
            clearInterval(sessionCheckInterval);
          }
        }, 1000);
        
        // Clear interval after 30 seconds to prevent memory leaks
        setTimeout(() => {
          clearInterval(sessionCheckInterval);
          logger.Iris(`[CHECK] Stopped monitoring session ${id} after 60 seconds`);
        }, 60000);
        
      } catch (error) {
        logger.Iris(`[OPEN] Error in websocket open handler: ${error}`);
        console.log(error);
        socket.close(1011, "Error!");
      }
    },
    
    close(socket, code, reason) {
      const closeTime = new Date().toISOString();
      const socketId = (socket.data as any)?.id;
      
      const index = sessions.findIndex(
        (session: any) => session.matchId === socketId
      );
      
      if (index !== -1) {
        const sessionToRemove = sessions[index];
        
        try {
          db.delete(mmsessions).where(
            eq(mmsessions.sessionId, sessions[index].sessionId)
          );
          logger.Iris(`[CLOSE] Database deletion initiated for session ${sessionToRemove.sessionId}`);
        } catch (dbError) {
        }
        
        sessions.splice(index, 1);
        logger.Iris(`[CLOSE] Session removed from array. Remaining sessions: ${sessions.length}`);
      } else {
      }
    },
    
    async message(socket, message) {
      const messageTime = Date.now();
      const socketId = (socket.data as any)?.id;
      
      try {
        if (message === "ping") {
          logger.Iris(`[MESSAGE] Ping received from ${socketId}`);
          return;
        }
        
        logger.Iris(`[MESSAGE] Message received from ${socketId}: ${message.toString().substring(0, 100)}...`);
        
        const data = JSON.parse(message.toString());
        logger.Iris(`[MESSAGE] Parsed message type: ${data.name} from ${socketId}`);
        
        const match = sessions.find(
          (session: any) =>
            session.matchId === socketId &&
            session.isAssigning == true
        );
        
        if (!match) {
          logger.Iris(`[MESSAGE] No matching session found for ${socketId} or session not in assigning state`);
          const sessionExists = sessions.find(s => s.matchId === socketId);
          if (sessionExists) {
            logger.Iris(`[MESSAGE] Session exists but isAssigning is ${sessionExists.isAssigning}`);
          } else {
            logger.Iris(`[MESSAGE] Session ${socketId} not found in sessions array`);
          }
          return;
        }
        
        logger.Iris(`[MESSAGE] Found matching session for ${socketId}`);
        
        if (data.name === "AssignMatchResult") {
          const payload = data.payload;
          logger.Iris(`[MESSAGE] AssignMatchResult received - result: ${payload.result}`);
          
          if (payload.result == "failed") {
            logger.Iris(`[MESSAGE] Match assignment failed for ${socketId}`);
            const index = sessions.findIndex(
              (session: any) => session.matchId === socketId
            );
            if (index !== -1) {
              sessions.splice(index, 1);
              logger.Iris(`[MESSAGE] Session ${socketId} removed due to failed assignment. Remaining: ${sessions.length}`);
            }
          } else if (payload.result == "ready") {
            logger.Iris(`[MESSAGE] Match assignment ready for ${socketId} - SessionID: ${match.sessionId}`);
            match.isAssigned = true;
            
            try {
              SessionStates.Play(match);
              logger.Iris(`[MESSAGE] SessionStates.Play() called successfully for ${match.sessionId}`);
            } catch (playError) {
              logger.Iris(`[MESSAGE] Error calling SessionStates.Play(): ${playError}`);
            }
          }
        } else {
          logger.Iris(`[MESSAGE] Unknown message type: ${data.name} from ${socketId}`);
        }
        
        logger.Iris(`[MESSAGE] Message processing completed for ${socketId}. Time taken: ${Date.now() - messageTime}ms`);
        
      } catch (error) {
        logger.Iris(`[MESSAGE] Error processing message from ${socketId}: ${error}`);
        console.log(error);
        socket.close(1011, "Error!");
      }
    },
  },
});

logger.Iris("Flipped-MM Session WebSocket started on Port 30213");