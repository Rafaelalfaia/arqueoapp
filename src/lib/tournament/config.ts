// src/lib/tournament/config.ts

export const COL = {
  tournaments: "quiz_tournaments",
  instances: "quiz_tournament_instances",
  privates: "quiz_tournament_private",
  questions: "quiz_questions",
  users: "users",
  ledger: "diamond_ledger",
} as const;

export type TournamentType = "recurring" | "special";
export type TournamentStatus =
  | "draft"
  | "open"
  | "scheduled"
  | "live"
  | "closed";
export type InstanceStatus = "lobby" | "in_progress" | "finished" | "cancelled";

export type PrizeSplit = {
  first: number;
  second: number;
  third: number;
};

export type TournamentDefaults = {
  graceMinutes: number;

  // recurring
  recurringJoinMinutes: number; // se quiser expor no UI
  recurringAutoStartSeconds: number; // regra pedida: 30s
  recurringMinPlayersToStart: number; // regra pedida: 2

  maxPlayMinutes: number;
  prizeSplit: PrizeSplit;
};

export const DEFAULTS: TournamentDefaults = {
  graceMinutes: 10,

  recurringJoinMinutes: 5,
  recurringAutoStartSeconds: 30,
  recurringMinPlayersToStart: 2,

  maxPlayMinutes: 20,
  prizeSplit: { first: 0.5, second: 0.3, third: 0.2 },
};
