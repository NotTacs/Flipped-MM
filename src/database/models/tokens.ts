import { text, pgTable, uniqueIndex } from "drizzle-orm/pg-core";

export const tokens = pgTable('tokens', {
    accountId: text('account_id').notNull(),
    token: text('token').primaryKey().unique().notNull(),
    type: text('type').notNull()
}, (tokens) => {
    return {
        tokenIndex: uniqueIndex('tok_idx').on(tokens.token),
    }
});

export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
