import { DateTime } from "luxon";
import { NextResponse, type NextRequest } from "next/server";
import { sleutelKlopt } from "@/lib/api";
import { alleItems } from "@/lib/bord";
import { TIJDZONE } from "@/lib/datum";
import { laadStaat } from "@/lib/dienst";
import { haalExtern } from "@/lib/extern";
import { teVersturen } from "@/lib/meldingen";
import { abonnementen, markeerVerstuurd, verstuur, verstuurd } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * De klok: kijkt elke paar minuten of er meldingen weg moeten (ochtendbriefing, herinneringen, taken 's avonds).
 * Aan te roepen door een planner (Upstash QStash of cron-job.org) met de header
 * "Authorization: Bearer <CRON_SECRET>" of ?sleutel=<CRON_SECRET>.
 */
async function tik(req: NextRequest) {
  const geheim = process.env.CRON_SECRET;
  if (!geheim) return NextResponse.json({ fout: "Stel eerst CRON_SECRET in (zie SETUP.md)" }, { status: 503 });
  const gekregen = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? req.nextUrl.searchParams.get("sleutel");
  if (!sleutelKlopt(gekregen, geheim)) return NextResponse.json({ fout: "Geen toegang" }, { status: 401 });

  const abos = await abonnementen();
  if (!abos.length) return NextResponse.json({ verstuurd: 0, reden: "Niemand heeft meldingen aangezet" });
  const staat = await laadStaat();
  const nu = DateTime.now().setZone(TIJDZONE);
  const datum = nu.toISODate()!;
  const { items: extern } = await haalExtern(staat, datum, datum);
  const items = alleItems(staat, extern, datum, datum);
  const al = new Set(Object.keys(await verstuurd()));
  const meldingen = teVersturen(staat, items, datum, nu.toFormat("HH:mm"), al, new Set(abos.map((a) => a.lid)));
  const r = await verstuur(meldingen);
  await markeerVerstuurd(meldingen.map((m) => m.sleutel), datum);
  return NextResponse.json({ verstuurd: meldingen.length, ...r });
}

export const GET = tik;
export const POST = tik;
