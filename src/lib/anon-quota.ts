// Tracks free-quote usage for anonymous (logged-out) users.
const KEY = "valora_anon_count";
export const ANON_FREE_LIMIT = 3;

export function getAnonCount(): number {
  if (typeof window === "undefined") return 0;
  const v = parseInt(localStorage.getItem(KEY) || "0", 10);
  return Number.isFinite(v) && v >= 0 ? v : 0;
}

export function incAnonCount(): number {
  const next = getAnonCount() + 1;
  try {
    localStorage.setItem(KEY, String(next));
  } catch {
    /* noop */
  }
  return next;
}
