import { DateTime } from "luxon";

export const TIJDZONE = "Europe/Amsterdam";

export const WEEKDAG_KORT = ["ma", "di", "wo", "do", "vr", "za", "zo"];
export const WEEKDAG_LANG = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

export function dag(datum: string): DateTime {
  return DateTime.fromISO(datum, { zone: TIJDZONE }).startOf("day");
}

export function alsDatum(d: DateTime): string {
  return d.setZone(TIJDZONE).toISODate()!;
}

export function vandaag(nu: DateTime = DateTime.now()): string {
  return alsDatum(nu.setZone(TIJDZONE));
}

export function plusDagen(datum: string, n: number): string {
  return alsDatum(dag(datum).plus({ days: n }));
}

export function maandagVan(datum: string): string {
  return alsDatum(dag(datum).startOf("week"));
}

/** Aantal dagen van a naar b (b - a). */
export function dagenTussen(a: string, b: string): number {
  return Math.round(dag(b).diff(dag(a), "days").days);
}

export function opKlok(datum: string, klok: string): DateTime {
  const [u, m] = klok.split(":").map(Number);
  return dag(datum).set({ hour: u, minute: m });
}

/** "za 21 nov" */
export function kortLabel(datum: string): string {
  const d = dag(datum);
  return `${WEEKDAG_KORT[d.weekday - 1]} ${d.day} ${MAANDEN[d.month - 1]}`;
}

/** "zaterdag 21 november" (zonder jaar) */
export function langLabel(datum: string): string {
  const d = dag(datum);
  return `${WEEKDAG_LANG[d.weekday - 1]} ${d.day} ${d.setLocale("nl").toFormat("LLLL")}`;
}

export function minutenTussen(begin: string, eind: string): number {
  const [bu, bm] = begin.split(":").map(Number);
  const [eu, em] = eind.split(":").map(Number);
  return Math.max(0, eu * 60 + em - (bu * 60 + bm));
}

export function urenLabel(min: number): string {
  if (min < 60) return `${Math.round(min)} min`;
  const u = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? `${u} u` : `${u} u ${m} min`;
}
