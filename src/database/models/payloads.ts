import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

export const mmpayloads = pgTable("mmpayloads", {
    accountId: text("account_id").notNull(),
    sessionId: text("session_id"),
    data: jsonb("data").notNull(),
    matchId: text("match_id")
});

export type Payloads = typeof mmpayloads.$inferSelect;