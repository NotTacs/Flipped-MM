import { pgTable, text, jsonb, integer, boolean } from "drizzle-orm/pg-core";

export const mmsessions = pgTable("mmsessions", {
  sessionId: text("session_id"),
  playlistName: text("playlist_name"),
  serverAddress: text("server_address"),
  lastUpdated: text("last_updated"),
  ownerId: text("owner_id"),
  ownerName: text("owner_name"),
  serverName: text("server_name"),
  maxPublicPlayers: integer("max_public_players"),
  maxPrivatePlayers: integer("max_private_players"),
  shouldAdvertise: boolean("should_advertise"),
  allowJoinInProgress: boolean("allow_join_in_progress"),
  isDedicated: boolean("is_dedicated"),
  usesStats: boolean("uses_stats"),
  allowInvites: boolean("allow_invites"),
  usesPresence: boolean("uses_presence"),
  allowJoinViaPresence: boolean("allow_join_via_presence"),
  allowJoinViaPresenceFriendsOnly: boolean("allow_join_via_presence_friends_only"),
  buildUniqueId: text("build_unique_id"),
  attributes: text("attributes"),
  serverPort: integer("server_port"),
  openPublicPlayers: integer("open_public_players"),
  openPrivatePlayers: integer("open_private_players"),
  sortWeight: integer("sort_weight"),
  started: boolean("started"),
  publicPlayers: text("public_players"),
  privatePlayers: text("private_players"),
});

export type Sessions = typeof mmsessions.$inferSelect;

