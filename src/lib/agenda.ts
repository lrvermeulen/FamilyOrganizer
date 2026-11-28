import { keren } from "./afspraken";
import { minutenTussen } from "./datum";
import { ritIn } from "./leden";
import { voorvallen } from "./herhaling";
import { voorvallenInPeriode } from "./taken";
import type { Staat } from "./types";
import { vakantieOp } from "./vakanties";

/** Eén regel in de agenda, uit de app zelf of uit een agenda van buiten. */
export interface AgendaItem {
  sleutel: string;
  soort: "afspraak" | "taak" | "extern";
  titel: string;
  datum: string;
  heleDag: boolean;
  begin?: string;
  eind?: string;
  /** Voor wie (gezinsleden). */
  leden: string[];
  /** Wie het regelt (bij afspraken) of eigenaar/uitvoerder (bij taken). */
  regelaar?: string | null;
  locatie?: string;
  notitie?: string;
  /** Id van de afspraak of taak in de app, of van de externe agenda. */
  refId: string;
  gedaan?: boolean;
  bron?: string;
  /** Wie brengt en wie haalt (bij afspraken, ook uit gekoppelde agenda's). */
  brengt?: string | null;
  haalt?: string | null;
  /** Bij een afspraak uit een gekoppelde agenda: agenda-id|uid|datum, om brengen en halen aan te koppelen. */
  regelSleutel?: string;
  /** De afspraak is zelf een rit ("S&T naar school brengen"): alleen die rol telt. */
  rit?: "brengen" | "halen" | "beide";
  /** School of opvang: vervalt in vakanties en op studiedagen. */
  school?: boolean;
  /** Ophalen kan vanaf deze tijd tot het einde (BSO). */
  haalVan?: string;
  /** Bij een afspraak in de app: de oorspronkelijke dag van deze keer, en of hij bij een reeks hoort. */
  origineel?: string;
  reeks?: boolean;
}

/** Een hele-dag-afspraak die betekent dat er geen school is. */
const GEEN_SCHOOL_RE = /\b(studiedag|studiemiddag|margedag|vrije dag|(kinderen|leerlingen|iedereen|alle groepen|school)\s+(zijn|is)\s+vrij|vrij)\b/i;

/**
 * Is er op deze dag geen school voor deze kinderen? Bij een schoolvakantie (regio) of een studiedag
 * (een hele-dag-afspraak met "studiedag" of "vrij", voor deze kinderen of voor niemand in het bijzonder).
 */
export function geenSchool(staat: Staat, datum: string, leden: string[], anderen: AgendaItem[] = []): boolean {
  if (vakantieOp(staat.regio, datum)) return true;
  const kandidaten: { titel: string; leden: string[]; heleDag: boolean }[] = [
    ...staat.afspraken.filter((a) => !a.school).flatMap((a) => keren(a, datum, datum).map((k) => k.velden)),
    ...anderen.filter((i) => i.datum === datum && !i.school),
  ];
  const ouders = new Set(staat.leden.filter((l) => l.rol === "ouder").map((l) => l.id));
  return kandidaten.some(
    (k) =>
      k.heleDag &&
      GEEN_SCHOOL_RE.test(k.titel) &&
      // voor deze kinderen, of algemeen (geen leden, of alleen ouders: dan staat het in een gezinsagenda)
      (k.leden.length === 0 || k.leden.every((l) => ouders.has(l)) || k.leden.some((l) => leden.includes(l))),
  );
}

/** Welke rollen er bij een afspraak horen: allebei, of alleen de rit waar de afspraak over gaat. */
export function ritRollen(item: AgendaItem): ("brengt" | "haalt")[] {
  if (item.rit === "brengen") return ["brengt"];
  if (item.rit === "halen") return ["haalt"];
  return ["brengt", "haalt"];
}

