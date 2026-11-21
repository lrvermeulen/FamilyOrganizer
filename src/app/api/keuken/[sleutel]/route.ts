import { NextResponse, type NextRequest } from "next/server";
import { sleutelKlopt, voorKeuken } from "@/lib/api";
import { maandagVan, plusDagen, vandaag } from "@/lib/datum";
import { laadStaat } from "@/lib/dienst";
import { haalExtern } from "@/lib/extern";

export const dynamic = "force-dynamic";

/** Gegevens voor de keukenstand: alleen om te bekijken, met de geheime keukensleutel. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ sleutel: string }> }) {
  const { sleutel } = await params;
  const staat = await laadStaat();
  if (!sleutelKlopt(sleutel, staat.keukenSleutel)) return NextResponse.json({ fout: "Deze link werkt niet (meer)" }, { status: 404 });
  const maandag = maandagVan(vandaag());
  const { items } = await haalExtern(staat, maandag, plusDagen(maandag, 6));
  return NextResponse.json({ staat: voorKeuken(staat), extern: items });
}
