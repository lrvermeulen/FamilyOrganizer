import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { pasToe, type Context } from "@/lib/acties";
import { alleItems, bordDag } from "@/lib/bord";
import { schrijfFeed } from "@/lib/ics/schrijven";
import { berekenInzicht } from "@/lib/inzicht";
import { leesTekst } from "@/lib/invoer";
import { teVersturen } from "@/lib/meldingen";
import { legeStaat, type Lid, type Staat } from "@/lib/types";

const leden: Lid[] = [
  { id: "l", naam: "Lau", rol: "ouder", kleur: "#000000" },
  { id: "r", naam: "Roos", rol: "ouder", kleur: "#000000" },
  { id: "s", naam: "Stijn", rol: "kind", kleur: "#000000" },
  { id: "t", naam: "Tobias", rol: "kind", kleur: "#000000" },
];
const SCHEMA = `S&T school ma vr 8:30-15:00 brengt Roos haalt Roos
S&T school elke di 8:30-15:00 BSO tot 17:30 brengt Lau haalt Lau
S&T school elke wo 8:30-12:30 brengt Lau haalt Lau
S&T school elke do 8:30-15:00 BSO tot 17:30 brengt Roos haalt Lau`;

let n = 0;
const ctx = (door = "l"): Context => ({ door, nu: "2026-11-28T10:00:00Z", nieuwId: () => `id${++n}`, nieuweSleutel: () => "k" });

/** Het schema zoals de app het na plakken en "Toevoegen" opslaat. */
function metSchema(): Staat {
  let s = pasToe(legeStaat(), { type: "gezin.instellen", gezinsnaam: "V", leden }, ctx());
  for (const v of leesTekst(SCHEMA, { vandaag: "2026-11-28", leden })) {
    s = pasToe(
      s,
      {
        type: "afspraak.opslaan",
        afspraak: {
          titel: v.titel,
          datum: v.datum,
          begin: v.begin,
          eind: v.eind,
          leden: v.leden,
          brengt: v.brengt ?? null,
          haalt: v.haalt ?? null,
          haalVan: v.haalVan,
          school: !!v.school,
          herhaling: v.herhaling!,
        },
      },
      ctx(),
    );
  }
  return s;
}

describe("school invoeren", () => {
  it("vier regels: school met brenger, haler en BSO", () => {
    const v = leesTekst(SCHEMA, { vandaag: "2026-11-28", leden });
    expect(v.map((x) => [x.titel, x.school, x.leden.join("+"), x.herhaling?.dagen.join(","), x.begin, x.eind, x.haalVan ?? "", x.brengt, x.haalt, x.rit ?? ""])).toEqual([
      ["School", true, "s+t", "1,5", "08:30", "15:00", "", "r", "r", ""],
      ["School en BSO", true, "s+t", "2", "08:30", "17:30", "15:00", "l", "l", ""],
      ["School", true, "s+t", "3", "08:30", "12:30", "", "l", "l", ""],
      ["School en BSO", true, "s+t", "4", "08:30", "17:30", "15:00", "r", "l", ""],
    ]);
  });

  it("op het bord: één blok per dag bij de kinderen, niets open", () => {
    const s = metSchema();
    const items = alleItems(s, [], "2026-11-30", "2026-12-06");
    const di = bordDag(s, items, "2026-12-01", "2026-11-28");
    expect(di.perLid.s.map((i) => `${i.titel} ${i.begin}-${i.eind} ↗${i.brengt} ↙${i.haalt}`)).toEqual(["School en BSO 08:30-17:30 ↗l ↙l"]);
    expect(di.openRitten).toEqual([]);
    expect(di.perLid.l).toEqual([]);
  });
});