/** Afspraken en (ingeplande) taken van de app binnen [van, tot]. */
export function appItems(staat: Staat, van: string, tot: string): AgendaItem[] {
  const uit: AgendaItem[] = [];
  for (const a of staat.afspraken) {
    for (const k of keren(a, van, tot)) {
      const v = k.velden;
      if (a.school && geenSchool(staat, k.datum, v.leden)) continue;
      uit.push({
        sleutel: `a-${a.id}-${k.origineel}`,
        soort: "afspraak",
        titel: v.titel,
        datum: k.datum,
        origineel: k.origineel,
        heleDag: v.heleDag,
        begin: v.heleDag ? undefined : v.begin,
        eind: v.heleDag ? undefined : v.eind,
        leden: v.leden,
        regelaar: v.regelaar,
        brengt: v.brengt,
        haalt: v.haalt,
        rit: !a.school && v.leden.some((l) => staat.leden.find((x) => x.id === l)?.rol === "kind") ? (ritIn(v.titel) ?? undefined) : undefined,
        school: a.school || undefined,
        haalVan: v.haalVan,
        locatie: v.locatie || undefined,
        notitie: v.notitie || undefined,
        refId: a.id,
        reeks: a.herhaling.soort !== "geen" || undefined,
      });
    }
  }
  for (const v of voorvallenInPeriode(staat, van, tot)) {
    const t = v.taak;
    if (!t.inAgenda && !t.tijd) continue;
    const begin = t.tijd;
    uit.push({
      sleutel: `t-${t.id}-${v.datum}`,
      soort: "taak",
      titel: t.titel,
      datum: v.datum,
      heleDag: !begin,
      begin,
      eind: begin ? eindNa(begin, Math.max(15, t.duurMin)) : undefined,
      leden: [...new Set([t.uitvoerder ?? t.eigenaar, ...t.voor].filter((x): x is string => !!x))],
      regelaar: t.uitvoerder ?? t.eigenaar,
      notitie: t.notitie || undefined,
      refId: t.id,
      gedaan: v.voltooiing?.status === "gedaan",
    });
  }
  return sorteer(uit);
}

export function eindNa(begin: string, min: number): string {
  const [u, m] = begin.split(":").map(Number);
  const tot = Math.min(23 * 60 + 59, u * 60 + m + min);
  return `${String(Math.floor(tot / 60)).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}`;
}

export function sorteer(items: AgendaItem[]): AgendaItem[] {
  return items.sort(
    (a, b) =>
      a.datum.localeCompare(b.datum) ||
      Number(b.heleDag) - Number(a.heleDag) ||
      (a.begin ?? "").localeCompare(b.begin ?? "") ||
      a.titel.localeCompare(b.titel),
  );
}

/** Gaat het item over dit gezinslid? */
export function betreft(item: AgendaItem, lid: string): boolean {
  return item.leden.includes(lid) || item.regelaar === lid || item.brengt === lid || item.haalt === lid;
}

/** Zet brengen en halen bij afspraken uit gekoppelde agenda's (die bewaart de app apart). */
export function metRegelingen(items: AgendaItem[], staat: Staat): AgendaItem[] {
  const r = new Map(staat.externRegelingen.map((x) => [x.sleutel, x]));
  return items.map((i) => {
    const x = i.regelSleutel ? r.get(i.regelSleutel) : undefined;
    // Wat in de app is vastgelegd, gaat voor; wat daar leeg is, blijft zoals de agenda het zegt.
    return x ? { ...i, brengt: x.brengt ?? i.brengt ?? null, haalt: x.haalt ?? i.haalt ?? null } : i;
  });
}

/** Twee items van dezelfde persoon die elkaar in de tijd overlappen. */
export function overlapt(a: AgendaItem, b: AgendaItem): boolean {
  if (a.datum !== b.datum || a.heleDag || b.heleDag || !a.begin || !b.begin) return false;
  const ae = a.eind ?? eindNa(a.begin, 60);
  const be = b.eind ?? eindNa(b.begin, 60);
  return a.begin < be && b.begin < ae && minutenTussen(a.begin, ae) > 0;
}
