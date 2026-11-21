import { maandagVan, minutenTussen, plusDagen } from "./datum";
import { perWeek, voorvallen } from "./herhaling";
import { uitvoerderVan, voorvallenInPeriode } from "./taken";
import { CATEGORIEEN, type Categorie, type Lid, type Staat, type Taak } from "./types";

/**
 * Zo rekent de app (een eigen schatting, geen wetenschappelijke meting):
 *
 * Denkwerk (het onzichtbare deel: eraan denken, plannen, afstemmen, bewaken)
 * - Elke keer dat een taak aan de beurt is, krijgt de eigenaar 1, 2 of 3 punten (licht, gemiddeld, zwaar),
 *   ook als iemand anders hem uitvoert, hij is overgeslagen of nog openstaat.
 * - Een afspraak die iemand regelt (brengen, halen, erbij zijn): 1 punt voor de regelaar.
 * - Iets opmerken en vastleggen (bij "Opgemerkt") of een losse taak aanmaken: 1 punt.
 *
 * Uitvoeren (het zichtbare deel): de minuten van afgevinkte taken, voor wie het deed,
 * plus de duur van afspraken die iemand regelt.
 */
export const PUNTEN_AFSPRAAK = 1;
export const PUNTEN_OPMERKEN = 1;

export interface Telling {
  denkwerk: number;
  uitvoerMin: number;
}

export interface OuderInzicht extends Telling {
  lid: Lid;
  /** Verdeling van de denkwerkpunten. */
  uitEigenaarschap: number;
  uitRegelen: number;
  uitOpmerken: number;
  takenGedaan: number;
  /** Taken van de ander die deze ouder uitvoerde. */
  overgenomen: number;
  /** Voorvallen van eigen taken die nog openstaan (tot en met gisteren). */
  blijvenLiggen: number;
  /** Deel van het totaal van de ouders (0 tot 1). */
  aandeelDenkwerk: number;
  aandeelUitvoeren: number;
}

export interface CategorieInzicht {
  categorie: Categorie;
  naam: string;
  /** Denkwerkpunten per ouder-id, plus "" voor zonder eigenaar. */
  punten: Record<string, number>;
}

export interface WeekInzicht {
  maandag: string;
  denkwerk: Record<string, number>;
  uitvoerMin: Record<string, number>;
}

export interface TaakBijdrage {
  taak: Taak;
  punten: number;
}

export interface Inzicht {
  van: string;
  tot: string;
  ouders: OuderInzicht[];
  zonderEigenaar: { punten: number; taken: Taak[] };
  kinderenMin: number;
  categorieen: CategorieInzicht[];
  weken: WeekInzicht[];
  /** Per ouder de taken die het meeste denkwerk vroegen in deze periode. */
  zwaarste: Record<string, TaakBijdrage[]>;
  /** Hoe de taken nu verdeeld zijn (los van wat er is afgevinkt), per week. */
  structureel: Record<string, Telling>;
  /** Of er genoeg is vastgelegd om iets te zeggen. */
  genoegGegevens: boolean;
}

function leeg(ids: string[]): Record<string, number> {
  return Object.fromEntries(ids.map((i) => [i, 0]));
}

/**
 * Inzicht over [van, tot]. Alleen wat tot en met 'vandaag' gebeurde telt mee:
 * toekomstige voorvallen zijn nog geen gedragen last.
 */
