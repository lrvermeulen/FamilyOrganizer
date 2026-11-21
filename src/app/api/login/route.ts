import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fout } from "@/lib/api";
import { laadStaat } from "@/lib/dienst";
import { cookieOpties, maakSessie, SESSIE_COOKIE, wachtwoordKlopt } from "@/lib/sessie";

const Invoer = z.object({ wachtwoord: z.string().max(200).default(""), lid: z.string().max(64).nullable().default(null) });

export async function POST(req: NextRequest) {
  const invoer = Invoer.safeParse(await req.json().catch(() => ({})));
  if (!invoer.success) return fout("Ongeldige invoer");
  if (!wachtwoordKlopt(invoer.data.wachtwoord)) {
    // Even wachten maakt raden traag.
    await new Promise((r) => setTimeout(r, 800));
    return fout("Dat wachtwoord klopt niet", 401);
  }
  const staat = await laadStaat();
  const lid = staat.leden.find((l) => l.id === invoer.data.lid && l.rol === "ouder")?.id ?? null;
  const res = NextResponse.json({ ok: true, lid });
  res.cookies.set(SESSIE_COOKIE, maakSessie(lid), cookieOpties());
  return res;
}
