export interface AssignMatchPayload {
    bucketId: string;
    matchId: string;
    matchOptions: string;
    matchOptionsV2: Record<string, unknown>;
    spectators: unknown[];
    teams: unknown[];
}