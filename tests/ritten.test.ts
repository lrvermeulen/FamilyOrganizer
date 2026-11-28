import { describe, expect, it } from "vitest";
import { pasToe, type Context } from "@/lib/acties";
import { alleItems, bordDag, ritOpen } from "@/lib/bord";
import { leesIcs } from "@/lib/ics/lezen";
import { leesRegel } from "@/lib/invoer";
import { herkenLeden, normaliseer, ritIn } from "@/lib/leden";
import { briefing } from "@/lib/meldingen";
import { legeStaat, type ExterneAgenda, type Lid } from "@/lib/types";

const leden: Lid[] = [
  { id: "l", naam: "Lau", rol: "ouder", kleur: "#000000" },
  { id: "r", naam: "Roos", rol: "ouder", kleur: "#000000" },
  { id: "s", naam: "Stijn", rol: "kind", kleur: "#000000" },
  { id: "t", naam: "Tobias", rol: "kind", kleur: "#000000" },
];
const ics = (titel: string) =>
  `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART:20261208T073000Z\nDTEND:20261208T080000Z\nUID:x\nSUMMARY:${titel}\nEND:VEVENT\nEND:VCALENDAR`;
const persoonlijk: ExterneAgenda = { id: "p", naam: "Persoonlijke agenda", url: "https://x/y.ics", lid: "l", alleenBezet: false };

describe("titels gewoon maken", () => {
  it("onzichtbare tekens, &amp; en brede tekens", () => {
    expect(normaliseer("​S&amp;T naar school")).toBe("S&T naar school");
    expect(normaliseer("S＆T judo")).toBe("S&T judo");
    expect(herkenLeden("​S&T naar school brengen", leden).leden).toEqual(["s", "t"]);
    expect(herkenLeden("S&amp;T naar school brengen", leden).leden).toEqual(["s", "t"]);
    expect(herkenLeden("🚗 S&T naar school", leden)).toEqual({ leden: ["s", "t"], titel: "Naar school" });
  });

  it("brengen of halen herkennen", () => {
    expect(ritIn("Naar school brengen")).toBe("brengen");
    expect(ritIn("ophalen bij de BSO")).toBe("halen");
    expect(ritIn("Lau haalt")).toBe("halen");
    expect(ritIn("brengen en halen")).toBe("beide");
    expect(ritIn("Judo")).toBeNull();
    expect(ritIn("rekening betalen")).toBeNull();
  });
});

describe("een rit in je eigen agenda", () => {
  it("S&T naar school brengen in de agenda van Lau: Lau brengt Stijn en Tobias", () => {
    const [i] = leesIcs(ics("S&T naar school brengen"), persoonlijk, "2026-12-08", "2026-12-08", leden);
    expect(i).toMatchObject({ titel: "Naar school brengen", leden: ["s", "t"], rit: "brengen", brengt: "l", haalt: null, begin: "08:30" });
  });

  it("in een gezinsagenda: de genoemde ouder brengt", () => {
    const gezin = { ...persoonlijk, lid: null };
    const [i] = leesIcs(ics("R brengt S naar zwemles"), gezin, "2026-12-08", "2026-12-08", leden);
    expect(i).toMatchObject({ leden: ["s"], brengt: "r", rit: "brengen" });
  });

  it("vraagt niet ook nog wie haalt, en staat bij de kinderen op het bord", () => {
    let staat = pasToe(legeStaat(), { type: "gezin.instellen", gezinsnaam: "V", leden }, { door: "l", nu: "2026-11-28T08:00:00Z", nieuwId: () => Math.random().toString(36).slice(2), nieuweSleutel: () => "k" } as Context);
    const extern = leesIcs(ics("S&T naar school brengen"), persoonlijk, "2026-12-08", "2026-12-08", leden);
    const items = alleItems(staat, extern, "2026-12-08", "2026-12-08");
    expect(ritOpen(items[0], staat)).toBe(false);
    const b = bordDag(staat, items, "2026-12-08", "2026-12-07");
    expect(b.openRitten).toEqual([]);
    expect(b.perLid.s.map((x) => x.titel)).toEqual(["Naar school brengen"]);
    expect(briefing(staat, items, "2026-12-08", "l").tekst).toContain("08:30 Naar school brengen · Stijn, Tobias (brengt: jij)");
    expect(briefing(staat, items, "2026-12-08", "r").tekst).toContain("(brengt: Lau)");
    // Neemt Roos het in de app over, dan gaat dat voor.
    staat = pasToe(staat, { type: "extern.regelen", sleutel: items[0].regelSleutel!, datum: "2026-12-08", titel: "x", leden: ["s", "t"], brengt: "r", haalt: null }, { door: "l", nu: "2026-11-28T08:00:00Z", nieuwId: () => "z", nieuweSleutel: () => "k" } as Context);
    expect(alleItems(staat, extern, "2026-12-08", "2026-12-08")[0].brengt).toBe("r");
  });

  it("zonder kind in de titel is het gewoon een afspraak van Lau", () => {
    const [i] = leesIcs(ics("Auto naar de garage brengen"), persoonlijk, "2026-12-08", "2026-12-08", leden);
    expect(i).toMatchObject({ leden: ["l"] });
    expect(i.rit).toBeUndefined();
  });
});

describe("invoerregel", () => {
  it("S&T naar school brengen ma 8:30 wordt een rit", () => {
    expect(leesRegel("S&T naar school brengen ma 8:30", { vandaag: "2026-11-28", leden })).toMatchObject({
      soort: "afspraak",
      leden: ["s", "t"],
      rit: "brengen",
      begin: "08:30",
      datum: "2026-11-30",
    });
  });
});
