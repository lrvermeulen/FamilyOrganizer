import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { pasToe, type Context } from "@/lib/acties";
import { eindNa } from "@/lib/agenda";
import { schrijfFeed } from "@/lib/ics/schrijven";
import { leesTekst, vindWeekdagen } from "@/lib/invoer";
import { legeStaat, type Lid } from "@/lib/types";

const leden: Lid[] = [
  { id: "l", naam: "Lau", rol: "ouder", kleur: "#000000" },
  { id: "r", naam: "Roos", rol: "ouder", kleur: "#000000" },
  { id: "s", naam: "Stijn", rol: "kind", kleur: "#000000" },
  { id: "t", naam: "Tobias", rol: "kind", kleur: "#000000" },
];
// Zaterdag 28 november 2026
const opties = { vandaag: "2026-11-28", leden };

const SCHEMA = `S&T naar school brengen ma do vr 8:30 Roos
S&T naar school brengen di wo 8:30
S&T ophalen van BSO di do 15:00-17:30
S&T ophalen elke wo 12:30
S&T ophalen ma vr 15:00 Roos`;

describe("vaste dagen", () => {
  it("lijsten, bereiken en elke", () => {
    expect(vindWeekdagen("ma do vr 8:30")?.dagen).toEqual([1, 4, 5]);
    expect(vindWeekdagen("ma, do en vr")?.dagen).toEqual([1, 4, 5]);
    expect(vindWeekdagen("di/wo")?.dagen).toEqual([2, 3]);
    expect(vindWeekdagen("ma t/m vr")?.dagen).toEqual([1, 2, 3, 4, 5]);
    expect(vindWeekdagen("elke dinsdag")?.dagen).toEqual([2]);
    expect(vindWeekdagen("tandarts do 14:00")).toBeNull();
    expect(vindWeekdagen("zo fijn")).toBeNull();
  });
});

describe("het schoolschema van Lau en Roos", () => {
  const v = leesTekst(SCHEMA, opties);

  it("vijf ritten met de goede dagen, tijden en brengers", () => {
    expect(
      v.map((x) => [x.titel, x.rit, x.door ?? "ik", x.leden.join("+"), x.herhaling?.dagen.join(","), x.begin, x.eind ?? "", x.datum]),
    ).toEqual([
      ["Naar school brengen", "brengen", "r", "s+t", "1,4,5", "08:30", "", "2026-11-30"],
      ["Naar school brengen", "brengen", "ik", "s+t", "2,3", "08:30", "", "2026-12-01"],
      ["Ophalen van BSO", "halen", "ik", "s+t", "2,4", "15:00", "17:30", "2026-12-01"],
      ["Ophalen", "halen", "ik", "s+t", "3", "12:30", "", "2026-12-02"],
      ["Ophalen", "halen", "r", "s+t", "1,5", "15:00", "", "2026-11-30"],
    ]);
  });

  it("in de agenda van Roos alleen haar ritten, met de namen van de kinderen; geen school", () => {
    let n = 0;
    const ctx = (door = "l"): Context => ({ door, nu: "2026-11-28T10:00:00Z", nieuwId: () => `id${++n}`, nieuweSleutel: () => "k" });
    let staat = pasToe(legeStaat(), { type: "gezin.instellen", gezinsnaam: "V", leden }, ctx());
    for (const x of v) {
      staat = pasToe(
        staat,
        {
          type: "afspraak.opslaan",
          afspraak: {
            titel: x.titel,
            datum: x.datum,
            begin: x.begin,
            eind: x.eind ?? eindNa(x.begin!, 15),
            leden: x.leden,
            brengt: x.rit !== "halen" ? (x.door ?? "l") : null,
            haalt: x.rit !== "brengen" ? (x.door ?? "l") : null,
            herhaling: x.herhaling!,
          },
        },
        ctx(),
      );
    }
    const week = { van: "2026-11-30", tot: "2026-12-06", nu: DateTime.fromISO("2026-11-28T10:00:00Z"), domein: "x" };
    const roos = schrijfFeed(staat, { ...week, lid: "r" });
    const lau = schrijfFeed(staat, { ...week, lid: "l" });
    const titels = (f: string) => [...f.matchAll(/SUMMARY:(.*)\r\n/g)].map((m) => m[1]);
    // Roos: brengen ma do vr (3x), halen ma vr (2x)
    expect(titels(roos).sort()).toEqual([
      "Naar school brengen (Stijn\\, Tobias)",
      "Naar school brengen (Stijn\\, Tobias)",
      "Naar school brengen (Stijn\\, Tobias)",
      "Ophalen (Stijn\\, Tobias)",
      "Ophalen (Stijn\\, Tobias)",
    ]);
    // Lau: brengen di wo (2x), BSO di do (2x), halen wo (1x)
    expect(titels(lau).length).toBe(5);
    expect(lau).toContain("SUMMARY:Ophalen van BSO (Stijn\\, Tobias)");
    expect(lau).not.toContain("school\r\n");
  });
});
