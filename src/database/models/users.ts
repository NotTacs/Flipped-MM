import {
    boolean,
    date,
    integer,
    pgTable,
    text,
    uniqueIndex,
  } from "drizzle-orm/pg-core";
  
  export const users = pgTable(
    "users",
    {
      created: date("created").notNull(),
      discordId: text("discordId").notNull(),
      accountId: text("accountId").primaryKey().unique(),
      displayName: text("displayname").notNull(),
      email: text("email").unique().notNull(),
      password: text("password").notNull(),
      role: text("role").notNull(),
      banned: boolean("banned").default(false).notNull(),
      banhistory: text("banhistory").default("{}").notNull(),
      isPrem: boolean("isPrem").default(false).notNull(),
      isBooster: boolean("isBooster").default(false).notNull(),
      isServer: boolean("isServer").default(false).notNull(),
      hasFL: boolean("hasFL").default(false).notNull(),
      partyIndex: integer("partyIndex").default(0).notNull(),
      lastLoginTime: text("LastLoginTime")
        .notNull()
        .default("0000:00:00:00:00:00"),
      lastLoginIP: text("LastLoginIP").notNull().default("0.0.0.0"),
      hwid: text("hwid"),
      profilePicture: text("profilePicture").default("unknown").notNull(),
      displayNameChanges: integer("displayNameChanges").default(0).notNull(),
    },
    (users) => {
      return {
        accountIdIndex: uniqueIndex("acid_idx").on(users.accountId),
        emailIndex: uniqueIndex("eml_idx").on(users.email),
        displayNameIndex: uniqueIndex("dpn_idx").on(users.displayName),
      };
    }
  );
  
  export type User = typeof users.$inferSelect;
  export type NewUser = typeof users.$inferInsert;
  