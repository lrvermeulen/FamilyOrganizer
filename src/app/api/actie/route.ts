import { NextResponse, type NextRequest } from "next/server";
import { fout, foutBericht, publiek, sessieVan } from "@/lib/api";
import { laadStaat, voerUit } from "@/lib/dienst";
import { kortLabel } from "@/lib/datum";
import { afgevinktMeldingen, verzoekMelding } from "@/lib/meldingen";
import { abonnementen, verstuur } from "@/lib/push";
import { cookieOpties, maakSessie, SESSIE_COOKIE } from "@/lib/sessie";

export async function POST(req: NextRequest) {
  const sessie = sessieVan(req);
  if (!sessie) return fout("Log eerst in", 401);
  const body = (await req.json().catch(() => null)) as { actie?: { type?: string }; ik?: string } | null;
  if (!body?.actie) return fout("Geen actie");
  try {
    const isStart = body.actie.type === "gezin.instellen";
    // Bij het instellen van het gezin bestaat er nog niemand: dan zeg je zelf wie je bent.
    let door = sessie.lid;
    if (isStart) door = typeof body.ik === "string" ? body.ik : null;
    else if (!door || !(await laadStaat()).leden.some((l) => l.id === door)) return fout("Kies eerst wie je bent", 409);
    const staat = await voerUit(body.actie, door ?? "");
    if (body.actie.type === "taak.afvinken" && door) {
      // De andere ouder een seintje geven, als die dat wil. Mislukt dat, dan is het afvinken toch gelukt.
      try {
        const taakId = (body.actie as { taakId?: string }).taakId;
        const titel = staat.taken.find((t) => t.id === taakId)?.titel;
        const metAbo = new Set((await abonnementen()).map((a) => a.lid));
        if (titel) await verstuur(afgevinktMeldingen(staat, door, titel, metAbo));
      } catch (e) {
        console.error("Melding afvinken", e);
      }
    }
    if (body.actie.type === "verzoek.sturen" || body.actie.type === "verzoek.beantwoorden") {
      // Een vraag of antwoord meteen doorgeven aan de ander.
      try {
        const id = body.actie.type === "verzoek.beantwoorden" ? (body.actie as { id?: string }).id : undefined;
        const v = id ? staat.verzoeken.find((x) => x.id === id) : staat.verzoeken.at(-1);
        if (v) await verstuur([verzoekMelding(staat, v, kortLabel)]);
      } catch (e) {
        console.error("Melding vraag", e);
      }
    }
    const res = NextResponse.json({ staat: publiek(staat) });
    if (isStart) {
      const ik = staat.leden.find((l) => l.id === door && l.rol === "ouder")?.id ?? null;
      res.cookies.set(SESSIE_COOKIE, maakSessie(ik), cookieOpties());
    }
    return res;
  } catch (e) {
    const f = foutBericht(e);
    return fout(f.bericht, f.status);
  }
}
