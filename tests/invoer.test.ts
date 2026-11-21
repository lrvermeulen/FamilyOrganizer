import { describe, expect, it } from "vitest";
import { leesRegel, leesTekst } from "@/lib/invoer";
import type { Lid } from "@/lib/types";

// Zaterdag 21 november 2026
const opties = {
  vandaag: "2026-11-21",
  leden: [
    { id: "a", naam: "Laura", rol: "ouder", kleur: "#000000" },
    { id: "n", naam: "Nine", rol: "kind", kleur: "#000000" },
    { id: "j", naam: "Julius", rol: "kind", kleur: "#000000" },
  ] as Lid[],
};
const lees = (t: string) => leesRegel(t, opties);

describe("invoerregel", () => {
  it("afspraak met dag, tijd en kind", () => {
    expect(lees("tandarts Nine do 14:00")).toMatchObject({
      soort: "afspraak",
      titel: "Tandarts Nine",
      datum: "2026-11-26",
      begin: "14:00",
      heleDag: false,
      leden: ["n"],
    });
  });

  it("tijdbereik en volledige datum", () => {
    expect(lees("Zwemles Julius woensdag 2 december van 15:30 tot 16:15")).toMatchObject({
      soort: "afspraak",
      titel: "Zwemles Julius",
      datum: "2026-12-02",
      begin: "15:30",
      eind: "16:15",
    });
    expect(lees("judo di 16.45-17.45").eind).toBe("17:45");
  });

  it("half drie is 14:30, kwart over vier 16:15, om 9 uur 09:00", () => {
    expect(lees("verjaardag oma morgen half drie").begin).toBe("14:30");
    expect(lees("ophalen kwart over 4").begin).toBe("16:15");
    expect(lees("hockey zondag om 9 uur").begin).toBe("09:00");
    expect(lees("hockey zondag om 9 uur").datum).toBe("2026-11-22");
  });

  it("hele dag bij een studiedag", () => {
    expect(lees("Studiedag vrijdag 4 december")).toMatchObject({ soort: "afspraak", heleDag: true, datum: "2026-12-04" });
  });

  it("deadline wordt een taak", () => {
    expect(lees("Vergeet de schoolfoto's niet, inleveren uiterlijk vrijdag!")).toMatchObject({
      soort: "taak",
      uiterlijk: true,
      datum: "2026-11-27",
    });
    expect(lees("Vergeet de schoolfoto's niet, inleveren uiterlijk vrijdag!").titel).toMatch(/schoolfoto/i);
  });

  it("zonder datum: een taak voor vandaag", () => {
    expect(lees("cadeau voor Noa kopen")).toMatchObject({ soort: "taak", datumGevonden: false, datum: "2026-11-21" });
  });

  it("datums in allerlei vormen; voorbij = volgend jaar", () => {
    expect(lees("feest 3-1").datum).toBe("2027-01-03");
    expect(lees("feest 28/11").datum).toBe("2026-11-28");
    expect(lees("feest 28-11-2026").datum).toBe("2026-11-28");
    expect(lees("feest 2027-02-14").datum).toBe("2027-02-14");
    expect(lees("Kerstviering 17 dec").datum).toBe("2026-12-17");
    expect(lees("oppas volgende week dinsdag 19:00").datum).toBe("2026-11-24");
    expect(lees("oppas overmorgen").datum).toBe("2026-11-23");
  });

  it("'do' en 'zo' in gewone zinnen zijn geen dagen", () => {
    expect(lees("zo fijn dat het lukte").datumGevonden).toBe(false);
  });

  it("boodschappen", () => {
    expect(lees("melk, kaas en appels op de lijst")).toMatchObject({ soort: "boodschappen", boodschappen: ["melk", "kaas", "appels"] });
    expect(lees("boodschappen: brood, eieren").boodschappen).toEqual(["brood", "eieren"]);
  });
});

describe("geplakte tekst", () => {
  it("een brief met meerdere datums geeft meerdere voorstellen", () => {
    const brief = `Beste ouders,
Op vrijdag 4 december is er een studiedag, de kinderen zijn dan vrij.
De kerstviering is op donderdag 17 december van 17:00 tot 18:30.
Graag de opgavestrook inleveren uiterlijk 1 december.
Met vriendelijke groet, juf Anne`;
    const v = leesTekst(brief, opties);
    expect(v.map((x) => x.titel)).toEqual(["Studiedag", "Kerstviering", "Opgavestrook inleveren"]);
    expect(v.map((x) => [x.soort, x.datum, x.begin ?? ""])).toEqual([
      ["afspraak", "2026-12-04", ""],
      ["afspraak", "2026-12-17", "17:00"],
      ["taak", "2026-12-01", ""],
    ]);
  });

  it("een bericht zonder datum wordt één taak met de hele tekst als bron", () => {
    const v = leesTekst("Wil iedereen een lege schoenendoos meenemen?\nDank jullie wel!", opties);
    expect(v).toHaveLength(1);
    expect(v[0].soort).toBe("taak");
    expect(v[0].bron).toContain("Dank");
  });

  it("een geplakte boodschappenlijst", () => {
    const v = leesTekst("Boodschappen:\n- melk\n- brood\n- bananen", opties);
    expect(v).toHaveLength(1);
    expect(v[0].boodschappen).toEqual(["melk", "brood", "bananen"]);
  });
});
