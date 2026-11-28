import { plusDagen } from "./datum";
import { voorvallen } from "./herhaling";
import type { Afspraak, AfspraakVelden, Herhaling, Staat } from "./types";

/** Wat je aanpast bij een herhalende afspraak: alleen deze keer, deze en de volgende, of de hele reeks. */
export type Bereik = "deze" | "volgende" | "reeks";

export function veldenVan(a: Afspraak): AfspraakVelden {
  return {
    titel: a.titel,
    heleDag: a.heleDag,
    begin: a.begin,
    eind: a.eind,
    leden: a.leden,
    regelaar: a.regelaar,
    brengt: a.brengt,
    haalt: a.haalt,
    haalVan: a.haalVan,
    locatie: a.locatie,
    notitie: a.notitie,
  };
}

/** Eén keer van een afspraak, met de afwijkingen van die keer erin verwerkt. */
export interface Keer {
  afspraak: Afspraak;
  /** De oorspronkelijke dag (zo herken je deze keer). */
  origineel: string;
  /** De dag waarop hij nu staat (anders als hij verzet is). */
  datum: string;
  velden: AfspraakVelden;
  /** Deze keer wijkt af van de reeks. */
  afwijkend: boolean;
}

/** De keren van een afspraak die (na verzetten) binnen [van, tot] vallen. Vervallen keren tellen niet mee. */
export function keren(a: Afspraak, van: string, tot: string): Keer[] {
  const afw = new Map(a.afwijkingen.map((x) => [x.datum, x]));
  const basis = veldenVan(a);
  const uit: Keer[] = [];
  for (const datum of voorvallen(a.datum, a.herhaling, van, tot)) {
    const x = afw.get(datum);
    if (x?.vervalt) continue;
    if (x?.naar && x.naar !== datum) continue; // staat op een andere dag, zie hieronder
    uit.push({ afspraak: a, origineel: datum, datum, velden: x?.velden ?? basis, afwijkend: !!x });
  }
  // Keren die vanaf een andere dag naar deze periode zijn verzet.
  for (const x of a.afwijkingen) {
    if (x.vervalt || !x.naar || x.naar === x.datum || x.naar < van || x.naar > tot) continue;
    if (!voorvallen(a.datum, a.herhaling, x.datum, x.datum).length) continue; // die keer bestaat (niet meer)
    uit.push({ afspraak: a, origineel: x.datum, datum: x.naar, velden: x.velden ?? basis, afwijkend: true });
  }
  return uit.sort((p, q) => p.datum.localeCompare(q.datum));
}

/** Eén keer opzoeken op zijn oorspronkelijke dag (ook als hij verzet is). */
export function keerOp(a: Afspraak, origineel: string): Keer | null {
  const x = a.afwijkingen.find((w) => w.datum === origineel);
  if (x?.vervalt) return null;
  if (!voorvallen(a.datum, a.herhaling, origineel, origineel).length) return null;
  return { afspraak: a, origineel, datum: x?.naar ?? origineel, velden: x?.velden ?? veldenVan(a), afwijkend: !!x };
}

function herhaalt(a: Afspraak) {
  return a.herhaling.soort !== "geen";
}

export interface Nieuw {
  velden: AfspraakVelden;
  /** De (nieuwe) dag van deze keer, of bij een losse afspraak de datum. */
  datum: string;
  herhaling?: Herhaling;
  school?: boolean;
}

/**
 * Een afspraak aanpassen. Bij een herhalende afspraak:
 * - "deze": alleen deze keer (een afwijking, eventueel verzet naar een andere dag);
 * - "volgende": de reeks stopt de dag ervoor, en vanaf deze keer begint een nieuwe reeks;
 * - "reeks": de hele reeks (de begindatum blijft, eerder aangepaste keren blijven zoals ze waren).
 * Past `staat` aan en geeft de id van de afspraak die deze keer nu bevat.
 */
