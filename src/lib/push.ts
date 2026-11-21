import webpush, { type PushSubscription } from "web-push";
import type { Melding } from "./meldingen";
import { opslag } from "./opslag";
import { modus } from "./sessie";

/** Een toestel (telefoon, tablet) dat meldingen wil krijgen. */
export interface Abonnement {
  lid: string;
  abonnement: PushSubscription;
  apparaat: string;
  op: string;
}

const voorvoegsel = () => (modus() === "demo" ? "demo:" : "gezin:");
const K_SLEUTELS = () => `${voorvoegsel()}push:vapid`;
const K_ABONNEMENTEN = () => `${voorvoegsel()}push:abonnementen`;
const K_VERSTUURD = () => `${voorvoegsel()}push:verstuurd`;

/** De sleutels voor Web Push: uit de instellingen, of eenmalig gemaakt en bewaard in de opslag. */
export async function vapidSleutels(): Promise<{ publicKey: string; privateKey: string }> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const bewaard = await opslag().lees(K_SLEUTELS());
  if (bewaard) return JSON.parse(bewaard);
  const nieuw = webpush.generateVAPIDKeys();
  await opslag().zet(K_SLEUTELS(), JSON.stringify(nieuw));
  return nieuw;
}

export async function abonnementen(): Promise<Abonnement[]> {
  const t = await opslag().lees(K_ABONNEMENTEN());
  return t ? (JSON.parse(t) as Abonnement[]) : [];
}

async function bewaarAbonnementen(lijst: Abonnement[]) {
  await opslag().zet(K_ABONNEMENTEN(), JSON.stringify(lijst));
}

export async function voegAbonnementToe(a: Abonnement) {
  const lijst = (await abonnementen()).filter((x) => x.abonnement.endpoint !== a.abonnement.endpoint);
  await bewaarAbonnementen([...lijst, a]);
}

export async function verwijderAbonnement(endpoint: string) {
  await bewaarAbonnementen((await abonnementen()).filter((x) => x.abonnement.endpoint !== endpoint));
}

/** Welke meldingen al verstuurd zijn (sleutel → datum), alleen van de laatste dagen. */
export async function verstuurd(): Promise<Record<string, string>> {
  const t = await opslag().lees(K_VERSTUURD());
  return t ? JSON.parse(t) : {};
}

export async function markeerVerstuurd(sleutels: string[], datum: string) {
  const oud = await verstuurd();
  const grens = new Date(Date.parse(datum) - 3 * 86_400_000).toISOString().slice(0, 10);
  const nieuw = Object.fromEntries(Object.entries(oud).filter(([, d]) => d >= grens));
  for (const s of sleutels) nieuw[s] = datum;
  await opslag().zet(K_VERSTUURD(), JSON.stringify(nieuw));
}

/** Verstuur meldingen naar alle toestellen van de betreffende ouders. Verlopen abonnementen gaan eruit. */
export async function verstuur(meldingen: Melding[]): Promise<{ gelukt: number; mislukt: number }> {
  if (!meldingen.length) return { gelukt: 0, mislukt: 0 };
  const { publicKey, privateKey } = await vapidSleutels();
  webpush.setVapidDetails("mailto:gezinsplanner@example.invalid", publicKey, privateKey);
  const lijst = await abonnementen();
  const weg = new Set<string>();
  let gelukt = 0;
  let mislukt = 0;
  await Promise.all(
    meldingen.flatMap((m) =>
      lijst
        .filter((a) => a.lid === m.lid)
        .map(async (a) => {
          try {
            await webpush.sendNotification(a.abonnement, JSON.stringify({ titel: m.titel, tekst: m.tekst, url: m.url, tag: m.sleutel }), {
              TTL: 60 * 60,
            });
            gelukt++;
          } catch (e) {
            mislukt++;
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) weg.add(a.abonnement.endpoint);
          }
        }),
    ),
  );
  if (weg.size) await bewaarAbonnementen(lijst.filter((a) => !weg.has(a.abonnement.endpoint)));
  return { gelukt, mislukt };
}
