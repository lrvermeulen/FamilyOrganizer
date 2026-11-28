import { ritRollen, type AgendaItem } from "./agenda";
import { bordTaken } from "./bord";
import { minutenTussen } from "./datum";
import { openVoorvallen, uitvoerderVanKeer } from "./taken";
import { MeldingInstellingSchema, type MeldingInstelling, type Staat, type Verzoek } from "./types";
import { vakantieOp } from "./vakanties";

export interface Melding {
  lid: string;
  /** Uniek per melding, zodat hij maar één keer verstuurd wordt. */
  sleutel: string;
  titel: string;
  tekst: string;
  url: string;
}

/** Hoe lang na het geplande moment een melding nog mag komen (als de klok een keer overslaat). */
const INHAALVENSTER_MIN = 90;

export function instellingVan(staat: Staat, lid: string): MeldingInstelling {
  return staat.meldingen.find((m) => m.lid === lid) ?? MeldingInstellingSchema.parse({ lid });
}

function naam(staat: Staat, id: string | null | undefined) {
  return staat.leden.find((l) => l.id === id)?.naam;
}

function minuut(klok: string) {
  const [u, m] = klok.split(":").map(Number);
  return u * 60 + m;
}

/** Wat moet deze ouder weten over een afspraak? "jij brengt", "Bram haalt", "haalt: nog niemand". */
function ritTekst(staat: Staat, item: AgendaItem, lid: string): string {
  const kind = item.leden.some((l) => staat.leden.find((x) => x.id === l)?.rol === "kind");
  if (!kind || item.heleDag || !item.begin) return "";
  const wie = (x: string | null | undefined) => (x === lid ? "jij" : (naam(staat, x) ?? "nog niemand"));
  return ` (${ritRollen(item)
    .map((r) => `${r === "brengt" ? "brengt" : "haalt"}: ${wie(item[r])}`)
    .join(", ")})`;
}

/** De ochtendbriefing voor één ouder: de dag van het hele gezin, plus eten en wat jij niet moet vergeten. */
export function briefing(staat: Staat, items: AgendaItem[], datum: string, lid: string): { titel: string; tekst: string } {
  const regels: string[] = [];
  const vak = vakantieOp(staat.regio, datum);
  if (vak) regels.push(`🏖 ${vak.naam}`);
  const vandaag = items.filter((i) => i.datum === datum && i.soort !== "taak");
  for (const i of vandaag) {
    const wie = i.leden.map((l) => naam(staat, l)).filter(Boolean).join(", ");
    regels.push(`${i.heleDag || !i.begin ? "Hele dag" : i.begin} ${i.titel}${wie ? ` · ${wie}` : ""}${ritTekst(staat, i, lid)}`);
  }
  const eten = staat.maaltijden.find((m) => m.datum === datum);
  if (eten?.wat) regels.push(`🍽 ${eten.wat}${eten.kok ? ` (${eten.kok === lid ? "jij kookt" : `${naam(staat, eten.kok)} kookt`})` : ""}`);
  const mijn = bordTaken(staat, datum, datum).filter((v) => uitvoerderVanKeer(staat, v) === lid);
  if (mijn.length) regels.push(`Niet vergeten: ${mijn.slice(0, 4).map((v) => v.taak.titel).join(", ")}${mijn.length > 4 ? ` en ${mijn.length - 4} meer` : ""}`);
  return {
    titel: `Goedemorgen ${naam(staat, lid) ?? ""}`.trim(),
    tekst: regels.length ? regels.join("\n") : "Een rustige dag: niets in de agenda.",
  };
}

/**
 * Welke meldingen er nu verstuurd moeten worden. 'datum' en 'klok' zijn de lokale tijd;
 * 'verstuurd' bevat de sleutels van meldingen die al weg zijn.
 */
