import { DateTime } from "luxon";
import { appItems, type AgendaItem } from "../agenda";
import { dag, plusDagen, TIJDZONE } from "../datum";
import type { Staat } from "../types";
import { vakantiesIn } from "../vakanties";

/** Tekst veilig maken voor iCal (RFC 5545, 3.3.11). */
export function ontsnap(tekst: string): string {
  return tekst.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Regels langer dan 75 bytes vouwen (RFC 5545, 3.1). */
export function vouw(regel: string): string {
  const bytes = Buffer.from(regel, "utf8");
  if (bytes.length <= 75) return regel;
  const delen: string[] = [];
  let huidig = "";
  let lengte = 0;
  for (const teken of regel) {
    const b = Buffer.byteLength(teken, "utf8");
    const max = delen.length === 0 ? 75 : 74;
    if (lengte + b > max) {
      delen.push(huidig);
      huidig = "";
      lengte = 0;
    }
    huidig += teken;
    lengte += b;
  }
  delen.push(huidig);
  return delen.join("\r\n ");
}

function utc(datum: string, klok: string): string {
  const [u, m] = klok.split(":").map(Number);
  return DateTime.fromISO(datum, { zone: TIJDZONE }).set({ hour: u, minute: m }).toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
}

function datumWaarde(datum: string): string {
  return datum.replace(/-/g, "");
}

export interface FeedOpties {
  /** Alleen items van dit gezinslid; zonder: het hele gezin. */
  lid?: string;
  van: string;
  tot: string;
  nu: DateTime;
  domein: string;
}

function naamVan(staat: Staat, id: string | null | undefined): string | undefined {
  return staat.leden.find((l) => l.id === id)?.naam;
}

export function feedNaam(staat: Staat, lid?: string): string {
  const gezin = staat.gezinsnaam || "Gezin";
  const n = lid ? naamVan(staat, lid) : undefined;
  return n ? `${gezin} – ${n}` : gezin;
}

function titel(staat: Staat, item: AgendaItem, opties: FeedOpties): string {
  const voor = item.leden.map((l) => naamVan(staat, l)).filter(Boolean);
  const basis = item.soort === "taak" ? `☐ ${item.titel}` : item.titel;
  if (opties.lid && !item.leden.includes(opties.lid) && (item.brengt === opties.lid || item.haalt === opties.lid)) {
    // In je eigen agenda: een rit voor de kinderen. "Naar school brengen (Stijn, Tobias)", of bij een gewone
    // afspraak wat jouw rol is: "Judo (Stijn · jij brengt)".
    if (item.rit) return `${basis} (${voor.join(", ")})`;
    const rol = [item.brengt === opties.lid ? "brengen" : "", item.haalt === opties.lid ? "halen" : ""].filter(Boolean).join(" en ");
    return `${basis} (${voor.join(", ")} · ${rol})`;
  }
  // In de gezinsfeed zie je voor wie het is; in een persoonlijke feed is dat al duidelijk.
  return !opties.lid && voor.length && voor.length < staat.leden.length ? `${basis} (${voor.join(", ")})` : basis;
}

/** Een iCal-feed met de afspraken en ingeplande taken uit de app. */
export function schrijfFeed(staat: Staat, opties: FeedOpties): string {
  const stempel = opties.nu.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const items = appItems(staat, opties.van, opties.tot).filter(
    // Een persoonlijke agenda: wat over jou gaat, wat je regelt, en de ritten waarbij jij brengt of haalt.
    (i) => !opties.lid || i.leden.includes(opties.lid) || i.regelaar === opties.lid || i.brengt === opties.lid || i.haalt === opties.lid,
  );
  const r: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Gezinsplanner//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${ontsnap(feedNaam(staat, opties.lid))}`,
    `X-WR-TIMEZONE:${TIJDZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const item of items) {
    const omschrijving: string[] = [];
    const regelaar = naamVan(staat, item.regelaar);
    if (regelaar) omschrijving.push(item.soort === "taak" ? `Wie: ${regelaar}` : `Regelt: ${regelaar}`);
    if (item.notitie) omschrijving.push(item.notitie);
    r.push("BEGIN:VEVENT", `UID:${item.sleutel}@${opties.domein}`, `DTSTAMP:${stempel}`);
    if (item.heleDag || !item.begin) {
      r.push(`DTSTART;VALUE=DATE:${datumWaarde(item.datum)}`, `DTEND;VALUE=DATE:${datumWaarde(plusDagen(item.datum, 1))}`);
    } else {
      r.push(`DTSTART:${utc(item.datum, item.begin)}`, `DTEND:${utc(item.datum, item.eind ?? item.begin)}`);
    }
    r.push(`SUMMARY:${ontsnap(titel(staat, item, opties))}`);
    if (item.locatie) r.push(`LOCATION:${ontsnap(item.locatie)}`);
    if (omschrijving.length) r.push(`DESCRIPTION:${ontsnap(omschrijving.join("\n"))}`);
    if (item.soort === "taak") r.push("TRANSP:TRANSPARENT");
    r.push("END:VEVENT");
  }
  // Schoolvakanties van de gekozen regio, als één afspraak over meerdere dagen.
  for (const v of vakantiesIn(staat.regio, opties.van, opties.tot)) {
    r.push(
      "BEGIN:VEVENT",
      `UID:vakantie-${v.regio}-${v.van}@${opties.domein}`,
      `DTSTAMP:${stempel}`,
      `DTSTART;VALUE=DATE:${datumWaarde(v.van)}`,
      `DTEND;VALUE=DATE:${datumWaarde(plusDagen(v.tot, 1))}`,
      `SUMMARY:${ontsnap(v.naam)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  r.push("END:VCALENDAR");
  return r.map(vouw).join("\r\n") + "\r\n";
}

/** Het venster dat een feed laat zien: een maand terug, een half jaar vooruit. */
export function feedVenster(nu: DateTime): { van: string; tot: string } {
  const vandaag = dag(nu.setZone(TIJDZONE).toISODate()!);
  return { van: vandaag.minus({ days: 31 }).toISODate()!, tot: vandaag.plus({ days: 183 }).toISODate()! };
}
