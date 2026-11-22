import { describe, expect, it } from "vitest";
import { leesIcs } from "@/lib/ics/lezen";
import { leesRegel } from "@/lib/invoer";
import { codeVan, herkenLeden } from "@/lib/leden";
import type { ExterneAgenda, Lid } from "@/lib/types";

const leden: Lid[] = [
  { id: "l", naam: "Laurens", rol: "ouder", kleur: "#000000" },
  { id: "r", naam: "Roos", rol: "ouder", kleur: "#000000" },
  { id: "s", naam: "Stijn", rol: "kind", kleur: "#000000" },
  { id: "t", naam: "Tobias", rol: "kind", kleur: "#000000" },
];

describe("letters en namen herkennen", () => {
  it("de eerste letter als die uniek is, of een ingestelde code", () => {
    expect(leden.map((l) => codeVan(l, leden))).toEqual(["L", "R", "S", "T"]);
    const metDubbel: Lid[] = [...leden, { id: "s2", naam: "Sara", rol: "kind", kleur: "#000000" }];
    expect(codeVan(metDubbel[2], metDubbel)).toBeUndefined();
    const metCode: Lid[] = [...leden.slice(0, 3), { ...leden[3], code: "TB" }];
    expect(codeVan(metCode[3], metCode)).toBe("TB");
  });

  it("letters vooraan", () => {
    expect(herkenLeden("S judo", leden)).toEqual({ leden: ["s"], titel: "Judo" });
    expect(herkenLeden("S+T zwemles", leden)).toEqual({ leden: ["s", "t"], titel: "Zwemles" });
    expect(herkenLeden("L&R etentje", leden)).toEqual({ leden: ["l", "r"], titel: "Etentje" });
    expect(herkenLeden("S en T: tandarts", leden)).toEqual({ leden: ["s", "t"], titel: "Tandarts" });
    expect(herkenLeden("S/T hockey", leden).leden).toEqual(["s", "t"]);
  });

  it("geen valse treffers", () => {
    expect(herkenLeden("T-shirt kopen", leden).leden).toEqual([]);
    expect(herkenLeden("s judo", leden).leden).toEqual([]); // kleine letter: geen code
    expect(herkenLeden("Sinterklaas", leden).leden).toEqual([]);
    expect(herkenLeden("S", leden).leden).toEqual([]);
  });

  it("namen ergens in de titel", () => {
    expect(herkenLeden("Verjaardag van Roos", leden)).toEqual({ leden: ["r"], titel: "Verjaardag van Roos" });
    expect(herkenLeden("Zwemles Stijn en Tobias", leden).leden).toEqual(["s", "t"]);
  });

  it("ook in de invoerregel", () => {
    expect(leesRegel("S judo di 16:45", { vandaag: "2026-11-21", leden })).toMatchObject({
      soort: "afspraak",
      titel: "Judo",
      leden: ["s"],
      datum: "2026-11-24",
      begin: "16:45",
    });
  });
});

const ICS = (titel: string) => `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:20261124T154500Z
DTEND:20261124T164500Z
UID:${titel}@x
SUMMARY:${titel}
END:VEVENT
END:VCALENDAR`;

describe("gezamenlijke agenda", () => {
  const gezin: ExterneAgenda = { id: "g", naam: "Gezin", url: "https://x/y.ics", lid: null, alleenBezet: false };

  it("zet afspraken bij wie in de titel staat, anders bij de ouders", () => {
    const [judo] = leesIcs(ICS("S judo"), gezin, "2026-11-24", "2026-11-24", leden);
    expect(judo).toMatchObject({ titel: "Judo", leden: ["s"], begin: "16:45" });
    const [samen] = leesIcs(ICS("Etentje bij vrienden"), gezin, "2026-11-24", "2026-11-24", leden);
    expect(samen.leden).toEqual(["l", "r"]);
  });

  it("een persoonlijke agenda blijft van die persoon, tenzij er iemand in de titel staat", () => {
    const werk: ExterneAgenda = { ...gezin, lid: "l" };
    expect(leesIcs(ICS("Overleg"), werk, "2026-11-24", "2026-11-24", leden)[0].leden).toEqual(["l"]);
    expect(leesIcs(ICS("T tandarts"), werk, "2026-11-24", "2026-11-24", leden)[0].leden).toEqual(["t"]);
    expect(leesIcs(ICS("S judo"), { ...werk, alleenBezet: true }, "2026-11-24", "2026-11-24", leden)[0]).toMatchObject({ titel: "Bezet", leden: ["l"] });
  });
});

describe("letter instellen", async () => {
  const { pasToe } = await import("@/lib/acties");
  const { legeStaat } = await import("@/lib/types");
  it("bewaart een letter en wist hem met een lege waarde", () => {
    const ctx = { door: "l", nu: "2026-11-21T10:00:00.000+01:00", nieuwId: () => Math.random().toString(36).slice(2), nieuweSleutel: () => "k" };
    let s = pasToe(legeStaat(), { type: "gezin.instellen", gezinsnaam: "V", leden }, ctx);
    s = pasToe(s, { type: "lid.opslaan", lid: { id: "t", naam: "Tobias", rol: "kind", code: "TB" } }, ctx);
    expect(s.leden.find((l) => l.id === "t")?.code).toBe("TB");
    s = pasToe(s, { type: "lid.opslaan", lid: { id: "t", naam: "Tobias", rol: "kind", code: "" } }, ctx);
    expect(s.leden.find((l) => l.id === "t")?.code).toBeUndefined();
    expect(() => pasToe(s, { type: "lid.opslaan", lid: { id: "t", naam: "Tobias", rol: "kind", code: "t" } }, ctx)).toThrow();
  });
});

describe("leeftijd of geboortejaar", async () => {
  const { geboortejaarUit } = await import("@/lib/leden");
  it("begrijpt allebei", () => {
    expect(geboortejaarUit("7", 2026)).toBe(2019);
    expect(geboortejaarUit("5", 2026)).toBe(2021);
    expect(geboortejaarUit("2019", 2026)).toBe(2019);
    expect(geboortejaarUit("", 2026)).toBeUndefined();
    expect(geboortejaarUit("150", 2026)).toBeUndefined();
    expect(geboortejaarUit(undefined, 2026)).toBeUndefined();
  });
});

describe("starttaken", async () => {
  const { SJABLONEN } = await import("@/lib/sjablonen");
  it("elke starttaak komt maar één keer voor", () => {
    const titels = SJABLONEN.map((s) => s.titel);
    expect(titels.filter((t, i) => titels.indexOf(t) !== i)).toEqual([]);
  });
});
