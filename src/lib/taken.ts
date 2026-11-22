import { plusDagen } from "./datum";
import { voorvallen, vorige } from "./herhaling";
import type { Staat, Taak, Voltooiing } from "./types";

export interface Voorval {
  taak: Taak;
  /** De dag waarop deze keer nu staat (na verzetten). */
  datum: string;
  /** De oorspronkelijke dag: daarop staan afvinken, verzetten en toewijzen. */
  origineel: string;
  voltooiing: Voltooiing | null;
}

function sleutel(taakId: string, datum: string) {
  return `${taakId}|${datum}`;
}

export function voltooiingIndex(staat: Staat): Map<string, Voltooiing> {
  return new Map(staat.voltooiingen.map((v) => [sleutel(v.taakId, v.datum), v]));
}

/** Verzette keren: taak|origineel → nieuwe dag. */
function verzetIndex(staat: Staat): Map<string, string> {
  return new Map(staat.verzettingen.map((v) => [sleutel(v.taakId, v.origineel), v.naar]));
}

function sorteer(lijst: Voorval[]): Voorval[] {
  return lijst.sort((a, b) => a.datum.localeCompare(b.datum) || (a.taak.tijd ?? "99").localeCompare(b.taak.tijd ?? "99"));
}

/** Alle voorvallen van actieve taken die (na verzetten) binnen [van, tot] vallen. */
export function voorvallenInPeriode(staat: Staat, van: string, tot: string, metGearchiveerd = false): Voorval[] {
  const index = voltooiingIndex(staat);
  const verzet = verzetIndex(staat);
  const taken = new Map(staat.taken.map((t) => [t.id, t]));
  const uit: Voorval[] = [];
  for (const taak of staat.taken) {
    if (taak.gearchiveerd && !metGearchiveerd) continue;
    for (const datum of voorvallen(taak.start, taak.herhaling, van, tot)) {
      if (verzet.has(sleutel(taak.id, datum))) continue; // staat op een andere dag
      uit.push({ taak, datum, origineel: datum, voltooiing: index.get(sleutel(taak.id, datum)) ?? null });
    }
  }
  for (const v of staat.verzettingen) {
    const taak = taken.get(v.taakId);
    if (!taak || (taak.gearchiveerd && !metGearchiveerd) || v.naar < van || v.naar > tot) continue;
    uit.push({ taak, datum: v.naar, origineel: v.origineel, voltooiing: index.get(sleutel(taak.id, v.origineel)) ?? null });
  }
  return sorteer(uit);
}

/** Wie het (meestal) uitvoert. */
export function uitvoerderVan(taak: Taak): string | null {
  return taak.uitvoerder ?? taak.eigenaar;
}

/** Wie deze keer uitvoert: iemand die het voor deze keer op zich nam, anders de gewone uitvoerder. */
export function uitvoerderVanKeer(staat: Staat, v: Pick<Voorval, "taak" | "origineel">): string | null {
  return staat.toewijzingen.find((t) => t.taakId === v.taak.id && t.origineel === v.origineel)?.lid ?? uitvoerderVan(v.taak);
}

/**
 * Wat er nu openstaat, tot en met 'tot'.
 * Een eenmalige taak blijft openstaan tot hij af is. Bij een herhalende taak telt alleen het laatste
 * voorval tot vandaag als achterstallig: oudere gemiste keren stapelen niet op. Verzette keren staan op hun nieuwe dag.
 */
export function openVoorvallen(staat: Staat, vandaag: string, tot: string): Voorval[] {
  const index = voltooiingIndex(staat);
  const verzet = verzetIndex(staat);
  const uit: Voorval[] = [];
  const open = (t: Taak, d: string) => !index.has(sleutel(t.id, d));
  for (const taak of staat.taken) {
    if (taak.gearchiveerd) continue;
    if (taak.herhaling.soort === "geen") {
      if (taak.start <= tot && open(taak, taak.start)) uit.push({ taak, datum: taak.start, origineel: taak.start, voltooiing: null });
      continue;
    }
    const laatste = vorige(taak.start, taak.herhaling, plusDagen(vandaag, -1));
    if (laatste && open(taak, laatste) && !verzet.has(sleutel(taak.id, laatste))) {
      uit.push({ taak, datum: laatste, origineel: laatste, voltooiing: null });
    }
    for (const datum of voorvallen(taak.start, taak.herhaling, vandaag, tot)) {
      if (open(taak, datum) && !verzet.has(sleutel(taak.id, datum))) uit.push({ taak, datum, origineel: datum, voltooiing: null });
    }
  }
  const taken = new Map(staat.taken.map((t) => [t.id, t]));
  for (const v of staat.verzettingen) {
    const taak = taken.get(v.taakId);
    // Een verzette keer blijft openstaan tot hij af is, ook als de nieuwe dag voorbij is.
    if (taak && !taak.gearchiveerd && v.naar <= tot && open(taak, v.origineel)) {
      uit.push({ taak, datum: v.naar, origineel: v.origineel, voltooiing: null });
    }
  }
  return sorteer(uit);
}
