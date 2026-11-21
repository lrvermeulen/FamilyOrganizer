import { NextResponse, type NextRequest } from "next/server";
import { sessieVan } from "@/lib/api";
import { voerUit } from "@/lib/dienst";

export const dynamic = "force-dynamic";

/** Doel van het deelmenu op Android ("Delen" → Gezinsplanner): zet de gedeelde tekst in de inbox. */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const tekst = [p.get("title"), p.get("text"), p.get("url")]
    .filter((x): x is string => !!x && !!x.trim())
    .filter((x, i, a) => a.indexOf(x) === i)
    .join("\n")
    .slice(0, 2000);
  const sessie = sessieVan(req);
  const terug = new URL("/#inbox", req.url);
  if (!sessie?.lid || !tekst) return NextResponse.redirect(terug, 303);
  try {
    await voerUit({ type: "opgemerkt.toevoegen", tekst, bron: "delen" }, sessie.lid);
  } catch {
    // Dan staat het er niet in; de app laat de inbox gewoon zien.
  }
  return NextResponse.redirect(terug, 303);
}
