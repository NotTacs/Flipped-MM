import { handleStates, players } from "../handlers/Message";
import logger from "../utils/logger";
import type { Socket, ServerWebSocket } from "bun";
import { verify } from "hono/jwt";
import type { Payload } from "../../types/Payload";

const server = Bun.serve({
    port: 2053,
    async fetch(req, server) {
        const JWT_SECRET = process.env.JWT_SECRET || "";

        const headers = new Headers(req.headers);
        const auth = headers.get("authorization") || "";
        const hs = auth.split(" ");
        let data: Payload | null = null;

        logger.Iris(`[PLAYER] Connection attempt from ${server.requestIP(req)?.address ?? "?"} (auth: ${hs[0] ?? "none"} ${hs[1] ?? ""})`);

        if (!auth || hs[0] !== "Epic-Signed" || hs[1] !== "Flipped") {
            logger.Iris(`[PLAYER] Rejected: not a Flipped matchmaking ticket (authorization: "${auth.substring(0, 40)}")`);
            return new Response("Connection was not for matchmaking!", { status: 400 });
        }

        try {
            data = await verify(hs[2] + "." + hs[3], JWT_SECRET) as unknown as Payload;
        } catch (error) {
            logger.Iris(`[PLAYER] Rejected: ticket signature check failed (${error}). JWT_SECRET set: ${JWT_SECRET !== ""}`);
            return new Response("Data was improperly signed!", { status: 400 });
        }

        if (server.upgrade(req, { data: data })) {
            return undefined;
        }
        logger.Iris(`[PLAYER] Rejected: websocket upgrade failed for ${data.accountId}`);
        return new Response("Upgrade failed", { status: 400 });
    },
    websocket: {
        open(socket: ServerWebSocket<Socket>) {
            const data = socket.data as unknown as Payload;
            logger.Iris(`[PLAYER] Connected ${data.accountId} | region: ${data.region} | playlist: ${data.playlist} | version: ${data.version} | party: ${data.party} | fill: ${data.bIsFill}`);
            handleStates(socket, data, "connection");
        },
        close(socket: ServerWebSocket<Socket>, code: number, reason: string) {
            const data = socket.data as unknown as Payload;
            logger.Iris(`[PLAYER] Disconnected ${data?.accountId} (code ${code}${reason ? `, ${reason}` : ""})`);
            handleStates(socket, data, "close");
        },
        message() { },
    },
});

logger.Iris(`Flipped-MM WebSocket started on Port ${server.port}`);