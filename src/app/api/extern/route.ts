import { NextResponse, type NextRequest } from "next/server";
import { fout, sessieVan } from "@/lib/api";
import type { AgendaItem } from "@/lib/agenda";
import { laadStaat } from "@/lib/dienst";
import { haalIcs, leesIcs } from "@/lib/ics/lezen";
import { Datum } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Afspraken uit de gekoppelde agenda's van buiten (Google, Apple), live opgehaald. */
export async function GET(req: NextRequest) {
  if (!sessieVan(req)) return fout("Log eerst in", 401);
  const van = Datum.safeParse(req.nextUrl.searchParams.get("van"));
  const tot = Datum.safeParse(req.nextUrl.searchParams.get("tot"));
  if (!van.success || !tot.success || tot.data < van.data) return fout("Geef van en tot (JJJJ-MM-DD)");
  const staat = await laadStaat();
  const fouten: { agenda: string; fout: string }[] = [];
  const lijsten = await Promise.all(
    staat.agendas.map(async (a): Promise<AgendaItem[]> => {
      try {
        return leesIcs(await haalIcs(a.url), a, van.data, tot.data);
      } catch (e) {
        fouten.push({ agenda: a.naam, fout: e instanceof Error ? e.message : "Onbekende fout" });
        return [];
      }
    }),
  );
  return NextResponse.json({ items: lijsten.flat(), fouten });
}
