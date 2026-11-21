import { DateTime } from "luxon";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { laadStaat } from "@/lib/dienst";
import { TIJDZONE } from "@/lib/datum";
import { feedVenster, schrijfFeed } from "@/lib/ics/schrijven";

export const dynamic = "force-dynamic";

function gelijk(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * De agenda-feed om te abonneren in Google Agenda of Apple Agenda.
 * /api/feed/<sleutel>/gezin.ics voor iedereen, /api/feed/<sleutel>/<lid-id>.ics voor één gezinslid.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ sleutel: string; bestand: string }> }) {
  const { sleutel, bestand } = await params;
  const staat = await laadStaat();
  if (!staat.feedSleutel || !gelijk(sleutel, staat.feedSleutel)) return new Response("Niet gevonden", { status: 404 });
  const naam = bestand.replace(/\.ics$/i, "");
  const lid = naam === "gezin" ? undefined : staat.leden.find((l) => l.id === naam)?.id;
  if (naam !== "gezin" && !lid) return new Response("Niet gevonden", { status: 404 });
  const nu = DateTime.now().setZone(TIJDZONE);
  const tekst = schrijfFeed(staat, {
    lid,
    ...feedVenster(nu),
    nu,
    domein: (req.headers.get("host") ?? "gezinsplanner").split(":")[0],
  });
  return new Response(tekst, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${naam}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
