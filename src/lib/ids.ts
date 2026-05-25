export function createId(prefix: string) {
  const webCrypto = globalThis.crypto;

  if (webCrypto?.randomUUID) {
    return `${prefix}_${webCrypto.randomUUID()}`;
  }

  const bytes = new Uint8Array(6);
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const rand = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