export function wijzigAfspraak(staat: Staat, a: Afspraak, origineel: string, bereik: Bereik, nieuw: Nieuw, nieuwId: () => string): string {
  const herhaling = nieuw.herhaling ?? a.herhaling;
  if (!herhaalt(a) || bereik === "reeks" || (bereik === "volgende" && origineel <= a.datum)) {
    Object.assign(a, nieuw.velden);
    if (nieuw.school !== undefined) a.school = nieuw.school;
    if (!herhaalt(a)) a.datum = nieuw.datum;
    a.herhaling = herhaling;
    if (herhaling.soort === "geen") a.afwijkingen = [];
    return a.id;
  }
  if (bereik === "deze") {
    a.afwijkingen = a.afwijkingen.filter((x) => x.datum !== origineel);
    a.afwijkingen.push({ datum: origineel, vervalt: false, naar: nieuw.datum !== origineel ? nieuw.datum : undefined, velden: nieuw.velden });
    return a.id;
  }
  // Deze en de volgende: knippen.
  const oudeTot = a.herhaling.tot;
  const vanaf = a.afwijkingen.filter((x) => x.datum >= origineel);
  a.afwijkingen = a.afwijkingen.filter((x) => x.datum < origineel);
  a.herhaling = { ...a.herhaling, tot: plusDagen(origineel, -1) };
  const kopie: Afspraak = {
    ...a,
    ...nieuw.velden,
    id: nieuwId(),
    datum: nieuw.datum,
    school: nieuw.school ?? a.school,
    herhaling: { ...herhaling, tot: herhaling.tot ?? oudeTot },
    afwijkingen: vanaf,
  };
  staat.afspraken.push(kopie);
  return kopie.id;
}

/** Een afspraak verwijderen: alleen deze keer, deze en de volgende, of de hele reeks. */
export function verwijderAfspraak(staat: Staat, a: Afspraak, origineel: string | undefined, bereik: Bereik): void {
  if (!herhaalt(a) || bereik === "reeks" || !origineel || (bereik === "volgende" && origineel <= a.datum)) {
    staat.afspraken = staat.afspraken.filter((x) => x.id !== a.id);
    return;
  }
  if (bereik === "deze") {
    a.afwijkingen = a.afwijkingen.filter((x) => x.datum !== origineel);
    a.afwijkingen.push({ datum: origineel, vervalt: true });
    return;
  }
  a.herhaling = { ...a.herhaling, tot: plusDagen(origineel, -1) };
  a.afwijkingen = a.afwijkingen.filter((x) => x.datum < origineel);
}

/**
 * Een wijziging die maar voor een deel van de kinderen geldt ("Tobias brengt Roos, Stijn blijft bij Lau"):
 * de afspraak wordt gesplitst. De anderen blijven in de bestaande afspraak; voor de gekozen kinderen
 * komt er een eigen afspraak, met hetzelfde bereik (deze keer, deze en volgende, of de hele reeks).
 */
export function splitsAfspraak(
  staat: Staat,
  a: Afspraak,
  origineel: string,
  bereik: Bereik,
  voor: string[],
  wijziging: Partial<AfspraakVelden>,
  nieuwId: () => string,
): void {
  const keer = keerOp(a, origineel) ?? { velden: veldenVan(a), datum: origineel };
  const rest = keer.velden.leden.filter((l) => !voor.includes(l));
  const gekozen = keer.velden.leden.filter((l) => voor.includes(l));
  if (!rest.length || !gekozen.length) {
    wijzigAfspraak(staat, a, origineel, bereik, { velden: { ...keer.velden, ...wijziging }, datum: keer.datum }, nieuwId);
    return;
  }
  const oudeHerhaling = a.herhaling;
  const begin = a.datum;
  wijzigAfspraak(staat, a, origineel, bereik, { velden: { ...keer.velden, leden: rest }, datum: keer.datum }, nieuwId);
  const eigen = { ...keer.velden, ...wijziging, leden: gekozen };
  const los = !herhaalt(a) && oudeHerhaling.soort === "geen";
  staat.afspraken.push({
    ...a,
    ...eigen,
    id: nieuwId(),
    datum: bereik === "reeks" && !los ? begin : keer.datum,
    herhaling: bereik === "deze" || los ? { soort: "geen", interval: 1, dagen: [] } : oudeHerhaling,
    afwijkingen: [],
  });
}
