import { DateTime } from "luxon";
import { splitsBoodschappen } from "./boodschappen";
import { alsDatum, dag } from "./datum";
import { herkenLeden } from "./leden";
import type { Lid } from "./types";

/**
 * Begrijpt eenvoudige Nederlandse zinnen en geplakte berichten, zonder AI:
 * "tandarts Nine do 14:00", "studiedag vrijdag 28 november", "schoolfoto's inleveren uiterlijk vrijdag",
 * "melk, kaas en appels op de lijst". Het resultaat is altijd een voorstel dat je eerst bevestigt.
 */
export interface Voorstel {
  soort: "afspraak" | "taak" | "boodschappen";
  titel: string;
  datum: string;
  heleDag: boolean;
  begin?: string;
  eind?: string;
  /** Gezinsleden die in de tekst genoemd worden. */
  leden: string[];
  /** Er stond een uiterste datum in ("uiterlijk", "vóór", "inleveren"). */
  uiterlijk: boolean;
  boodschappen: string[];
  /** Of er een datum in de tekst stond (anders: vandaag). */
  datumGevonden: boolean;
  /** Het stuk tekst waar dit voorstel uit komt. */
  bron: string;
}

const MAANDEN: Record<string, number> = {
  januari: 1, jan: 1, februari: 2, feb: 2, maart: 3, mrt: 3, mar: 3, april: 4, apr: 4, mei: 5, juni: 6, jun: 6,
  juli: 7, jul: 7, augustus: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, november: 11, nov: 11,
  december: 12, dec: 12,
};
const DAGEN: Record<string, number> = {
  maandag: 1, ma: 1, dinsdag: 2, di: 2, woensdag: 3, wo: 3, donderdag: 4, do: 4, vrijdag: 5, vr: 5, zaterdag: 6, za: 6, zondag: 7, zo: 7,
};
const TELWOORDEN: Record<string, number> = {
  een: 1, één: 1, twee: 2, drie: 3, vier: 4, vijf: 5, zes: 6, zeven: 7, acht: 8, negen: 9, tien: 10, elf: 11, twaalf: 12,
};

const MAAND_RE = Object.keys(MAANDEN).sort((a, b) => b.length - a.length).join("|");
const DAG_RE = Object.keys(DAGEN).sort((a, b) => b.length - a.length).join("|");
const UUR_RE = `(\\d{1,2}|${Object.keys(TELWOORDEN).join("|")})`;

/** Woorden die een uiterste datum aangeven: dan is het een taak, geen afspraak. */
const UITERLIJK_RE = /\b(uiterlijk|uiterste|deadline|inleveren|aanmelden|opgeven|betalen|v[oó]{2}r)\b/i;
/** Woorden voor iets wat de hele dag duurt. */
const HELE_DAG_RE = /\b(studiedag|studiedagen|vrije dag|vrij|vakantie|feest|verjaardag|jarig|kamp|schoolreis|excursie|sportdag|koningsspelen|uitje|logeren|weekend weg)\b/i;
/** Zinnen voor boodschappen. */
const BOODSCHAP_RE = /^\s*(boodschappen|boodschap|kopen|koop|halen|lijst)\s*:\s*|\s+(op|aan)\s+(de\s+)?(boodschappen)?lijst(je)?\s*\.?\s*$/i;

interface Gevonden {
  datum?: string;
  begin?: string;
  eind?: string;
  /** De stukken tekst die we herkenden (om uit de titel te halen). */
  stukken: string[];
}

