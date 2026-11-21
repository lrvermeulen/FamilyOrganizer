import { DateTime } from "luxon";
import { TIJDZONE } from "./datum";
import type { Regio } from "./types";

export interface Vakantie {
  schooljaar: string;
  naam: string;
  regio: Regio;
  /** Eerste en laatste vakantiedag (inclusief). */
  van: string;
  tot: string;
}

/** Schooljaar ("2026-2027") waar deze datum in valt. Een schooljaar begint in augustus. */
export function schooljaarVan(datum: string): string {
  const [j, m] = datum.split("-").map(Number);
  return m >= 8 ? `${j}-${j + 1}` : `${j - 1}-${j}`;
}

interface Ruw {
  content?: { schoolyear?: string; vacations?: { type: string; regions: { region: string; startdate: string; enddate: string }[] }[] }[];
}

/** Zet het antwoord van opendata.rijksoverheid.nl om naar vakanties per regio. */
export function leesVakanties(ruw: Ruw): Vakantie[] {
  const uit: Vakantie[] = [];
  for (const jaar of ruw.content ?? []) {
    const schooljaar = (jaar.schoolyear ?? "").trim();
    for (const v of jaar.vacations ?? []) {
      const naam = v.type.trim();
      for (const r of v.regions) {
        const regio = r.region.trim().toLowerCase();
        const regios: Regio[] = regio === "heel nederland" ? ["noord", "midden", "zuid"] : [regio as Regio];
        // De startdatum is middernacht lokaal; de einddatum 23:59 lokaal, als UTC opgeschreven.
        const van = r.startdate.slice(0, 10);
        const tot = DateTime.fromISO(r.enddate, { zone: "utc" }).setZone(TIJDZONE).toISODate()!;
        for (const g of regios) if (["noord", "midden", "zuid"].includes(g)) uit.push({ schooljaar, naam, regio: g, van, tot });
      }
    }
  }
  return uit;
}

const live = new Map<string, Vakantie[]>();

