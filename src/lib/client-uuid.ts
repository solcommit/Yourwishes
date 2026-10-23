/** UUID v4 for browsers on both HTTPS and private HTTP development origins. */
export function createClientUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // getRandomValues is available on insecure origins too. Never use Math.random
  // for identifiers that become private Storage paths and database primary keys.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
