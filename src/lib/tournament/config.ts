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
  recurringJoinMinutes: number;
  maxPlayMinutes: number;
  prizeSplit: PrizeSplit;
};

/**
 * IMPORTANTE: não usar `as const` aqui para evitar readonly/compatibilidade
 * que costuma gerar ~~~~ em alguns setups.
 */
export const DEFAULTS = {
  graceMinutes: 10,
  recurringJoinMinutes: 5,
  maxPlayMinutes: 20,

  // Regra fixa:
  prizeSplit: { first: 0.5, second: 0.3, third: 0.2 },

  // ...o resto que você já tem
} as const;
