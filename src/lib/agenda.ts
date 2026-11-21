import { minutenTussen } from "./datum";
import { voorvallen } from "./herhaling";
import { voorvallenInPeriode } from "./taken";
import type { Staat } from "./types";

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
}

/** Afspraken en (ingeplande) taken van de app binnen [van, tot]. */
export function appItems(staat: Staat, van: string, tot: string): AgendaItem[] {
  const uit: AgendaItem[] = [];
  for (const a of staat.afspraken) {
    for (const datum of voorvallen(a.datum, a.herhaling, van, tot)) {
      uit.push({
        sleutel: `a-${a.id}-${datum}`,
        soort: "afspraak",
        titel: a.titel,
        datum,
        heleDag: a.heleDag,
        begin: a.heleDag ? undefined : a.begin,
        eind: a.heleDag ? undefined : a.eind,
        leden: a.leden,
        regelaar: a.regelaar,
        brengt: a.brengt,
        haalt: a.haalt,
        locatie: a.locatie || undefined,
        notitie: a.notitie || undefined,
        refId: a.id,
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
    return x ? { ...i, brengt: x.brengt, haalt: x.haalt } : i;
  });
}

/** Twee items van dezelfde persoon die elkaar in de tijd overlappen. */
export function overlapt(a: AgendaItem, b: AgendaItem): boolean {
  if (a.datum !== b.datum || a.heleDag || b.heleDag || !a.begin || !b.begin) return false;
  const ae = a.eind ?? eindNa(a.begin, 60);
  const be = b.eind ?? eindNa(b.begin, 60);
  return a.begin < be && b.begin < ae && minutenTussen(a.begin, ae) > 0;
}
