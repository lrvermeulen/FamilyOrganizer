import { appItems, betreft, metRegelingen, overlapt, sorteer, type AgendaItem } from "./agenda";
import { maandagVan, plusDagen } from "./datum";
import { openVoorvallen, uitvoerderVan, type Voorval } from "./taken";
import type { Maaltijd, Staat } from "./types";
import { vakantieOp, type Vakantie } from "./vakanties";

/** Alles voor [van, tot] bij elkaar: afspraken uit de app, gekoppelde agenda's en ingeplande taken. */
export function alleItems(staat: Staat, extern: AgendaItem[], van: string, tot: string): AgendaItem[] {
  return sorteer([...appItems(staat, van, tot), ...metRegelingen(extern, staat)].filter((i) => i.datum >= van && i.datum <= tot));
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
  for (const v of taken) (takenPerLid[uitvoerderVan(v.taak) ?? ""] ?? takenPerLid[""]).push(v);
  return {
    datum,
    vakantie: vakantieOp(staat.regio, datum),
    maaltijd: staat.maaltijden.find((m) => m.datum === datum),
    perLid,
    taken,
    takenPerLid,
    openRitten: vanDag.filter((i) => brengHaalNodig(i, staat) && (!i.brengt || !i.haalt)),
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
  openRitten: AgendaItem[];
  botsingen: AgendaItem[];
  dagenZonderEten: string[];
  takenZonderEigenaar: number;
  inbox: number;
  vakanties: Vakantie[];
  /** Hele-dag-afspraken voor kinderen (studiedag, feest): opvang nodig? */
  bijzondereDagen: AgendaItem[];
}

export function weekstart(staat: Staat, items: AgendaItem[], maandag: string): Weekstart {
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
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
    openRitten: week.filter((i) => brengHaalNodig(i, staat) && (!i.brengt || !i.haalt)),
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