function klok(u: number, m = 0): string | undefined {
  if (u < 0 || u > 23 || m < 0 || m > 59) return undefined;
  return `${String(u).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function uurGetal(s: string): number {
  return TELWOORDEN[s.toLowerCase()] ?? Number(s);
}

/** "half 3" is meestal 14:30 bij gezinsafspraken: uren tot 7 lezen we als middag. */
function middag(u: number): number {
  return u >= 1 && u <= 7 ? u + 12 : u;
}

/** Zoek tijden: "14:00", "14.30", "14u", "om 9 uur", "half 3", "kwart over 4", en bereiken "15:30-16:15". */
export function vindTijden(tekst: string): Gevonden {
  const g: Gevonden = { stukken: [] };
  const bereik = new RegExp(`(?:van\\s+)?(\\d{1,2})[:.](\\d{2})\\s*(?:-|–|tot|t/m)\\s*(\\d{1,2})[:.](\\d{2})(?:\\s*uur)?`, "i").exec(tekst);
  if (bereik) {
    g.begin = klok(+bereik[1], +bereik[2]);
    g.eind = klok(+bereik[3], +bereik[4]);
    g.stukken.push(bereik[0]);
    return g;
  }
  const patronen: [RegExp, (m: RegExpExecArray) => string | undefined][] = [
    [/\b(\d{1,2})[:.](\d{2})\s*(?:uur|u)?\b/i, (m) => klok(+m[1], +m[2])],
    [new RegExp(`\\bhalf\\s+${UUR_RE}\\b`, "i"), (m) => klok(middag(uurGetal(m[1])) - 1, 30)],
    [new RegExp(`\\bkwart\\s+over\\s+${UUR_RE}\\b`, "i"), (m) => klok(middag(uurGetal(m[1])), 15)],
    [new RegExp(`\\bkwart\\s+voor\\s+${UUR_RE}\\b`, "i"), (m) => klok(middag(uurGetal(m[1])) - 1, 45)],
    [/\b(\d{1,2})\s*(?:uur|u)\b/i, (m) => klok(+m[1])],
    [new RegExp(`\\bom\\s+${UUR_RE}\\b(?![:.\\-/]\\d)`, "i"), (m) => klok(middag(uurGetal(m[1])))],
  ];
  for (const [re, maak] of patronen) {
    const m = re.exec(tekst);
    if (m) {
      const k = maak(m);
      if (k) {
        g.begin = k;
        g.stukken.push(m[0]);
        break;
      }
    }
  }
  return g;
}

/** Zoek een datum. Zonder jaar en al voorbij: volgend jaar. Een weekdag: de eerstvolgende (vandaag telt mee). */
export function vindDatum(tekst: string, vandaag: string): Gevonden {
  const g: Gevonden = { stukken: [] };
  const v = dag(vandaag);
  const zet = (d: DateTime | null, stuk: string) => {
    if (!d || !d.isValid || g.datum) return;
    g.datum = alsDatum(d);
    g.stukken.push(stuk);
  };
  const zonderJaar = (d: number, mnd: number) => {
    let x = DateTime.fromObject({ year: v.year, month: mnd, day: d }, { zone: v.zone });
    if (x.isValid && x < v.minus({ days: 1 })) x = x.plus({ years: 1 });
    return x;
  };

  let m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(tekst);
  if (m) zet(DateTime.fromObject({ year: +m[1], month: +m[2], day: +m[3] }, { zone: v.zone }), m[0]);
  m = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/.exec(tekst);
  if (m) {
    const j = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    zet(DateTime.fromObject({ year: j, month: +m[2], day: +m[1] }, { zone: v.zone }), m[0]);
  }
  m = new RegExp(`\\b(?:(?:${DAG_RE})\\.?\\s+)?(\\d{1,2})\\s+(${MAAND_RE})\\.?(?:\\s+(\\d{4}))?\\b`, "i").exec(tekst);
  if (m) {
    const mnd = MAANDEN[m[2].toLowerCase()];
    zet(m[3] ? DateTime.fromObject({ year: +m[3], month: mnd, day: +m[1] }, { zone: v.zone }) : zonderJaar(+m[1], mnd), m[0]);
  }
  m = /\b(\d{1,2})[-/](\d{1,2})\b(?![-/]\d)/.exec(tekst);
  if (m && +m[2] <= 12) zet(zonderJaar(+m[1], +m[2]), m[0]);
  m = /\b(vandaag|vanavond|vanmiddag|vanochtend|morgen(?:ochtend|middag|avond)?|overmorgen)\b/i.exec(tekst);
  if (m) {
    const w = m[1].toLowerCase();
    zet(v.plus({ days: w.startsWith("overmorgen") ? 2 : w.startsWith("morgen") ? 1 : 0 }), m[0]);
  }
  m = new RegExp(`\\b(volgende\\s+week\\s+)?(${DAG_RE})\\b\\.?`, "i").exec(tekst);
  if (m && !g.datum) {
    // Losse afkortingen als "do" en "zo" alleen als ze echt als dag gebruikt worden.
    const woord = m[2].toLowerCase();
    const kort = woord.length <= 2;
    const context = tekst.slice(m.index + m[0].length, m.index + m[0].length + 8);
    if (!kort || /^\s*(\d|om\b|$|,|\.)/i.test(context) || /\b(op|tot|vanaf)\s*$/i.test(tekst.slice(0, m.index))) {
      const doel = m[1]
        ? v.startOf("week").plus({ weeks: 1, days: DAGEN[woord] - 1 }) // in de week hierna
        : v.plus({ days: (DAGEN[woord] - v.weekday + 7) % 7 }); // de eerstvolgende, vandaag telt mee
      zet(doel, m[0]);
    }
  }
  return g;
}

function vindLeden(tekst: string, leden: Lid[]): string[] {
  return herkenLeden(tekst, leden).leden;
}

function maakTitel(tekst: string, weg: string[]): string {
  let t = tekst;
  for (const stuk of weg) t = t.replace(stuk, " ");
  // Bij een zin met een komma is het eerste deel meestal de kern ("Op vrijdag is er een studiedag, de kinderen zijn vrij").
  const delen = t.split(",").map((x) => x.trim());
  if (delen.length > 1 && delen[0].split(/\s+/).filter(Boolean).length >= 2) {
    t = /\b(niet|vergeten)\b/i.test(delen[0]) && delen[1] ? `${delen[0]} ${delen[1]}` : delen[0];
  }
  t = t
    .replace(/\b(uiterlijk|uiterste datum|deadline|v[oó]{2}r)\b/gi, " ")
    .replace(/\b(is er|er is|zijn er|er zijn|wordt er|er wordt|hebben we|hebben jullie)\s+(een\s+)?/gi, " ")
    // Beleefde verzoeken: "Willen jullie een lege schoenendoos meegeven?" → "lege schoenendoos meegeven"
    .replace(/^\s*(willen|wilt|zou|zouden|kunnen|kunt|mogen|denken|denkt)\s+(jullie|u|je|julie)\s+(er\s+)?(alstublieft\s+|aub\s+|even\s+|wel\s+|nog\s+)*(aan\s+)?/i, "")
    .replace(/\s+(meenemen|meegeven|inleveren|regelen|betalen|ondertekenen|invullen)\s*\?/i, " $1")
    .replace(/\?+/g, "")
    .replace(/\b(niet vergeten|vergeet niet|denk aan|let op|graag)\b[:!]?/gi, " ")
    .replace(/\s+(om|op|van|tot|vanaf|a\.s\.|aanstaande|komende)\s*(?=[,.!]|$)/gi, " ")
    .replace(/^\s*(om|op|van|tot|vanaf|a\.s\.|aanstaande|komende)\s+/i, "")
    .replace(/\s+(om|op|vanaf|a\.s\.|aanstaande|komende)\s+(?=(om|op)\b)/gi, " ")
    .replace(/[!]+/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/^[\s,.:;-]+|[\s,.:;-]+$/g, "")
    .replace(/\s+(om|op|van|tot)$/i, "");
  // Lidwoorden en losse werkwoorden aan het begin of eind weghalen ("De kerstviering is" → "Kerstviering").
  for (let i = 0; i < 3; i++) {
    t = t
      .replace(/^(de|het|een|op|graag|a\.s\.|aanstaande|komende)\s+/i, "")
      .replace(/\s+(is|zijn|wordt|worden|op|van|tot|om|er|dan|de|het|een)$/i, "")
      .trim();
  }
  if (t.length > 80) t = t.slice(0, 77).replace(/\s+\S*$/, "") + "…";
  return t ? t[0].toUpperCase() + t.slice(1) : "";
}

/** Eén regel of zin omzetten naar een voorstel. */
export function leesRegel(regel: string, opties: { vandaag: string; leden: Lid[] }): Voorstel {
  const bron = regel.trim();
  const isBoodschap = BOODSCHAP_RE.test(bron);
  if (isBoodschap) {
    const rest = bron.replace(BOODSCHAP_RE, "").trim();
    return {
      soort: "boodschappen",
      titel: "Boodschappen",
      datum: opties.vandaag,
      heleDag: true,
      leden: [],
      uiterlijk: false,
      boodschappen: splitsBoodschappen(rest),
      datumGevonden: false,
      bron,
    };
  }
  const d = vindDatum(bron, opties.vandaag);
  const t = vindTijden(bron);
  const uiterlijk = UITERLIJK_RE.test(bron);
  const herkend = herkenLeden(bron, opties.leden);
  const leden = herkend.leden;
  const soort: Voorstel["soort"] = uiterlijk ? "taak" : t.begin ? "afspraak" : d.datum && HELE_DAG_RE.test(bron) ? "afspraak" : d.datum ? "taak" : "taak";
  return {
    soort,
    titel: maakTitel(herkend.titel, [...d.stukken, ...t.stukken]) || bron.slice(0, 80),
    datum: d.datum ?? opties.vandaag,
    heleDag: !t.begin,
    begin: t.begin,
    eind: t.eind,
    leden,
    uiterlijk,
    boodschappen: [],
    datumGevonden: !!d.datum,
    bron,
  };
}

/**
 * Een hele tekst (bijvoorbeeld een geplakt bericht of de tekst uit een screenshot) omzetten.
 * Elke regel of zin met een datum wordt een eigen voorstel. Zonder datums: één voorstel.
 */
export function leesTekst(tekst: string, opties: { vandaag: string; leden: Lid[] }): Voorstel[] {
  const schoon = tekst.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim();
  if (!schoon) return [];
  if (BOODSCHAP_RE.test(schoon) || /^\s*(boodschappen|boodschappenlijst)\s*:?\s*\n/i.test(schoon)) {
    const items = schoon.replace(/^\s*(boodschappen|boodschappenlijst)\s*:?\s*/i, "");
    return [leesRegel(`boodschappen: ${items.replace(/\n/g, ", ")}`, opties)];
  }
  const regels = schoon
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9])/)
    .map((r) => r.trim())
    .filter((r) => r.length > 2);
  if (regels.length <= 1) return [leesRegel(schoon, opties)];
  // Wie in de hele tekst genoemd wordt ("Beste ouders van groep 4"), geldt voor voorstellen zonder eigen naam.
  const context = vindLeden(schoon, opties.leden);
  const metDatum = regels
    .map((r) => leesRegel(r, opties))
    .filter((v) => v.datumGevonden)
    .map((v) => (v.leden.length ? v : { ...v, leden: context }));
  if (metDatum.length) return metDatum;
  // Geen datums: de hele tekst als één taak, met de eerste regel als titel.
  const v = leesRegel(regels[0], opties);
  return [{ ...v, bron: schoon, leden: vindLeden(schoon, opties.leden), uiterlijk: UITERLIJK_RE.test(schoon) }];
}

/** Voor de invoerregel: herkent iets als "nu" de tijd? (voor een korte uitleg onder het veld) */
export function beschrijf(v: Voorstel, leden: Lid[], label: (datum: string) => string): string {
  if (v.soort === "boodschappen") return `${v.boodschappen.length} ${v.boodschappen.length === 1 ? "boodschap" : "boodschappen"} op de lijst`;
  const wie = v.leden.map((id) => leden.find((l) => l.id === id)?.naam).filter(Boolean).join(", ");
  const wanneer = v.datumGevonden || v.soort === "afspraak" ? label(v.datum) : "";
  const tijd = v.begin ? ` ${v.begin}${v.eind ? `–${v.eind}` : ""}` : "";
  const soort = v.soort === "afspraak" ? "Afspraak" : v.uiterlijk ? "Taak met deadline" : "Taak";
  return [soort, wanneer ? `${v.uiterlijk ? "uiterlijk " : ""}${wanneer}${tijd}` : "", wie ? `voor ${wie}` : ""].filter(Boolean).join(" · ");
}
