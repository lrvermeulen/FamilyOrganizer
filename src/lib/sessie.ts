import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSIE_COOKIE = "gz_sessie";
export const SESSIE_DAGEN = 90;

/** Zonder wachtwoord draait de app als demo met voorbeeldgegevens. */
export function modus(): "gezin" | "demo" {
  return process.env.GEZIN_WACHTWOORD ? "gezin" : "demo";
}

function geheim(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  // Zonder SESSION_SECRET: afgeleid van het wachtwoord (verandert het wachtwoord, dan log je opnieuw in).
  return createHash("sha256").update(`gezin:${process.env.GEZIN_WACHTWOORD ?? "demo"}`).digest("hex");
}

function teken(data: string): string {
  return createHmac("sha256", geheim()).update(data).digest("base64url");
}

function gelijk(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function wachtwoordKlopt(invoer: string): boolean {
  const echt = process.env.GEZIN_WACHTWOORD;
  if (!echt) return true;
  // Vergelijk de hashes, zodat de lengte van het wachtwoord niet uitlekt.
  const h = (s: string) => createHash("sha256").update(s).digest("hex");
  return gelijk(h(invoer), h(echt));
}

export interface Sessie {
  /** Het gezinslid (ouder) dat is ingelogd; null = nog niet gekozen. */
  lid: string | null;
}

export function maakSessie(lid: string | null): string {
  const data = Buffer.from(JSON.stringify({ lid, tot: Date.now() + SESSIE_DAGEN * 86_400_000 })).toString("base64url");
  return `${data}.${teken(data)}`;
}

export function leesSessie(waarde: string | undefined): Sessie | null {
  if (!waarde) return null;
  const [data, handtekening] = waarde.split(".");
  if (!data || !handtekening || !gelijk(teken(data), handtekening)) return null;
  try {
    const inhoud = JSON.parse(Buffer.from(data, "base64url").toString()) as { lid: string | null; tot: number };
    if (inhoud.tot < Date.now()) return null;
    return { lid: inhoud.lid };
  } catch {
    return null;
  }
}

export function cookieOpties() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSIE_DAGEN * 86_400,
  };
}

export function nieuwId(): string {
  return randomBytes(9).toString("base64url");
}

export function nieuweSleutel(): string {
  return randomBytes(18).toString("base64url");
}
