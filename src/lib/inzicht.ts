import { keren } from "./afspraken";
import { geenSchool } from "./agenda";
import { dagenTussen, maandagVan, minutenTussen, plusDagen } from "./datum";
import { perWeek, voorvallen } from "./herhaling";
import { uitvoerderVan, voorvallenInPeriode } from "./taken";
import { CATEGORIEEN, type Antwoord, type Categorie, type Lid, type Staat, type Taak } from "./types";

/**
 * Zo rekent de app (een eigen schatting, geen wetenschappelijke meting):
 *
 * Onzichtbaar werk, in punten. Elke taak is vooral denkwerk (bedenken, plannen, onthouden, bewaken)
 * of vooral emotioneel werk (aandacht en zorg, merken hoe het met iemand gaat).
 * - Elke keer dat een taak aan de beurt is, krijgt de eigenaar 1, 2 of 3 punten (licht, gemiddeld, zwaar),
 *   ook als iemand anders hem uitvoert, hij is overgeslagen of nog openstaat.
 * - Een doorlopende verantwoordelijkheid (zonder vaste momenten) telt zo vaak als ingesteld per week.
 * - Een afspraak regelen: 1 punt denkwerk voor de regelaar.
 * - Iets opmerken en vastleggen (inbox) of een losse taak aanmaken: 1 punt denkwerk.
 *
 * Uitvoeren (het zichtbare deel), in minuten:
 * - afgevinkte taken, voor wie het deed;
 * - brengen en halen: 20 minuten per keer, ook bij afspraken uit gekoppelde agenda's;
 * - een afspraak die iemand regelt zonder dat er iemand brengt of haalt: de duur (erbij zijn).
 */
export const PUNTEN_AFSPRAAK = 1;
export const PUNTEN_OPMERKEN = 1;
export const REIS_MIN = 20;

export interface Telling {
  denkwerk: number;
  emotioneel: number;
  uitvoerMin: number;
}

export interface OuderInzicht extends Telling {
  lid: Lid;
  /** Verdeling van de denkwerkpunten. */
  uitEigenaarschap: number;
  uitRegelen: number;
  uitOpmerken: number;
  takenGedaan: number;
  /** Keren brengen of halen. */
  ritten: number;
  /** Taken van de ander die deze ouder uitvoerde. */
  overgenomen: number;
  /** Voorvallen van eigen taken die nog openstaan (tot en met gisteren). */
  blijvenLiggen: number;
  /** Deel van het totaal van de ouders (0 tot 1). */
  aandeelDenkwerk: number;
  aandeelEmotioneel: number;
  aandeelUitvoeren: number;
}

export interface CategorieInzicht {
  categorie: Categorie;
  naam: string;
  /** Punten (denkwerk + emotioneel) per ouder-id, plus "" voor zonder eigenaar. */
  punten: Record<string, number>;
}