describe("in je eigen agenda alleen de ritten", () => {
  it("Roos: brengen ma do vr, halen ma vr; Lau: brengen di wo, halen di wo do", () => {
    const s = metSchema();
    const week = { van: "2026-11-30", tot: "2026-12-06", nu: DateTime.fromISO("2026-11-28T10:00:00Z"), domein: "x" };
    const lijst = (lid: string) =>
      [...schrijfFeed(s, { ...week, lid }).matchAll(/DTSTART:(\d{8})T(\d{4})\d{2}Z\r\nDTEND:\d{8}T(\d{4})\d{2}Z\r\nSUMMARY:(.*)\r\n/g)].map(
        (m) => `${m[1].slice(6)} ${m[2]}-${m[3]} ${m[4]}`,
      );
    // Tijden in UTC (winter: een uur eerder dan in Nederland).
    expect(lijst("r")).toEqual([
      "30 0730-0745 Stijn en Tobias brengen (School)",
      "30 1400-1415 Stijn en Tobias halen (School)",
      "03 0730-0745 Stijn en Tobias brengen (School en BSO)",
      "04 0730-0745 Stijn en Tobias brengen (School)",
      "04 1400-1415 Stijn en Tobias halen (School)",
    ]);
    expect(lijst("l")).toEqual([
      "01 0730-0745 Stijn en Tobias brengen (School en BSO)",
      "01 1400-1630 Stijn en Tobias halen (School en BSO\\, tussen 15:00 en 17:30)",
      "02 0730-0745 Stijn en Tobias brengen (School)",
      "02 1130-1145 Stijn en Tobias halen (School)",
      "03 1400-1630 Stijn en Tobias halen (School en BSO\\, tussen 15:00 en 17:30)",
    ]);
  });
});

describe("vakanties en studiedagen", () => {
  it("in de kerstvakantie geen school en geen ritten", () => {
    let s = metSchema();
    s = pasToe(s, { type: "regio.instellen", regio: "midden" }, ctx());
    const kerst = alleItems(s, [], "2026-12-21", "2026-12-27");
    expect(kerst.filter((i) => i.school)).toEqual([]);
    const feed = schrijfFeed(s, { van: "2026-12-21", tot: "2026-12-27", lid: "r", nu: DateTime.now(), domein: "x" });
    expect(feed).not.toContain("brengen");
    // Ook niet meegeteld als brengen of halen in het inzicht.
    const i = berekenInzicht(s, "2026-12-21", "2026-12-27", "2026-12-27");
    expect(i.ouders.every((o) => o.ritten === 0)).toBe(true);
  });

  it("een studiedag (in de app of uit Social Schools) laat school vervallen", () => {
    let s = metSchema();
    s = pasToe(
      s,
      { type: "afspraak.opslaan", afspraak: { titel: "Studiedag", datum: "2026-12-04", heleDag: true, leden: ["s", "t"], herhaling: { soort: "geen", interval: 1, dagen: [] } } },
      ctx(),
    );
    expect(alleItems(s, [], "2026-12-04", "2026-12-04").filter((i) => i.school)).toEqual([]);
    // Uit een gekoppelde agenda, zonder namen
    const t = metSchema();
    const extern = [{ sleutel: "x", soort: "extern" as const, titel: "Studiedag groep 4", datum: "2026-12-03", heleDag: true, leden: ["l", "r"], refId: "ss" }];
    expect(alleItems(t, extern, "2026-12-03", "2026-12-03").filter((i) => i.school)).toEqual([]);
    expect(alleItems(t, [], "2026-12-03", "2026-12-03").filter((i) => i.school)).toHaveLength(1);
  });
});

describe("herinneringen", () => {
  it("wie haalt, krijgt een seintje voor het ophalen, niet 's ochtends", () => {
    let s = metSchema();
    s = pasToe(s, { type: "meldingen.instellen", instelling: { briefing: false, briefingTijd: "07:00", herinneringMin: 30, takenAvond: false, takenAvondTijd: "19:30", afgevinkt: false } }, ctx("l"));
    s = pasToe(s, { type: "meldingen.instellen", instelling: { briefing: false, briefingTijd: "07:00", herinneringMin: 30, takenAvond: false, takenAvondTijd: "19:30", afgevinkt: false } }, ctx("r"));
    // Donderdag: Roos brengt 8:30, Lau haalt van de BSO vanaf 15:00
    const items = alleItems(s, [], "2026-12-03", "2026-12-03");
    const iedereen = new Set(["l", "r"]);
    const om = (klok: string) => teVersturen(s, items, "2026-12-03", klok, new Set(), iedereen).map((m) => `${m.lid}: ${m.titel} | ${m.tekst}`);
    expect(om("08:05")).toEqual(["r: Over 25 min: Stijn en Tobias brengen (School en BSO) | Jij brengt."]);
    expect(om("14:40")).toEqual(["l: Over 20 min: Stijn en Tobias halen (School en BSO) | Jij haalt, tussen 15:00 en 17:30."]);
  });
});
