import type { Lid } from "./types";

function ontsnap(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * De letter(s) waarmee een gezinslid in een agenda wordt aangeduid ("S judo" = Stijn heeft judo).
 * Ingesteld bij het gezinslid, of anders de eerste letter van de naam, als geen ander gezinslid die heeft.
 */
export function codeVan(lid: Lid, leden: Lid[]): string | undefined {
  if (lid.code) return lid.code;
  const letter = lid.naam.trim().charAt(0).toUpperCase();
  if (!letter) return undefined;
  const dubbel = leden.some(
    (l) => l.id !== lid.id && (l.code ? l.code === letter : l.naam.trim().charAt(0).toUpperCase() === letter),
  );
  return dubbel ? undefined : letter;
}

/**
 * Herken gezinsleden in een titel:
 * - letters vooraan: "S judo", "S+T zwemles", "L&R etentje", "S: tandarts" (hoofdletters, zoals ingesteld);
 * - namen ergens in de tekst: "Zwemles Stijn", "verjaardag van Roos".
 * Geeft de gevonden leden terug en de titel zonder de letters vooraan.
 */
export function herkenLeden(tekst: string, leden: Lid[]): { leden: string[]; titel: string } {
  const gevonden = new Set<string>();
  let titel = tekst.trim();

  const codes = leden
    .map((l) => ({ id: l.id, code: codeVan(l, leden) }))
    .filter((x): x is { id: string; code: string } => !!x.code)
    .sort((a, b) => b.code.length - a.code.length);
  if (codes.length) {
    const code = `(?:${codes.map((c) => ontsnap(c.code)).join("|")})`;
    const scheiding = `(?:\\s*[+/&,]\\s*|\\s+en\\s+)`;
    const m = new RegExp(`^(${code}(?:${scheiding}${code})*)\\s*(?::|-|–)?\\s+(?=\\S)`).exec(titel);
    if (m) {
      for (const deel of m[1].split(new RegExp(scheiding))) {
        const c = codes.find((x) => x.code === deel.trim());
        if (c) gevonden.add(c.id);
      }
      titel = titel.slice(m[0].length);
      titel = titel.charAt(0).toUpperCase() + titel.slice(1);
    }
  }

  for (const l of leden) {
    if (new RegExp(`(^|[^\\p{L}])${ontsnap(l.naam)}('s|s)?(?![\\p{L}])`, "iu").test(tekst)) gevonden.add(l.id);
  }
  for (const id of kinderInGroep(tekst, leden)) gevonden.add(id);
  return { leden: leden.filter((l) => gevonden.has(l.id)).map((l) => l.id), titel };
}

/**
 * Wat iemand invult bij "Leeftijd": meestal een leeftijd (7), soms een geboortejaar (2019).
 * Geeft het geboortejaar terug, of undefined als het nergens op lijkt.
 */
export function geboortejaarUit(invoer: string | number | undefined, ditJaar: number): number | undefined {
  const n = typeof invoer === "number" ? invoer : Number(String(invoer ?? "").trim());
  if (!Number.isFinite(n) || String(invoer ?? "").toString().trim() === "") return undefined;
  if (n >= 0 && n <= 40) return ditJaar - Math.round(n);
  if (n >= 1900 && n <= ditJaar) return Math.round(n);
  return undefined;
}

/** "groep 4", "groep 4a", "gr. 4", "groepen 3 en 4", "groep 1/2": de genoemde groepsnummers. */
export function groepenIn(tekst: string): string[] {
  const uit: string[] = [];
  const re = /\b(?:groep(?:en)?|gr\.?)\s*((?:\d{1,2}[a-z]?)(?:\s*(?:,|en|t\/m|tot|\/|-|&)\s*\d{1,2}[a-z]?)*)/gi;
  for (const m of tekst.matchAll(re)) {
    const deel = m[1].toLowerCase();
    const nummers = deel.match(/\d{1,2}[a-z]?/g) ?? [];
    if (/t\/m|tot|-/.test(deel) && nummers.length === 2) {
      // "groep 1 t/m 4": alles daartussen
      const [a, b] = nummers.map((x) => parseInt(x, 10));
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) uit.push(String(i));
    } else uit.push(...nummers);
  }
  return [...new Set(uit)];
}

/** Kinderen in een genoemde groep. Een kind in "4a" hoort bij "groep 4" en "groep 4a"; in "1/2" bij groep 1 en 2. */
export function kinderInGroep(tekst: string, leden: Lid[]): string[] {
  const genoemd = groepenIn(tekst);
  if (!genoemd.length) return [];
  return leden
    .filter((l) => l.groep)
    .filter((l) => {
      const eigen = l.groep!.toLowerCase().match(/\d{1,2}[a-z]?/g) ?? [];
      // "4" past bij "4" en "4a"; "4a" past bij "4" en "4a", niet bij "4b".
      const past = (a: string, b: string) => a === b || (parseInt(a, 10) === parseInt(b, 10) && (/^\d+$/.test(a) || /^\d+$/.test(b)));
      return eigen.some((g) => genoemd.some((x) => past(g, x)));
    })
    .map((l) => l.id);
}