/** Vakanties van een schooljaar: vast in de app, of live van de Rijksoverheid voor latere jaren. */
export async function vakantiesVan(schooljaar: string, fetcher: typeof fetch = fetch): Promise<Vakantie[]> {
  const vast = VASTE_VAKANTIES.filter((v) => v.schooljaar === schooljaar);
  if (vast.length) return vast;
  if (live.has(schooljaar)) return live.get(schooljaar)!;
  try {
    const res = await fetcher(`https://opendata.rijksoverheid.nl/v1/infotypes/schoolholidays/schoolyear/${schooljaar}?output=json`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const lijst = leesVakanties((await res.json()) as Ruw);
    live.set(schooljaar, lijst);
    return lijst;
  } catch {
    return [];
  }
}

/** Alle vakanties voor een regio die [van, tot] raken (synchroon, alleen de vaste gegevens). */
export function vakantiesIn(regio: Regio | null, van: string, tot: string, lijst: Vakantie[] = VASTE_VAKANTIES): Vakantie[] {
  if (!regio) return [];
  return lijst.filter((v) => v.regio === regio && v.van <= tot && v.tot >= van);
}

/** De vakantie op een dag, of undefined. */
export function vakantieOp(regio: Regio | null, datum: string, lijst: Vakantie[] = VASTE_VAKANTIES): Vakantie | undefined {
  return vakantiesIn(regio, datum, datum, lijst)[0];
}

// Bron: opendata.rijksoverheid.nl (schoolvakanties, CC-0), opgehaald op 21 november 2026.
export const VASTE_VAKANTIES: Vakantie[] = [
  { schooljaar: "2026-2027", naam: "Herfstvakantie", regio: "noord", van: "2026-10-10", tot: "2026-10-18" },
  { schooljaar: "2026-2027", naam: "Herfstvakantie", regio: "midden", van: "2026-10-17", tot: "2026-10-25" },
  { schooljaar: "2026-2027", naam: "Herfstvakantie", regio: "zuid", van: "2026-10-17", tot: "2026-10-25" },
  { schooljaar: "2026-2027", naam: "Kerstvakantie", regio: "noord", van: "2026-12-19", tot: "2027-01-03" },
  { schooljaar: "2026-2027", naam: "Kerstvakantie", regio: "midden", van: "2026-12-19", tot: "2027-01-03" },
  { schooljaar: "2026-2027", naam: "Kerstvakantie", regio: "zuid", van: "2026-12-19", tot: "2027-01-03" },
  { schooljaar: "2026-2027", naam: "Voorjaarsvakantie", regio: "noord", van: "2027-02-20", tot: "2027-02-28" },
  { schooljaar: "2026-2027", naam: "Voorjaarsvakantie", regio: "midden", van: "2027-02-20", tot: "2027-02-28" },
  { schooljaar: "2026-2027", naam: "Voorjaarsvakantie", regio: "zuid", van: "2027-02-13", tot: "2027-02-21" },
  { schooljaar: "2026-2027", naam: "Meivakantie", regio: "noord", van: "2027-04-24", tot: "2027-05-02" },
  { schooljaar: "2026-2027", naam: "Meivakantie", regio: "midden", van: "2027-04-24", tot: "2027-05-02" },
  { schooljaar: "2026-2027", naam: "Meivakantie", regio: "zuid", van: "2027-04-24", tot: "2027-05-02" },
  { schooljaar: "2026-2027", naam: "Zomervakantie", regio: "noord", van: "2027-07-10", tot: "2027-08-22" },
  { schooljaar: "2026-2027", naam: "Zomervakantie", regio: "midden", van: "2027-07-17", tot: "2027-08-29" },
  { schooljaar: "2026-2027", naam: "Zomervakantie", regio: "zuid", van: "2027-07-24", tot: "2027-09-05" },
  { schooljaar: "2027-2028", naam: "Herfstvakantie", regio: "noord", van: "2027-10-16", tot: "2027-10-24" },
  { schooljaar: "2027-2028", naam: "Herfstvakantie", regio: "midden", van: "2027-10-16", tot: "2027-10-24" },
  { schooljaar: "2027-2028", naam: "Herfstvakantie", regio: "zuid", van: "2027-10-23", tot: "2027-10-31" },
  { schooljaar: "2027-2028", naam: "Kerstvakantie", regio: "noord", van: "2027-12-25", tot: "2028-01-09" },
  { schooljaar: "2027-2028", naam: "Kerstvakantie", regio: "midden", van: "2027-12-25", tot: "2028-01-09" },
  { schooljaar: "2027-2028", naam: "Kerstvakantie", regio: "zuid", van: "2027-12-25", tot: "2028-01-09" },
  { schooljaar: "2027-2028", naam: "Voorjaarsvakantie", regio: "noord", van: "2028-02-19", tot: "2028-02-27" },
  { schooljaar: "2027-2028", naam: "Voorjaarsvakantie", regio: "midden", van: "2028-02-26", tot: "2028-03-05" },
  { schooljaar: "2027-2028", naam: "Voorjaarsvakantie", regio: "zuid", van: "2028-02-26", tot: "2028-03-05" },
  { schooljaar: "2027-2028", naam: "Meivakantie", regio: "noord", van: "2028-04-29", tot: "2028-05-07" },
  { schooljaar: "2027-2028", naam: "Meivakantie", regio: "midden", van: "2028-04-29", tot: "2028-05-07" },
  { schooljaar: "2027-2028", naam: "Meivakantie", regio: "zuid", van: "2028-04-29", tot: "2028-05-07" },
  { schooljaar: "2027-2028", naam: "Zomervakantie", regio: "noord", van: "2028-07-15", tot: "2028-08-27" },
  { schooljaar: "2027-2028", naam: "Zomervakantie", regio: "midden", van: "2028-07-08", tot: "2028-08-20" },
  { schooljaar: "2027-2028", naam: "Zomervakantie", regio: "zuid", van: "2028-07-22", tot: "2028-09-03" },
];
