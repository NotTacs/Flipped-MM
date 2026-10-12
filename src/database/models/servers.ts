import { pgTable, text, integer } from "drizzle-orm/pg-core";

export const servers = pgTable("servers", {
    sessionId: text("session_id").primaryKey(),
    region: text("region").notNull(),
    playlist: text("playlist").notNull(),
    state: text("state").notNull(),
    players: integer("players").notNull(),
    playercap: integer("playercap").notNull(),
    startedAt: text("started_at").notNull(),
});

export type Servers = typeof servers.$inferSelect;