export function berekenInzicht(staat: Staat, van: string, tot: string, vandaag: string): Inzicht {
  const eind = tot < vandaag ? tot : vandaag;
  const ouders = staat.leden.filter((l) => l.rol === "ouder");
  const ouderIds = new Set(ouders.map((o) => o.id));
  const kindIds = new Set(staat.leden.filter((l) => l.rol === "kind").map((l) => l.id));
  const per = new Map(
    ouders.map((lid) => [
      lid.id,
      {
        lid,
        denkwerk: 0,
        uitvoerMin: 0,
        uitEigenaarschap: 0,
        uitRegelen: 0,
        uitOpmerken: 0,
        takenGedaan: 0,
        overgenomen: 0,
        blijvenLiggen: 0,
        aandeelDenkwerk: 0,
        aandeelUitvoeren: 0,
      } satisfies OuderInzicht,
    ]),
  );
  const ids = [...ouderIds, ""];
  const cat = new Map<Categorie, Record<string, number>>();
  const weken = new Map<string, WeekInzicht>();
  const bijdrage = new Map<string, Map<string, TaakBijdrage>>();
  let zonderPunten = 0;
  let kinderenMin = 0;

  const week = (datum: string) => {
    const m = maandagVan(datum);
    if (!weken.has(m)) weken.set(m, { maandag: m, denkwerk: leeg([...ouderIds]), uitvoerMin: leeg([...ouderIds]) });
    return weken.get(m)!;
  };
  for (let m = maandagVan(van); m <= eind; m = plusDagen(m, 7)) week(m);

  const denk = (lid: string | null, punten: number, datum: string, bron: "eigen" | "regelen" | "opmerken") => {
    if (!lid || !ouderIds.has(lid)) return false;
    const o = per.get(lid)!;
    o.denkwerk += punten;
    if (bron === "eigen") o.uitEigenaarschap += punten;
    if (bron === "regelen") o.uitRegelen += punten;
    if (bron === "opmerken") o.uitOpmerken += punten;
    week(datum).denkwerk[lid] += punten;
    return true;
  };
  const doe = (lid: string | null, min: number, datum: string) => {
    if (!lid) return;
    if (ouderIds.has(lid)) {
      per.get(lid)!.uitvoerMin += min;
      week(datum).uitvoerMin[lid] += min;
    } else if (kindIds.has(lid)) kinderenMin += min;
  };

  // Taken
  for (const v of voorvallenInPeriode(staat, van, eind, true)) {
    const eigenaar = v.voltooiing ? v.voltooiing.eigenaar : v.taak.eigenaar;
    const punten = v.voltooiing ? v.voltooiing.denkwerk : v.taak.denkwerk;
    if (v.taak.gearchiveerd && !v.voltooiing) continue;
    const geteld = denk(eigenaar, punten, v.datum, "eigen");
    if (!geteld) zonderPunten += punten;
    const c = cat.get(v.taak.categorie) ?? leeg(ids);
    c[geteld ? eigenaar! : ""] += punten;
    cat.set(v.taak.categorie, c);
    if (geteld) {
      const m = bijdrage.get(eigenaar!) ?? new Map();
      const b = m.get(v.taak.id) ?? { taak: v.taak, punten: 0 };
      b.punten += punten;
      m.set(v.taak.id, b);
      bijdrage.set(eigenaar!, m);
    }

    if (v.voltooiing?.status === "gedaan") {
      doe(v.voltooiing.gedaanDoor, v.voltooiing.duurMin, v.datum);
      const door = v.voltooiing.gedaanDoor;
      if (door && ouderIds.has(door)) {
        per.get(door)!.takenGedaan += 1;
        if (eigenaar && eigenaar !== door) per.get(door)!.overgenomen += 1;
      }
    } else if (!v.voltooiing && v.datum < vandaag && eigenaar && ouderIds.has(eigenaar)) {
      per.get(eigenaar)!.blijvenLiggen += 1;
    }
  }

  // Afspraken die iemand regelt
  for (const a of staat.afspraken) {
    if (!a.regelaar) continue;
    for (const datum of voorvallen(a.datum, a.herhaling, van, eind)) {
      denk(a.regelaar, PUNTEN_AFSPRAAK, datum, "regelen");
      const min = !a.heleDag && a.begin && a.eind ? minutenTussen(a.begin, a.eind) : 0;
      doe(a.regelaar, min, datum);
    }
  }

  // Opmerken: notities en nieuwe losse taken
  for (const o of staat.opgemerkt) {
    const d = o.op.slice(0, 10);
    if (d >= van && d <= eind) denk(o.door, PUNTEN_OPMERKEN, d, "opmerken");
  }
  for (const t of staat.taken) {
    const d = t.aangemaaktOp.slice(0, 10);
    if (t.herhaling.soort === "geen" && d >= van && d <= eind) denk(t.aangemaaktDoor, PUNTEN_OPMERKEN, d, "opmerken");
  }

  const lijst = [...per.values()];
  const totDenk = lijst.reduce((s, o) => s + o.denkwerk, 0);
  const totDoe = lijst.reduce((s, o) => s + o.uitvoerMin, 0);
  for (const o of lijst) {
    o.aandeelDenkwerk = totDenk ? o.denkwerk / totDenk : 0;
    o.aandeelUitvoeren = totDoe ? o.uitvoerMin / totDoe : 0;
  }

  const zwaarste: Record<string, TaakBijdrage[]> = {};
  for (const [lid, m] of bijdrage) zwaarste[lid] = [...m.values()].sort((a, b) => b.punten - a.punten).slice(0, 5);

  return {
    van,
    tot,
    ouders: lijst,
    zonderEigenaar: {
      punten: zonderPunten,
      taken: staat.taken.filter((t) => !t.gearchiveerd && !t.eigenaar),
    },
    kinderenMin,
    categorieen: (Object.keys(CATEGORIEEN) as Categorie[])
      .filter((c) => cat.has(c))
      .map((c) => ({ categorie: c, naam: CATEGORIEEN[c], punten: cat.get(c)! })),
    weken: [...weken.values()].sort((a, b) => a.maandag.localeCompare(b.maandag)),
    zwaarste,
    structureel: structureleVerdeling(staat),
    genoegGegevens: totDenk + totDoe > 0 && staat.voltooiingen.length >= 5,
  };
}

