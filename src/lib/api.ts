import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ActieFout } from "./acties";
import { leesSessie, modus, SESSIE_COOKIE, type Sessie } from "./sessie";
import type { Staat } from "./types";

export function fout(bericht: string, status = 400) {
  return NextResponse.json({ fout: bericht }, { status });
}

/** De sessie, of in de demo een sessie zonder wachtwoord. */
export function sessieVan(req: NextRequest): Sessie | null {
  const s = leesSessie(req.cookies.get(SESSIE_COOKIE)?.value);
  if (s) return s;
  return modus() === "demo" ? { lid: null } : null;
}

export function foutBericht(e: unknown): { bericht: string; status: number } {
  if (e instanceof ActieFout) return { bericht: e.message, status: 400 };
  if (e instanceof ZodError) {
    const eerste = e.issues[0];
    return { bericht: `Ongeldige invoer${eerste?.path.length ? ` (${eerste.path.join(".")})` : ""}: ${eerste?.message ?? ""}`, status: 400 };
  }
  console.error(e);
  return { bericht: e instanceof Error ? e.message : "Er ging iets mis", status: 500 };
}

/** Wat de browser te zien krijgt: de geheime agenda-adressen alleen ingekort. */
export function publiek(staat: Staat): Staat {
  return {
    ...staat,
    agendas: staat.agendas.map((a) => {
      let kort = "verborgen";
      try {
        kort = `${new URL(a.url).host}/…`;
      } catch {}
      return { ...a, url: kort };
    }),
  };
}

/** Het adres van de app zoals de browser het ziet (voor de agenda-feeds). */
export function basisUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Vergelijk een geheime sleutel uit een adres zonder tijdsverschil te lekken. */
export function sleutelKlopt(gekregen: string | null | undefined, echt: string | null | undefined): boolean {
  if (!gekregen || !echt) return false;
  const x = Buffer.from(gekregen);
  const y = Buffer.from(echt);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Maak een publieke versie zonder de geheime sleutels voor de keukenstand. */
export function voorKeuken(staat: Staat): Staat {
  return { ...publiek(staat), feedSleutel: "", keukenSleutel: "", inboxSleutel: "", agendas: [], inschattingen: [], percepties: [], gesprekken: [] };
}
