import { plusDagen } from "./datum";
import { voorvallen, vorige } from "./herhaling";
import type { Staat, Taak, Voltooiing } from "./types";

export interface Voorval {
  taak: Taak;
  datum: string;
  voltooiing: Voltooiing | null;
}

function sleutel(taakId: string, datum: string) {
  return `${taakId}|${datum}`;
}

export function voltooiingIndex(staat: Staat): Map<string, Voltooiing> {
  return new Map(staat.voltooiingen.map((v) => [sleutel(v.taakId, v.datum), v]));
}

/** Alle voorvallen van actieve taken binnen [van, tot]. */
export function voorvallenInPeriode(staat: Staat, van: string, tot: string, metGearchiveerd = false): Voorval[] {
  const index = voltooiingIndex(staat);
  const uit: Voorval[] = [];
  for (const taak of staat.taken) {
    if (taak.gearchiveerd && !metGearchiveerd) continue;
    for (const datum of voorvallen(taak.start, taak.herhaling, van, tot)) {
      uit.push({ taak, datum, voltooiing: index.get(sleutel(taak.id, datum)) ?? null });
    }
  }
  return uit.sort((a, b) => a.datum.localeCompare(b.datum) || (a.taak.tijd ?? "99").localeCompare(b.taak.tijd ?? "99"));
}

/** Wie het (meestal) uitvoert. */
export function uitvoerderVan(taak: Taak): string | null {
  return taak.uitvoerder ?? taak.eigenaar;
}

/**
 * Wat er nu openstaat, tot en met 'tot'.
 * Een eenmalige taak blijft openstaan tot hij af is. Bij een herhalende taak telt alleen het laatste
 * voorval tot vandaag als achterstallig: oudere gemiste keren stapelen niet op.
 */
export function openVoorvallen(staat: Staat, vandaag: string, tot: string): Voorval[] {
  const index = voltooiingIndex(staat);
  const uit: Voorval[] = [];
  for (const taak of staat.taken) {
    if (taak.gearchiveerd) continue;
    if (taak.herhaling.soort === "geen") {
      if (taak.start <= tot && !index.has(sleutel(taak.id, taak.start))) {
        uit.push({ taak, datum: taak.start, voltooiing: null });
      }
      continue;
    }
    const laatste = vorige(taak.start, taak.herhaling, plusDagen(vandaag, -1));
    if (laatste && !index.has(sleutel(taak.id, laatste))) uit.push({ taak, datum: laatste, voltooiing: null });
    for (const datum of voorvallen(taak.start, taak.herhaling, vandaag, tot)) {
      if (!index.has(sleutel(taak.id, datum))) uit.push({ taak, datum, voltooiing: null });
    }
  }
  return uit.sort((a, b) => a.datum.localeCompare(b.datum) || (a.taak.tijd ?? "99").localeCompare(b.taak.tijd ?? "99"));
}