export function teVersturen(
  staat: Staat,
  items: AgendaItem[],
  datum: string,
  klok: string,
  verstuurd: Set<string>,
  metAbonnement: Set<string>,
): Melding[] {
  const nu = minuut(klok);
  const uit: Melding[] = [];
  const voeg = (m: Melding) => !verstuurd.has(m.sleutel) && uit.push(m);
  const binnen = (moment: number) => nu >= moment && nu < moment + INHAALVENSTER_MIN;

  for (const ouder of staat.leden.filter((l) => l.rol === "ouder" && metAbonnement.has(l.id))) {
    const ins = instellingVan(staat, ouder.id);

    if (ins.briefing && binnen(minuut(ins.briefingTijd))) {
      voeg({ lid: ouder.id, sleutel: `briefing|${ouder.id}|${datum}`, ...briefing(staat, items, datum, ouder.id), url: "/#bord" });
    }

    if (ins.herinneringMin !== null) {
      for (const i of items) {
        if (i.datum !== datum || i.heleDag || !i.begin || i.soort === "taak") continue;
        const mijn = [i.regelaar, i.brengt, i.haalt].includes(ouder.id) || i.leden.includes(ouder.id);
        if (!mijn) continue;
        const start = minuut(i.begin);
        // Herinneren in het venster [start - herinneringMin, start).
        if (nu >= start - ins.herinneringMin && nu < start) {
          const over = minutenTussen(klok, i.begin);
          const rol = i.brengt === ouder.id ? "Jij brengt. " : i.haalt === ouder.id ? `Jij haalt${i.eind ? ` om ${i.eind}` : ""}. ` : "";
          voeg({
            lid: ouder.id,
            sleutel: `herinnering|${ouder.id}|${i.sleutel}`,
            titel: `Over ${over} min: ${i.titel}`,
            tekst: `${rol}${i.begin}${i.locatie ? ` · ${i.locatie}` : ""}${i.leden.length ? ` · ${i.leden.map((l) => naam(staat, l)).join(", ")}` : ""}`,
            url: "/#bord",
          });
        }
      }
    }

    if (ins.takenAvond && binnen(minuut(ins.takenAvondTijd))) {
      const open = openVoorvallen(staat, datum, datum).filter(
        (v) => v.datum === datum && uitvoerderVanKeer(staat, v) === ouder.id,
      );
      if (open.length) {
        voeg({
          lid: ouder.id,
          sleutel: `avond|${ouder.id}|${datum}`,
          titel: `Nog ${open.length} ${open.length === 1 ? "taak" : "taken"} open vandaag`,
          tekst: open.slice(0, 5).map((v) => v.taak.titel).join(", "),
          url: "/#bord",
        });
      }
    }
  }
  return uit;
}

/** Melding voor de andere ouder(s) als iemand iets afvinkt (als ze dat willen). */
export function afgevinktMeldingen(staat: Staat, door: string, taakTitel: string, metAbonnement: Set<string>): Melding[] {
  return staat.leden
    .filter((l) => l.rol === "ouder" && l.id !== door && metAbonnement.has(l.id) && instellingVan(staat, l.id).afgevinkt)
    .map((l) => ({
      lid: l.id,
      sleutel: `afgevinkt|${l.id}|${Date.now()}`,
      titel: `${naam(staat, door)} heeft afgevinkt`,
      tekst: taakTitel,
      url: "/#bord",
    }));
}

/** Beschrijving van een vraag, voor meldingen en de inbox: "Stijn halen bij Judo, di 24 nov 17:45". */
export function verzoekTekst(staat: Staat, v: Verzoek, dagLabel: (d: string) => string): string {
  const wie = v.leden.map((l) => naam(staat, l)).filter(Boolean).join(" en ");
  const wanneer = `${dagLabel(v.datum)}${v.tijd ? ` ${v.tijd}` : ""}`;
  if (v.soort === "taak") return `${v.titel}${v.voortaan ? " (voortaan, de hele taak)" : ` (${wanneer})`}`;
  return `${wie ? `${wie} ` : ""}${v.soort === "brengen" ? "brengen" : "halen"}: ${v.titel}, ${wanneer}`;
}

/** Melding bij een nieuwe vraag (naar wie hem krijgt) of een antwoord (naar wie hem stelde). */
export function verzoekMelding(staat: Staat, v: Verzoek, dagLabel: (d: string) => string): Melding {
  const tekst = verzoekTekst(staat, v, dagLabel) + (v.bericht && v.status === "open" ? `\n"${v.bericht}"` : "");
  if (v.status === "open") {
    return { lid: v.aan, sleutel: `verzoek|${v.id}`, titel: `${naam(staat, v.van)} vraagt: kun jij dit doen?`, tekst, url: "/#inbox" };
  }
  return {
    lid: v.van,
    sleutel: `antwoord|${v.id}`,
    titel: v.status === "ja" ? `${naam(staat, v.aan)} doet het ✓` : `${naam(staat, v.aan)} kan het niet`,
    tekst,
    url: "/#bord",
  };
}
