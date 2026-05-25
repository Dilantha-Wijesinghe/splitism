export function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const rand = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