export interface WeekInzicht {
  maandag: string;
  denkwerk: Record<string, number>;
  emotioneel: Record<string, number>;
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
  /** Per ouder de taken die het meeste onzichtbare werk vroegen in deze periode. */
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
        emotioneel: 0,
        uitvoerMin: 0,
        uitEigenaarschap: 0,
        uitRegelen: 0,
        uitOpmerken: 0,
        takenGedaan: 0,
        ritten: 0,
        overgenomen: 0,
        blijvenLiggen: 0,
        aandeelDenkwerk: 0,
        aandeelEmotioneel: 0,
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
    if (!weken.has(m)) {
      weken.set(m, { maandag: m, denkwerk: leeg([...ouderIds]), emotioneel: leeg([...ouderIds]), uitvoerMin: leeg([...ouderIds]) });
    }
    return weken.get(m)!;
  };
  for (let m = maandagVan(van); m <= eind; m = plusDagen(m, 7)) week(m);

  /** Onzichtbaar werk toekennen. Geeft false als het niet bij een ouder hoort. */
  const onzichtbaar = (
    lid: string | null,
    punten: number,
    datum: string,
    soort: "denkwerk" | "emotioneel",
    bron: "eigen" | "regelen" | "opmerken",
  ) => {
    if (!lid || !ouderIds.has(lid)) return false;
    const o = per.get(lid)!;
    o[soort] += punten;
    if (bron === "eigen") o.uitEigenaarschap += punten;
    if (bron === "regelen") o.uitRegelen += punten;
    if (bron === "opmerken") o.uitOpmerken += punten;
    week(datum)[soort][lid] += punten;
    return true;
  };
  const doe = (lid: string | null, min: number, datum: string) => {
    if (!lid) return;
    if (ouderIds.has(lid)) {
      per.get(lid)!.uitvoerMin += min;
      week(datum).uitvoerMin[lid] += min;
    } else if (kindIds.has(lid)) kinderenMin += min;
  };
  const telTaak = (taak: Taak, eigenaar: string | null, punten: number, datum: string) => {
    const geteld = onzichtbaar(eigenaar, punten, datum, taak.werksoort, "eigen");
    if (!geteld) zonderPunten += punten;
    const c = cat.get(taak.categorie) ?? leeg(ids);
    c[geteld ? eigenaar! : ""] += punten;
    cat.set(taak.categorie, c);
    if (geteld) {
      const m = bijdrage.get(eigenaar!) ?? new Map();
      const b = m.get(taak.id) ?? { taak, punten: 0 };
      b.punten += punten;
      m.set(taak.id, b);
      bijdrage.set(eigenaar!, m);
    }
  };

  // Taken met vaste momenten
  for (const v of voorvallenInPeriode(staat, van, eind, true)) {
    if (v.taak.gearchiveerd && !v.voltooiing) continue;
    const eigenaar = v.voltooiing ? v.voltooiing.eigenaar : v.taak.eigenaar;
    telTaak(v.taak, eigenaar, v.voltooiing ? v.voltooiing.denkwerk : v.taak.denkwerk, v.datum);

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

  // Doorlopende verantwoordelijkheden: zo vaak per week als ingesteld, verdeeld over de weken.
  for (const t of staat.taken) {
    if (t.gearchiveerd || t.herhaling.soort !== "doorlopend") continue;
    const begin = t.start > van ? t.start : van;
    if (begin > eind) continue;
    for (let m = maandagVan(begin); m <= eind; m = plusDagen(m, 7)) {
      const a = m < begin ? begin : m;
      const z = plusDagen(m, 6) > eind ? eind : plusDagen(m, 6);
      const dagen = dagenTussen(a, z) + 1;
      if (dagen <= 0) continue;
      telTaak(t, t.eigenaar, (t.herhaling.interval * t.denkwerk * dagen) / 7, a);
    }
  }

  // Afspraken in de app: regelen, brengen, halen
  for (const a of staat.afspraken) {
    for (const k of keren(a, van, eind)) {
      const datum = k.datum;
      const v = k.velden;
      if (a.school && geenSchool(staat, datum, v.leden)) continue; // vakantie of studiedag
      if (v.regelaar) onzichtbaar(v.regelaar, PUNTEN_AFSPRAAK, datum, "denkwerk", "regelen");
      if (v.brengt || v.haalt) {
        for (const r of [v.brengt, v.haalt]) {
          doe(r, REIS_MIN, datum);
          if (r && ouderIds.has(r)) per.get(r)!.ritten += 1;
        }
      } else if (v.regelaar) {
        doe(v.regelaar, !v.heleDag && v.begin && v.eind ? minutenTussen(v.begin, v.eind) : 0, datum);
      }
    }
  }
  // Brengen en halen bij afspraken uit gekoppelde agenda's
  for (const r of staat.externRegelingen) {
    if (r.datum < van || r.datum > eind) continue;
    for (const wie of [r.brengt, r.haalt]) {
      doe(wie, REIS_MIN, r.datum);
      if (wie && ouderIds.has(wie)) per.get(wie)!.ritten += 1;
    }
  }

  // Opmerken: inbox en nieuwe losse taken
  for (const o of staat.opgemerkt) {
    const d = o.op.slice(0, 10);
    if (d >= van && d <= eind) onzichtbaar(o.door, PUNTEN_OPMERKEN, d, "denkwerk", "opmerken");
  }
  for (const t of staat.taken) {
    const d = t.aangemaaktOp.slice(0, 10);
    if (t.herhaling.soort === "geen" && d >= van && d <= eind) onzichtbaar(t.aangemaaktDoor, PUNTEN_OPMERKEN, d, "denkwerk", "opmerken");
  }

  const lijst = [...per.values()];
  const som = (k: keyof Telling) => lijst.reduce((s, o) => s + o[k], 0);
  const [totDenk, totEmo, totDoe] = [som("denkwerk"), som("emotioneel"), som("uitvoerMin")];
  for (const o of lijst) {
    o.aandeelDenkwerk = totDenk ? o.denkwerk / totDenk : 0;
    o.aandeelEmotioneel = totEmo ? o.emotioneel / totEmo : 0;
    o.aandeelUitvoeren = totDoe ? o.uitvoerMin / totDoe : 0;
    o.denkwerk = Math.round(o.denkwerk * 10) / 10;
    o.emotioneel = Math.round(o.emotioneel * 10) / 10;
  }

  const zwaarste: Record<string, TaakBijdrage[]> = {};
  for (const [lid, m] of bijdrage) {
    zwaarste[lid] = [...m.values()]
      .map((b) => ({ ...b, punten: Math.round(b.punten) }))
      .sort((a, b) => b.punten - a.punten)
      .slice(0, 5);
  }

  return {
    van,
    tot,
    ouders: lijst,
    zonderEigenaar: {
      punten: Math.round(zonderPunten),
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
 * onzichtbaar werk naar de eigenaar, uitvoertijd naar de uitvoerder. "" = nog niet verdeeld.
 * Doorlopende verantwoordelijkheden tellen alleen als onzichtbaar werk.
 */
export function structureleVerdeling(staat: Staat): Record<string, Telling> {
  const uit: Record<string, Telling> = { "": { denkwerk: 0, emotioneel: 0, uitvoerMin: 0 } };
  for (const l of staat.leden) uit[l.id] = { denkwerk: 0, emotioneel: 0, uitvoerMin: 0 };
  for (const t of staat.taken) {
    if (t.gearchiveerd) continue;
    const f = perWeek(t.herhaling);
    if (!f) continue;
    (uit[t.eigenaar ?? ""] ?? uit[""])[t.werksoort] += f * t.denkwerk;
    if (t.herhaling.soort === "doorlopend") continue;
    const u = uitvoerderVan(t) ?? "";
    (uit[u] ?? uit[""]).uitvoerMin += f * t.duurMin;
  }
  return uit;
}

export interface Vergelijking {
  lid: Lid;
  /** Eigen inschatting van het eigen aandeel (0 tot 100), of null als nog niet ingevuld. */
  denkwerk: number | null;
  emotioneel: number | null;
  uitvoeren: number | null;
}

/** Inschattingen van de huidige ronde. Pas zichtbaar als beide ouders hebben ingevuld. */
export function inschattingenVanRonde(staat: Staat): { allemaal: boolean; per: Vergelijking[] } {
  const ouders = staat.leden.filter((l) => l.rol === "ouder");
  const per = ouders.map((lid) => {
    const i = staat.inschattingen.find((x) => x.door === lid.id && x.ronde === staat.ronde);
    return { lid, denkwerk: i?.denkwerk ?? null, emotioneel: i?.emotioneel ?? null, uitvoeren: i?.uitvoeren ?? null };
  });
  return { allemaal: per.every((p) => p.denkwerk !== null), per };
}

/** De taken voor de kaartjesronde: alles wat vaker terugkomt, met het meeste onzichtbare werk eerst. */
export function kaartjes(staat: Staat): Taak[] {
  return staat.taken
    .filter((t) => !t.gearchiveerd && t.herhaling.soort !== "geen")
    .sort((a, b) => b.denkwerk * perWeek(b.herhaling) - a.denkwerk * perWeek(a.herhaling) || a.titel.localeCompare(b.titel));
}

/** Het antwoord omgezet naar wie het volgens die ouder in het hoofd heeft: een ouder-id, "samen", of null. */
export function wieVolgens(antwoord: Antwoord, door: string, ander: string | undefined): string | null {
  if (antwoord === "ik") return door;
  if (antwoord === "ander") return ander ?? null;
  if (antwoord === "samen") return "samen";
  return null;
}

/**
 * Het eigen aandeel (0 tot 100) volgens de kaartjes van één ouder, voor denkwerk en emotioneel werk.
 * Gewogen naar hoe vaak en hoe zwaar een taak is. Samen = de helft. Weet niet en niet relevant tellen niet.
 */
export function aandeelUitKaartjes(staat: Staat, door: string): { denkwerk: number | null; emotioneel: number | null } {
  const antwoorden = new Map(staat.percepties.filter((p) => p.door === door && p.ronde === staat.ronde).map((p) => [p.taakId, p.antwoord]));
  const tel = { denkwerk: [0, 0], emotioneel: [0, 0] };
  for (const t of kaartjes(staat)) {
    const a = antwoorden.get(t.id);
    if (!a || a === "nvt" || a === "weetniet") continue;
    const gewicht = t.denkwerk * perWeek(t.herhaling);
    tel[t.werksoort][1] += gewicht;
    tel[t.werksoort][0] += a === "ik" ? gewicht : a === "samen" ? gewicht / 2 : 0;
  }
  const pct = ([eigen, totaal]: number[]) => (totaal ? Math.round((eigen / totaal) * 100) : null);
  return { denkwerk: pct(tel.denkwerk), emotioneel: pct(tel.emotioneel) };
}

export interface Verschil {
  taak: Taak;
  /** Per ouder: wie het volgens die ouder in het hoofd heeft (ouder-id, "samen" of null). */
  volgens: Record<string, string | null>;
  /** Wie de app nu als eigenaar heeft. */
  eigenaar: string | null;
}

/**
 * Taken waar de ouders het verschillend zien. Alleen te gebruiken als beide ouders klaar zijn
 * (anders zou je de antwoorden van de ander zien).
 */
export function verschillen(staat: Staat): { verschillen: Verschil[]; gelijk: number } {
  const ouders = staat.leden.filter((l) => l.rol === "ouder");
  if (ouders.length !== 2) return { verschillen: [], gelijk: 0 };
  const [a, b] = ouders;
  const antwoord = (door: string, taakId: string) =>
    staat.percepties.find((p) => p.door === door && p.ronde === staat.ronde && p.taakId === taakId)?.antwoord;
  const uit: Verschil[] = [];
  let gelijk = 0;
  for (const t of kaartjes(staat)) {
    const x = antwoord(a.id, t.id);
    const y = antwoord(b.id, t.id);
    if (!x || !y || x === "nvt" || y === "nvt") continue;
    const wa = wieVolgens(x, a.id, b.id);
    const wb = wieVolgens(y, b.id, a.id);
    if (wa === wb && wa !== null) gelijk += 1;
    else uit.push({ taak: t, volgens: { [a.id]: wa, [b.id]: wb }, eigenaar: t.eigenaar });
  }
  return { verschillen: uit, gelijk };
}

/** Vragen om het gesprek te openen. Niet om te scoren, wel om elkaar te begrijpen. */
export const GESPREKSVRAGEN = [
  "Wat viel je op in de cijfers? Wat herken je, en wat niet?",
  "Bij welke taken zien jullie het verschillend? Hoe komt dat, denk je?",
  "Welke taak zit het vaakst in je hoofd, ook als je er niet mee bezig bent?",
  "Welke taak zou je het liefst helemaal (van eraan denken tot uitvoeren) overdragen?",
  "Welke zorg of aandacht voor de kinderen of familie ziet de ander misschien niet?",
  "Waar wil je dat de ander je vertrouwt, zonder te controleren hoe je het doet?",
  "Wat is voor jullie 'goed genoeg' bij de taken waar je het over oneens bent?",
  "Wat ging de afgelopen tijd goed, en wil je zo houden?",
];
