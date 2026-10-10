import { format } from "date-fns";

export type IdPrefix = "BUY" | "SELL" | "EXPENSE" | "ADJ" | "CHANGE" | "INV";

/**
 * Generates sequential, collision-safe record IDs of the form
 * PREFIX-YYYYMMDD-NNNNNN, based on the IDs that already exist.
 */
/**
 * Safety bound on the collision walk below. A corrupt or hand-edited backup
 * containing a long run of consecutive IDs would otherwise spin here and
 * lock up the UI thread.
 */
const MAX_COLLISION_STEPS = 10_000;

export function generateRecordId(prefix: IdPrefix, existing: Iterable<string>): string {
  const day = format(new Date(), "yyyyMMdd");
  const head = `${prefix}-${day}-`;
  let max = 0;
  const taken = new Set<string>();
  for (const id of existing) {
    if (typeof id !== "string") continue;
    if (id.startsWith(head)) {
      const n = parseInt(id.slice(head.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
      // Only today's IDs can collide with today's candidate, so tracking
      // those alone is enough.
      taken.add(id);
    }
  }
  let next = max + 1;
  let candidate = `${head}${String(next).padStart(6, "0")}`;
  let steps = 0;
  while (taken.has(candidate)) {
    if (++steps > MAX_COLLISION_STEPS) break;
    next += 1;
    candidate = `${head}${String(next).padStart(6, "0")}`;
  }
  return candidate;
}

export function generateDeviceId(): string {
  const bytes = new Uint8Array(4);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 4; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return `WEB-${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}
