import { NextResponse, type NextRequest } from "next/server";
import { sleutelKlopt } from "@/lib/api";
import { laadStaat, voerUit } from "@/lib/dienst";

export const dynamic = "force-dynamic";

/**
 * Iets naar de inbox sturen vanaf de telefoon, zonder in te loggen: voor de Opdracht (Shortcut) op de iPhone.
 * POST /api/inbox/<inboxsleutel>?wie=<lid-id> met de tekst als body (platte tekst, JSON {tekst} of een formulier).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ sleutel: string }> }) {
  const { sleutel } = await params;
  const staat = await laadStaat();
  if (!sleutelKlopt(sleutel, staat.inboxSleutel)) return new NextResponse("Niet gevonden", { status: 404 });
  const ouders = staat.leden.filter((l) => l.rol === "ouder");
  const wie = ouders.find((o) => o.id === req.nextUrl.searchParams.get("wie"))?.id ?? ouders[0]?.id;
  if (!wie) return new NextResponse("Stel eerst het gezin in", { status: 409 });

  const soort = req.headers.get("content-type") ?? "";
  let tekst = "";
  if (soort.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as { tekst?: unknown; text?: unknown };
    tekst = String(body.tekst ?? body.text ?? "");
  } else if (soort.includes("form")) {
    const f = await req.formData();
    tekst = String(f.get("tekst") ?? f.get("text") ?? "");
  } else {
    tekst = await req.text();
  }
  tekst = tekst.trim().slice(0, 2000);
  if (!tekst) return new NextResponse("Geen tekst ontvangen", { status: 400 });
  await voerUit({ type: "opgemerkt.toevoegen", tekst, bron: "delen" }, wie);
  return new NextResponse("In de inbox gezet ✓", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
