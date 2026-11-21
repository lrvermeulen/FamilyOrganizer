import ICAL from "ical.js";
import { DateTime } from "luxon";
import type { AgendaItem } from "../agenda";
import { alsDatum, TIJDZONE } from "../datum";
import { herkenLeden } from "../leden";
import type { ExterneAgenda, Lid } from "../types";

const MAX_VOORVALLEN = 2000;
const MAX_DAGEN_PER_ITEM = 31;

interface Moment {
  datum: string;
  klok?: string;
}

function naarMoment(t: ICAL.Time): DateTime {
  // Zonder tijdzone ("floating") geldt de tijdzone van het gezin.
  if (t.isDate || t.zone === ICAL.Timezone.localTimezone) {
    return DateTime.fromObject(
      { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute },
      { zone: TIJDZONE },
    );
  }
  return DateTime.fromJSDate(t.toJSDate()).setZone(TIJDZONE);
}

function moment(t: ICAL.Time): Moment {
  const d = naarMoment(t);
  return t.isDate ? { datum: alsDatum(d) } : { datum: alsDatum(d), klok: d.toFormat("HH:mm") };
}

/**
 * Leest een iCal-bestand (bijvoorbeeld het geheime iCal-adres van Google Agenda of een gedeelde
 * iCloud-agenda) en geeft de items binnen [van, tot], met herhalingen uitgeschreven.
 */
export function leesIcs(tekst: string, agenda: ExterneAgenda, van: string, tot: string, leden: Lid[] = []): AgendaItem[] {
  const ouders = leden.filter((l) => l.rol === "ouder").map((l) => l.id);
  /**
   * Voor wie is een afspraak? Namen of letters in de titel ("S judo") gaan voor.
   * Anders: de eigenaar van de agenda, of bij een gezinsagenda de ouders.
   */
  const voorWie = (titel: string) => {
    if (agenda.alleenBezet) return { leden: agenda.lid ? [agenda.lid] : ouders, titel: "Bezet" };
    const h = herkenLeden(titel, leden);
    return { leden: h.leden.length ? h.leden : agenda.lid ? [agenda.lid] : ouders, titel: h.titel || titel };
  };
  const jcal = ICAL.parse(tekst);
  const kalender = new ICAL.Component(jcal);
  for (const tz of kalender.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      // Een kapotte tijdzone: dan maar via UTC.
    }
  }
  const vanaf = DateTime.fromISO(van, { zone: TIJDZONE }).startOf("day");
  const totEnMet = DateTime.fromISO(tot, { zone: TIJDZONE }).endOf("day");
  const uit: AgendaItem[] = [];
  const vevents = kalender.getAllSubcomponents("vevent");
  // Gewijzigde losse keren van een herhaalde afspraak (RECURRENCE-ID) apart bijhouden.
  const uitzonderingen = new Set<string>();
  for (const v of vevents) {
    if (v.hasProperty("recurrence-id")) {
      uitzonderingen.add(`${v.getFirstPropertyValue("uid")}|${String(v.getFirstPropertyValue("recurrence-id"))}`);
    }
  }

  const voegToe = (ev: ICAL.Event, start: ICAL.Time, eind: ICAL.Time | null, uid: string) => {
    const s = naarMoment(start);
    const e = eind ? naarMoment(eind) : s;
    if (e < vanaf || s > totEnMet) return;
    const heleDag = start.isDate;
    const begin = moment(start);
    const wie = voorWie(ev.summary || "(zonder titel)");
    const titel = wie.titel;
    // Een afspraak over meerdere dagen komt op elke dag (een hele dag: tot de einddatum, exclusief).
    const laatsteDag = heleDag ? e.minus({ days: 1 }) : e.minus({ milliseconds: 1 });
    let dagen = Math.max(0, Math.floor(laatsteDag.startOf("day").diff(s.startOf("day"), "days").days));
    dagen = Math.min(dagen, MAX_DAGEN_PER_ITEM);
    for (let i = 0; i <= dagen; i++) {
      const d = s.startOf("day").plus({ days: i });
      if (d < vanaf.startOf("day") || d > totEnMet) continue;
      const datum = alsDatum(d);
      const eersteDag = i === 0;
      const laatste = i === dagen;
      const meerdaags = dagen > 0;
      uit.push({
        sleutel: `x-${agenda.id}-${uid}-${start.toString()}-${i}`,
        soort: "extern",
        titel,
        datum,
        heleDag: heleDag || (meerdaags && !eersteDag && !laatste),
        begin: heleDag ? undefined : eersteDag ? begin.klok : meerdaags && !laatste ? undefined : "00:00",
        eind: heleDag ? undefined : laatste ? e.toFormat("HH:mm") : "23:59",
        leden: wie.leden,
        locatie: agenda.alleenBezet ? undefined : ev.location || undefined,
        refId: agenda.id,
        bron: agenda.naam,
        regelSleutel: `${agenda.id}|${uid}|${datum}`,
      });
    }
  };

  for (const v of vevents) {
    const ev = new ICAL.Event(v);
    const uid = ev.uid || Math.random().toString(36).slice(2);
    if (v.getFirstPropertyValue("status") === "CANCELLED") continue;
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      voegToe(ev, ev.startDate, ev.endDate, uid);
      continue;
    }
    const it = ev.iterator();
    for (let i = 0, t = it.next(); t && i < MAX_VOORVALLEN; i++, t = it.next()) {
      const m = naarMoment(t);
      if (m > totEnMet) break;
      if (uitzonderingen.has(`${uid}|${t.toString()}`)) continue;
      const details = ev.getOccurrenceDetails(t);
      if (naarMoment(details.endDate) < vanaf) continue;
      voegToe(details.item, details.startDate, details.endDate, uid);
    }
  }
  return uit;
}

const cache = new Map<string, { tot: number; tekst: string }>();
const CACHE_MS = 10 * 60_000;

/** Haal een iCal-adres op, met een korte cache. Alleen https, geen adressen binnen het eigen netwerk. */
export async function haalIcs(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  const nu = Date.now();
  const c = cache.get(url);
  if (c && c.tot > nu) return c.tekst;
  const adres = new URL(url.replace(/^webcal:\/\//i, "https://"));
  if (adres.protocol !== "https:") throw new Error("Alleen https-adressen");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|0\.)/i.test(adres.hostname)) {
    throw new Error("Dit adres is niet toegestaan");
  }
  const res = await fetcher(adres.toString(), {
    headers: { Accept: "text/calendar" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`De agenda gaf fout ${res.status}`);
  const tekst = await res.text();
  if (tekst.length > 5_000_000) throw new Error("De agenda is te groot");
  if (!tekst.includes("BEGIN:VCALENDAR")) throw new Error("Dit is geen iCal-agenda");
  cache.set(url, { tot: nu + CACHE_MS, tekst });
  return tekst;
}

export function wisCache() {
  cache.clear();
}
