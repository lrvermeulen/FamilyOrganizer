import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fout, sessieVan } from "@/lib/api";
import { laadStaat } from "@/lib/dienst";
import { cookieOpties, maakSessie, SESSIE_COOKIE } from "@/lib/sessie";

/** Kies wie je bent (een van de ouders). Binnen het gezin mag je wisselen zonder opnieuw in te loggen. */
export async function POST(req: NextRequest) {
  if (!sessieVan(req)) return fout("Log eerst in", 401);
  const invoer = z.object({ lid: z.string().max(64) }).safeParse(await req.json().catch(() => ({})));
  if (!invoer.success) return fout("Ongeldige invoer");
  const staat = await laadStaat();
  const lid = staat.leden.find((l) => l.id === invoer.data.lid && l.rol === "ouder");
  if (!lid) return fout("Kies een van de ouders");
  const res = NextResponse.json({ ok: true, lid: lid.id });
  res.cookies.set(SESSIE_COOKIE, maakSessie(lid.id), cookieOpties());
  return res;
}
