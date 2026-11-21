import { NextResponse, type NextRequest } from "next/server";
import { fout, sessieVan } from "@/lib/api";
import { laadStaat } from "@/lib/dienst";
import { haalExtern } from "@/lib/extern";
import { Datum } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Afspraken uit de gekoppelde agenda's van buiten (Google, Apple, school), live opgehaald. */
export async function GET(req: NextRequest) {
  if (!sessieVan(req)) return fout("Log eerst in", 401);
  const van = Datum.safeParse(req.nextUrl.searchParams.get("van"));
  const tot = Datum.safeParse(req.nextUrl.searchParams.get("tot"));
  if (!van.success || !tot.success || tot.data < van.data) return fout("Geef van en tot (JJJJ-MM-DD)");
  return NextResponse.json(await haalExtern(await laadStaat(), van.data, tot.data));
}