/**
 * Hoe de huidige takenlijst de last verdeelt, gemiddeld per week:
 * denkwerk naar de eigenaar, uitvoertijd naar de uitvoerder. "" = nog niet verdeeld.
 */
export function structureleVerdeling(staat: Staat): Record<string, Telling> {
  const uit: Record<string, Telling> = { "": { denkwerk: 0, uitvoerMin: 0 } };
  for (const l of staat.leden) uit[l.id] = { denkwerk: 0, uitvoerMin: 0 };
  for (const t of staat.taken) {
    if (t.gearchiveerd) continue;
    const f = perWeek(t.herhaling);
    if (!f) continue;
    (uit[t.eigenaar ?? ""] ?? uit[""]).denkwerk += f * t.denkwerk;
    const u = uitvoerderVan(t) ?? "";
    (uit[u] ?? uit[""]).uitvoerMin += f * t.duurMin;
  }
  return uit;
}

export interface Vergelijking {
  lid: Lid;
  /** Eigen inschatting van het eigen aandeel (0 tot 100), of null als nog niet ingevuld. */
  denkwerk: number | null;
  uitvoeren: number | null;
}

/** Inschattingen van de huidige ronde. Pas zichtbaar als beide ouders hebben ingevuld. */
export function inschattingenVanRonde(staat: Staat): { allemaal: boolean; per: Vergelijking[] } {
  const ouders = staat.leden.filter((l) => l.rol === "ouder");
  const per = ouders.map((lid) => {
    const i = staat.inschattingen.find((x) => x.door === lid.id && x.ronde === staat.ronde);
    return { lid, denkwerk: i?.denkwerk ?? null, uitvoeren: i?.uitvoeren ?? null };
  });
  return { allemaal: per.every((p) => p.denkwerk !== null), per };
}

/** Vragen om het gesprek te openen. Niet om te scoren, wel om elkaar te begrijpen. */
export const GESPREKSVRAGEN = [
  "Wat viel je op in de cijfers? Wat herken je, en wat niet?",
  "Welke taak zit het vaakst in je hoofd, ook als je er niet mee bezig bent?",
  "Welke taak zou je het liefst helemaal (van eraan denken tot uitvoeren) overdragen?",
  "Welke taak van de ander zie je eigenlijk nooit gebeuren?",
  "Waar wil je dat de ander je vertrouwt, zonder te controleren hoe je het doet?",
  "Wat is voor jullie 'goed genoeg' bij de taken waar je het over oneens bent?",
  "Wat ging de afgelopen tijd goed, en wil je zo houden?",
];
