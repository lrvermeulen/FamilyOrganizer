import { NextResponse, type NextRequest } from "next/server";
import { basisUrl, fout, foutBericht, publiek, sessieVan } from "@/lib/api";
import { staatMetSleutel } from "@/lib/dienst";
import { soortOpslag } from "@/lib/opslag";
import { modus } from "@/lib/sessie";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessie = sessieVan(req);
  if (!sessie) return fout("Log eerst in", 401);
  try {
    const staat = await staatMetSleutel();
    const ik = staat.leden.find((l) => l.id === sessie.lid && l.rol === "ouder")?.id ?? null;
    return NextResponse.json({
      modus: modus(),
      opslag: soortOpslag(),
      ik,
      basis: basisUrl(req),
      staat: publiek(staat),
    });
  } catch (e) {
    const f = foutBericht(e);
    return fout(f.bericht, f.status);
  }
}
