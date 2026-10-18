export const JURY_COOKIE = "vibelabs_jury";

export function juryPassword(): string {
  return process.env.JURY_PASSWORD || "jury-demo";
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

export async function signJuryToken(
  password: string = juryPassword(),
): Promise<string> {
  const secret = process.env.JURY_COOKIE_SECRET || password;
  return hmacHex(secret, `jury:${password}`);
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

export async function isValidJuryToken(
  token: string | undefined | null,
): Promise<boolean> {
  if (!token) return false;
  const expected = await signJuryToken();
  return timingSafeEqualString(token, expected);
}

export function passwordsMatch(
  input: string,
  expected = juryPassword(),
): boolean {
  return timingSafeEqualString(input, expected);
}
