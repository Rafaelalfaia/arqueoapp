export type AppRole = "user" | "reviewer" | "admin";

export function normalizeRole(v: unknown): AppRole {
  if (v === "admin") return "admin";
  if (v === "reviewer") return "reviewer";
  return "user";
}
