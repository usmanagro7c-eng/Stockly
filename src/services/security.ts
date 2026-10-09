/** PIN handling — only the SHA-256 digest is ever persisted. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  if (!hash) return true;
  return (await hashPin(pin)) === hash;
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}
