import { describe, expect, it } from "vitest";
import { pasToe, type Actie, type Context } from "@/lib/acties";
import { alleItems } from "@/lib/bord";
import { afgevinktMeldingen, briefing, teVersturen } from "@/lib/meldingen";
import { legeStaat, type Staat } from "@/lib/types";

let n = 0;
const ctx = (door = "a"): Context => ({ door, nu: "2026-11-23T07:00:00.000+01:00", nieuwId: () => `id${++n}`, nieuweSleutel: () => `s${++n}` });
const doe = (s: Staat, a: Actie, door = "a") => pasToe(s, a, ctx(door));

// Maandag 23 november 2026
const DATUM = "2026-11-23";

function gezin(): Staat {
  let s = pasToe(
    legeStaat(),
    {
      type: "gezin.instellen",
      gezinsnaam: "T",
      leden: [
        { id: "a", naam: "Anna", rol: "ouder" },
        { id: "b", naam: "Bram", rol: "ouder" },
        { id: "k", naam: "Kim", rol: "kind" },
      ],
    },
    ctx(),
  );
  s = doe(s, {
    type: "afspraak.opslaan",
    afspraak: { titel: "Zwemles", datum: DATUM, begin: "15:30", eind: "16:15", leden: ["k"], brengt: "a", haalt: null, herhaling: { soort: "geen", interval: 1, dagen: [] } },
  });
  s = doe(s, { type: "maaltijd.opslaan", maaltijd: { datum: DATUM, wat: "Taco's", kok: "b", ingredienten: [] } });
  s = doe(s, {
    type: "taak.opslaan",
    taak: { titel: "Gymtas klaarzetten", categorie: "school", start: DATUM, herhaling: { soort: "wekelijks", interval: 1, dagen: [1] }, duurMin: 5, denkwerk: 2, eigenaar: "a" },
  });
  return s;
}

const iedereen = new Set(["a", "b"]);

describe("ochtendbriefing", () => {
  it("de dag van het gezin, eten en wat jij niet moet vergeten", () => {
    const s = gezin();
    const b = briefing(s, alleItems(s, [], DATUM, DATUM), DATUM, "a");
    expect(b.titel).toBe("Goedemorgen Anna");
    expect(b.tekst).toBe("15:30 Zwemles · Kim (brengt: jij, haalt: nog niemand)\n🍽 Taco's (Bram kookt)\nNiet vergeten: Gymtas klaarzetten");
    const bram = briefing(s, alleItems(s, [], DATUM, DATUM), DATUM, "b");
    expect(bram.tekst).toContain("brengt: Anna, haalt: nog niemand");
    expect(bram.tekst).not.toContain("Gymtas");
  });

  it("komt op het ingestelde moment, één keer, en alleen met een toestel", () => {
    const s = gezin();
    const items = alleItems(s, [], DATUM, DATUM);
    expect(teVersturen(s, items, DATUM, "06:55", new Set(), iedereen).filter((m) => m.sleutel.startsWith("briefing"))).toHaveLength(0);
    const om7 = teVersturen(s, items, DATUM, "07:00", new Set(), iedereen).filter((m) => m.sleutel.startsWith("briefing"));
    expect(om7.map((m) => m.lid)).toEqual(["a", "b"]);
    const al = new Set(om7.map((m) => m.sleutel));
    expect(teVersturen(s, items, DATUM, "07:05", al, iedereen).filter((m) => m.sleutel.startsWith("briefing"))).toHaveLength(0);
    expect(teVersturen(s, items, DATUM, "07:00", new Set(), new Set(["b"])).filter((m) => m.sleutel.startsWith("briefing")).map((m) => m.lid)).toEqual(["b"]);
    // Te laat (de klok lag eruit): niet meer sturen.
    expect(teVersturen(s, items, DATUM, "09:00", new Set(), iedereen).filter((m) => m.sleutel.startsWith("briefing"))).toHaveLength(0);
  });
});

describe("herinneringen", () => {
  it("een half uur van tevoren voor wie brengt", () => {
    const s = gezin();
    const items = alleItems(s, [], DATUM, DATUM);
    const h = (klok: string) => teVersturen(s, items, DATUM, klok, new Set(), iedereen).filter((m) => m.sleutel.startsWith("herinnering"));
    expect(h("14:55")).toHaveLength(0);
    expect(h("15:05")).toEqual([expect.objectContaining({ lid: "a", titel: "Over 25 min: Zwemles", tekst: "Jij brengt. 15:30 · Kim" })]);
    expect(h("15:30")).toHaveLength(0);
  });

  it("uit te zetten", () => {
    let s = gezin();
    s = doe(s, { type: "meldingen.instellen", instelling: { briefing: false, briefingTijd: "07:00", herinneringMin: null, takenAvond: false, takenAvondTijd: "19:30", afgevinkt: false } });
    expect(teVersturen(s, alleItems(s, [], DATUM, DATUM), DATUM, "15:05", new Set(), iedereen).filter((m) => m.lid === "a")).toHaveLength(0);
  });
});

describe("taken 's avonds en afvinken", () => {
  it("noemt open taken van vandaag", () => {
    const s = gezin();
    const m = teVersturen(s, alleItems(s, [], DATUM, DATUM), DATUM, "19:30", new Set(), iedereen).filter((x) => x.sleutel.startsWith("avond"));
    expect(m).toEqual([expect.objectContaining({ lid: "a", titel: "Nog 1 taak open vandaag", tekst: "Gymtas klaarzetten" })]);
  });

  it("seintje aan de ander alleen als die dat wil", () => {
    let s = gezin();
    expect(afgevinktMeldingen(s, "a", "Gymtas", iedereen)).toHaveLength(0);
    s = doe(s, { type: "meldingen.instellen", instelling: { briefing: true, briefingTijd: "07:00", herinneringMin: 30, takenAvond: true, takenAvondTijd: "19:30", afgevinkt: true } }, "b");
    expect(afgevinktMeldingen(s, "a", "Gymtas", iedereen)).toEqual([expect.objectContaining({ lid: "b", titel: "Anna heeft afgevinkt", tekst: "Gymtas" })]);
    expect(afgevinktMeldingen(s, "b", "Gymtas", iedereen)).toHaveLength(0);
  });
});
