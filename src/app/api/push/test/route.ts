import { NextResponse, type NextRequest } from "next/server";
import { fout, sessieVan } from "@/lib/api";
import { verstuur } from "@/lib/push";

/** Een testmelding naar je eigen toestellen. */
export async function POST(req: NextRequest) {
  const s = sessieVan(req);
  if (!s?.lid) return fout("Log eerst in", 401);
  const r = await verstuur([{ lid: s.lid, sleutel: `test|${Date.now()}`, titel: "Het werkt 🎉", tekst: "Zo zien meldingen van de gezinsplanner eruit.", url: "/#gezin" }]);
  if (!r.gelukt) return fout("Er kwam geen melding aan. Zet meldingen op dit toestel opnieuw aan.", 400);
  return NextResponse.json(r);
}
