import { appItems, betreft, geenSchool, metRegelingen, overlapt, ritRollen, sorteer, type AgendaItem } from "./agenda";
import { maandagVan, plusDagen } from "./datum";
import { openVoorvallen, uitvoerderVanKeer, type Voorval } from "./taken";
import type { Maaltijd, Staat } from "./types";
import { vakantieOp, type Vakantie } from "./vakanties";

/** Alles voor [van, tot] bij elkaar: afspraken uit de app, gekoppelde agenda's en ingeplande taken. */
export function alleItems(staat: Staat, extern: AgendaItem[], van: string, tot: string): AgendaItem[] {
  const ext = metRegelingen(extern, staat);
  // Studiedagen uit gekoppelde agenda's (bijvoorbeeld Social Schools) laten school ook vervallen.
  const app = appItems(staat, van, tot).filter((i) => !i.school || !geenSchool(staat, i.datum, i.leden, ext));
  return sorteer([...app, ...ext].filter((i) => i.datum >= van && i.datum <= tot));
}

/** Staat er bij een afspraak nog een rol open (brengen of halen) die ertoe doet? */
export function ritOpen(item: AgendaItem, staat: Staat): boolean {
  return brengHaalNodig(item, staat) && ritRollen(item).some((r) => !item[r]);
}

/** Moet er iemand brengen en halen? Bij een afspraak met tijd voor een kind. */
export function brengHaalNodig(item: AgendaItem, staat: Staat): boolean {
  if (item.soort === "taak" || item.heleDag || !item.begin) return false;
  return item.leden.some((l) => staat.leden.find((x) => x.id === l)?.rol === "kind");
}

/**
 * Taken voor op het bord: wat niet elke dag terugkomt (dagelijkse routines staan alleen in de takenlijst).
 * Op vandaag ook wat is blijven liggen.
 */
export function bordTaken(staat: Staat, datum: string, vandaag: string): Voorval[] {
  const lijst = openVoorvallen(staat, vandaag, datum > vandaag ? datum : vandaag);
  return lijst.filter(
    (v) => v.taak.herhaling.soort !== "dagelijks" && (v.datum === datum || (datum === vandaag && v.datum < vandaag)),
  );
}

export interface BordDag {
  datum: string;
  vakantie?: Vakantie;
  maaltijd?: Maaltijd;
  /** Afspraken per gezinslid; een afspraak voor meerdere leden staat bij ieder van hen. */
  perLid: Record<string, AgendaItem[]>;
  taken: Voorval[];
  /** Taken per gezinslid (wie het uitvoert); "" = nog niet verdeeld. */
  takenPerLid: Record<string, Voorval[]>;
  /** Afspraken waar nog niemand brengt of haalt. */
  openRitten: AgendaItem[];
  botsingen: Set<string>;
}

export function bordDag(staat: Staat, items: AgendaItem[], datum: string, vandaag: string): BordDag {
  const vanDag = items.filter((i) => i.datum === datum && i.soort !== "taak");
  const perLid: Record<string, AgendaItem[]> = Object.fromEntries(staat.leden.map((l) => [l.id, []]));
  for (const i of vanDag) for (const l of staat.leden) if (i.leden.includes(l.id)) perLid[l.id].push(i);
  const taken = bordTaken(staat, datum, vandaag);
  const takenPerLid: Record<string, Voorval[]> = { "": [], ...Object.fromEntries(staat.leden.map((l) => [l.id, []])) };
  for (const v of taken) (takenPerLid[uitvoerderVanKeer(staat, v) ?? ""] ?? takenPerLid[""]).push(v);
  return {
    datum,
    vakantie: vakantieOp(staat.regio, datum),
    maaltijd: staat.maaltijden.find((m) => m.datum === datum),
    perLid,
    taken,
    takenPerLid,
    openRitten: vanDag.filter((i) => ritOpen(i, staat)),
    botsingen: botsingen(vanDag),
  };
}

/** Twee dingen tegelijk voor hetzelfde gezinslid (een kind, of de ouder die brengt, haalt of regelt). */
export function botsingen(items: AgendaItem[]): Set<string> {
  const uit = new Set<string>();
  const wie = (i: AgendaItem) => new Set([...i.leden, i.regelaar, i.brengt, i.haalt].filter((x): x is string => !!x));
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      if (items[a].datum !== items[b].datum) continue;
      const wa = wie(items[a]);
      if ([...wie(items[b])].some((x) => wa.has(x)) && overlapt(items[a], items[b])) {
        uit.add(items[a].sleutel);
        uit.add(items[b].sleutel);
      }
    }
  }
  return uit;
}

/** De week die je bij de weekstart doorloopt: vanaf vrijdag de volgende week, anders deze. */
export function weekVoorWeekstart(vandaag: string): string {
  const m = maandagVan(vandaag);
  const dagInWeek = Math.round((Date.parse(vandaag) - Date.parse(m)) / 86_400_000);
  return dagInWeek >= 4 ? plusDagen(m, 7) : m;
}

export interface Weekstart {
  maandag: string;
  /** Wat deze week af moet en geen routine is: losse taken, deadlines en taken die zelden terugkomen. */
  teDoen: Voorval[];
  openRitten: AgendaItem[];
  botsingen: AgendaItem[];
  dagenZonderEten: string[];
  takenZonderEigenaar: number;
  inbox: number;
  vakanties: Vakantie[];
  /** Hele-dag-afspraken voor kinderen (studiedag, feest): opvang nodig? */
  bijzondereDagen: AgendaItem[];
}

/** Komt een taak zo vaak terug dat hij vanzelf loopt (elke dag of elke week)? */
export function isRoutine(v: Voorval): boolean {
  const h = v.taak.herhaling;
  return h.soort === "dagelijks" || (h.soort === "wekelijks" && h.interval === 1);
}

export function weekstart(staat: Staat, items: AgendaItem[], maandag: string, vandaag: string = maandag): Weekstart {
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  const teDoen = openVoorvallen(staat, vandaag < maandag ? vandaag : maandag, dagen[6]).filter(
    (v) => !isRoutine(v) && v.datum <= dagen[6] && (v.datum >= maandag || v.taak.herhaling.soort === "geen" || v.datum >= vandaag),
  );
  const week = items.filter((i) => i.datum >= maandag && i.datum <= dagen[6] && i.soort !== "taak");
  const bots = botsingen(week);
  const kind = (id: string) => staat.leden.find((l) => l.id === id)?.rol === "kind";
  const vak = new Map<string, Vakantie>();
  for (const d of dagen) {
    const v = vakantieOp(staat.regio, d);
    if (v) vak.set(`${v.naam}-${v.van}`, v);
  }
  return {
    maandag,
    teDoen,
    openRitten: week.filter((i) => ritOpen(i, staat)),
    botsingen: week.filter((i) => bots.has(i.sleutel)),
    dagenZonderEten: dagen.filter((d) => !staat.maaltijden.some((m) => m.datum === d && m.wat)),
    takenZonderEigenaar: staat.taken.filter((t) => !t.gearchiveerd && !t.eigenaar).length,
    inbox: staat.opgemerkt.filter((o) => !o.afgehandeld).length,
    vakanties: [...vak.values()],
    bijzondereDagen: week.filter((i) => i.heleDag && i.leden.some(kind)),
  };
}

/** Wie er die dag iets heeft: voor de briefing. */
export function vanLid(items: AgendaItem[], lid: string): AgendaItem[] {
  return items.filter((i) => betreft(i, lid));
}
