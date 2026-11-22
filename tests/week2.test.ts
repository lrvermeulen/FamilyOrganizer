import { describe, expect, it } from "vitest";
import { pasToe, type Actie, type Context } from "@/lib/acties";
import { alleItems, bordDag, weekstart } from "@/lib/bord";
import { leesTekst } from "@/lib/invoer";
import { groepenIn, kinderInGroep } from "@/lib/leden";
import { verzoekMelding } from "@/lib/meldingen";
import { eersteKeer, SJABLONEN } from "@/lib/sjablonen";
import { openVoorvallen, uitvoerderVanKeer, voorvallenInPeriode } from "@/lib/taken";
import { legeStaat, type Lid, type Staat } from "@/lib/types";

let n = 0;
const ctx = (door = "l"): Context => ({ door, nu: "2026-11-22T20:00:00.000+01:00", nieuwId: () => `id${++n}`, nieuweSleutel: () => `k${++n}` });
const doe = (s: Staat, a: Actie, door = "l") => pasToe(s, a, ctx(door));

const LEDEN: Lid[] = [
  { id: "l", naam: "Laurens", rol: "ouder", kleur: "#000000" },
  { id: "r", naam: "Roos", rol: "ouder", kleur: "#000000" },
  { id: "s", naam: "Stijn", rol: "kind", kleur: "#000000", groep: "4" },
  { id: "t", naam: "Tobias", rol: "kind", kleur: "#000000", groep: "1/2" },
];

function gezin(): Staat {
  return pasToe(legeStaat(), { type: "gezin.instellen", gezinsnaam: "V", leden: LEDEN }, ctx());
}

describe("1. starttaken verspreiden", () => {
  it("routine vanaf vandaag, zeldzame taken later en verspreid", () => {
    const vandaag = "2026-11-22";
    expect(eersteKeer({ soort: "dagelijks", interval: 1, dagen: [] }, vandaag, 3)).toBe(vandaag);
    expect(eersteKeer({ soort: "wekelijks", interval: 1, dagen: [6] }, vandaag, 3)).toBe(vandaag);
    expect(eersteKeer({ soort: "wekelijks", interval: 2, dagen: [6] }, vandaag, 1)).toBe("2026-11-29");
    const maand = SJABLONEN.map((s, i) => ({ s, i })).filter(({ s }) => s.herhaling.soort === "maandelijks");
    const data = maand.map(({ s, i }) => eersteKeer(s.herhaling, vandaag, i));
    expect(data.every((d) => d >= "2026-11-29")).toBe(true);
    expect(new Set(data).size).toBeGreaterThan(data.length / 2);
  });

  it("op dag één staan alleen de routinetaken open", () => {
    const vandaag = "2026-11-22"; // zondag
    let s = gezin();
    s = doe(s, {
      type: "taken.toevoegen",
      taken: SJABLONEN.filter((x) => x.standaard).map((x, i) => ({
        titel: x.titel,
        categorie: x.categorie,
        start: eersteKeer(x.herhaling, vandaag, i),
        herhaling: x.herhaling,
        duurMin: x.duurMin,
        denkwerk: x.denkwerk,
        werksoort: x.werksoort ?? "denkwerk",
        eigenaar: null,
      })),
    });
    const vandaagOpen = openVoorvallen(s, vandaag, vandaag).filter((v) => v.datum === vandaag);
    const zeldzaam = vandaagOpen.filter((v) => ["maandelijks", "jaarlijks"].includes(v.taak.herhaling.soort));
    expect(zeldzaam).toEqual([]);
    // en het emotionele werk is als emotioneel opgeslagen
    expect(s.taken.find((t) => t.titel.startsWith("Troosten"))?.werksoort).toBe("emotioneel");
  });
});

describe("4. groep van de kinderen", () => {
  it("herkent groepen in tekst", () => {
    expect(groepenIn("Beste ouders van groep 4")).toEqual(["4"]);
    expect(groepenIn("groepen 3 en 4")).toEqual(["3", "4"]);
    expect(groepenIn("Gr. 1/2")).toEqual(["1", "2"]);
    expect(groepenIn("groep 1 t/m 4")).toEqual(["1", "2", "3", "4"]);
    expect(groepenIn("Groep 4a")).toEqual(["4a"]);
    expect(groepenIn("we zijn met een groep van 12")).toEqual([]);
  });

  it("vindt het kind", () => {
    expect(kinderInGroep("Beste ouders van groep 4", LEDEN)).toEqual(["s"]);
    expect(kinderInGroep("groep 2 heeft gym", LEDEN)).toEqual(["t"]);
    expect(kinderInGroep("alle groepen 1 t/m 8", LEDEN)).toEqual(["s", "t"]);
    expect(kinderInGroep("Groep 4a", LEDEN)).toEqual(["s"]);
  });
});

describe("5. titels uit een schoolbrief", () => {
  it("de brief uit de proefweek", () => {
    const v = leesTekst(
      "Beste ouders van groep 4,\nVrijdag 4 december is er een studiedag, de kinderen zijn vrij.\nWillen jullie uiterlijk woensdag 25 november een lege schoenendoos meegeven? Graag met naam erop.",
      { vandaag: "2026-11-22", leden: LEDEN },
    );
    expect(v.map((x) => [x.titel, x.soort, x.datum, x.leden])).toEqual([
      ["Studiedag", "afspraak", "2026-12-04", ["s"]],
      ["Lege schoenendoos meegeven", "taak", "2026-11-25", ["s"]],
    ]);
  });

  it("andere beleefde vragen", () => {
    const opties = { vandaag: "2026-11-22", leden: LEDEN };
    expect(leesTekst("Wilt u het formulier uiterlijk vrijdag ondertekenen?", opties)[0].titel).toBe("Formulier ondertekenen");
    expect(leesTekst("Denken jullie aan de gymspullen op dinsdag?", opties)[0].titel).toBe("Gymspullen");
  });
});

describe("6. week doorlopen: wat moet er af", () => {
  it("losse taken en zeldzame taken, geen routine", () => {
    let s = gezin();
    s = doe(s, { type: "taak.opslaan", taak: { titel: "Schoenendoos", categorie: "school", start: "2026-11-25", herhaling: { soort: "geen", interval: 1, dagen: [] }, duurMin: 5, denkwerk: 2, eigenaar: null } });
    s = doe(s, { type: "taak.opslaan", taak: { titel: "Rekeningen", categorie: "financien", start: "2026-11-26", herhaling: { soort: "maandelijks", interval: 1, dagen: [] }, duurMin: 30, denkwerk: 2, eigenaar: "l" } });
    s = doe(s, { type: "taak.opslaan", taak: { titel: "Koken", categorie: "eten", start: "2026-11-23", herhaling: { soort: "dagelijks", interval: 1, dagen: [] }, duurMin: 45, denkwerk: 2, eigenaar: "r" } });
    const w = weekstart(s, alleItems(s, [], "2026-11-23", "2026-11-29"), "2026-11-23", "2026-11-22");
    expect(w.teDoen.map((v) => v.taak.titel)).toEqual(["Schoenendoos", "Rekeningen"]);
  });
});

describe("8. verzetten", () => {
  function metWekelijks() {
    return doe(gezin(), {
      type: "taak.opslaan",
      taak: { id: "gym", titel: "Gymtas", categorie: "school", start: "2026-11-23", herhaling: { soort: "wekelijks", interval: 1, dagen: [1] }, duurMin: 5, denkwerk: 2, eigenaar: "l" },
    });
  }

  it("een keer naar morgen; afvinken blijft op de oorspronkelijke keer", () => {
    let s = metWekelijks();
    s = doe(s, { type: "taak.verzetten", taakId: "gym", origineel: "2026-11-23", naar: "2026-11-24" });
    const week = voorvallenInPeriode(s, "2026-11-23", "2026-11-29");
    expect(week.map((v) => [v.datum, v.origineel])).toEqual([["2026-11-24", "2026-11-23"]]);
    expect(openVoorvallen(s, "2026-11-23", "2026-11-23")).toEqual([]);
    expect(openVoorvallen(s, "2026-11-24", "2026-11-24").map((v) => v.datum)).toEqual(["2026-11-24"]);
    s = doe(s, { type: "taak.afvinken", taakId: "gym", datum: "2026-11-23" });
    expect(openVoorvallen(s, "2026-11-24", "2026-11-24")).toEqual([]);
    expect(voorvallenInPeriode(s, "2026-11-24", "2026-11-24")[0].voltooiing?.status).toBe("gedaan");
  });

  it("blijft openstaan als de nieuwe dag voorbij is; terugzetten mag", () => {
    let s = metWekelijks();
    s = doe(s, { type: "taak.verzetten", taakId: "gym", origineel: "2026-11-23", naar: "2026-11-24" });
    expect(openVoorvallen(s, "2026-11-26", "2026-11-26").map((v) => v.datum)).toEqual(["2026-11-24"]);
    s = doe(s, { type: "taak.verzetten", taakId: "gym", origineel: "2026-11-23", naar: "2026-11-23" });
    expect(s.verzettingen).toEqual([]);
  });

  it("een losse taak schuift gewoon op", () => {
    let s = doe(gezin(), { type: "taak.opslaan", taak: { id: "x", titel: "Cadeau", categorie: "sociaal", start: "2026-11-23", herhaling: { soort: "geen", interval: 1, dagen: [] }, duurMin: 30, denkwerk: 3, eigenaar: "l" } });
    s = doe(s, { type: "taak.verzetten", taakId: "x", origineel: "2026-11-23", naar: "2026-11-25" });
    expect(s.taken[0].start).toBe("2026-11-25");
  });
});

describe("7. de ander iets vragen", () => {
  function metJudo() {
    let s = gezin();
    s = doe(s, {
      type: "afspraak.opslaan",
      afspraak: { id: "judo", titel: "Judo", datum: "2026-11-24", begin: "16:45", eind: "17:45", leden: ["s"], herhaling: { soort: "geen", interval: 1, dagen: [] } },
    });
    return s;
  }

  it("halen vragen; ja zet Roos als haler", () => {
    let s = metJudo();
    s = doe(s, { type: "verzoek.sturen", aan: "r", soort: "halen", titel: "Judo", datum: "2026-11-24", tijd: "17:45", afspraakId: "judo", leden: ["s"], bericht: "Ik zit in Utrecht" });
    const v = s.verzoeken[0];
    expect(verzoekMelding(s, v, (d) => d)).toMatchObject({ lid: "r", titel: "Laurens vraagt: kun jij dit doen?", tekst: 'Stijn halen: Judo, 2026-11-24 17:45\n"Ik zit in Utrecht"' });
    expect(() => doe(s, { type: "verzoek.beantwoorden", id: v.id, ja: true }, "l")).toThrow(/niet aan jou/);
    s = doe(s, { type: "verzoek.beantwoorden", id: v.id, ja: true }, "r");
    expect(s.afspraken[0].haalt).toBe("r");
    expect(verzoekMelding(s, s.verzoeken[0], (d) => d)).toMatchObject({ lid: "l", titel: "Roos doet het ✓" });
    expect(() => doe(s, { type: "verzoek.beantwoorden", id: v.id, ja: false }, "r")).toThrow(/al beantwoord/);
  });

  it("bij een afspraak uit een gekoppelde agenda", () => {
    let s = gezin();
    s = doe(s, { type: "verzoek.sturen", aan: "r", soort: "brengen", titel: "Zwemles", datum: "2026-11-25", regelSleutel: "g|uid|2026-11-25", leden: ["t"] });
    s = doe(s, { type: "verzoek.beantwoorden", id: s.verzoeken[0].id, ja: true }, "r");
    expect(s.externRegelingen).toEqual([expect.objectContaining({ sleutel: "g|uid|2026-11-25", brengt: "r", haalt: null, leden: ["t"] })]);
  });

  it("een taak deze keer: alleen die keer naar Roos", () => {
    let s = doe(gezin(), {
      type: "taak.opslaan",
      taak: { id: "gym", titel: "Gymtas", categorie: "school", start: "2026-11-23", herhaling: { soort: "wekelijks", interval: 1, dagen: [1] }, duurMin: 5, denkwerk: 2, eigenaar: "l" },
    });
    s = doe(s, { type: "verzoek.sturen", aan: "r", soort: "taak", titel: "Gymtas", datum: "2026-11-23", taakId: "gym", origineel: "2026-11-23" });
    s = doe(s, { type: "verzoek.beantwoorden", id: s.verzoeken[0].id, ja: true }, "r");
    const [deze, volgende] = voorvallenInPeriode(s, "2026-11-23", "2026-11-30");
    expect(uitvoerderVanKeer(s, deze)).toBe("r");
    expect(uitvoerderVanKeer(s, volgende)).toBe("l");
    expect(s.taken[0].eigenaar).toBe("l"); // het denkwerk blijft bij Laurens
    const b = bordDag(s, [], "2026-11-23", "2026-11-23");
    expect(b.takenPerLid.r.map((v) => v.taak.titel)).toEqual(["Gymtas"]);
  });

  it("een taak voortaan: het hele pakket naar Roos", () => {
    let s = doe(gezin(), {
      type: "taak.opslaan",
      taak: { id: "gym", titel: "Gymtas", categorie: "school", start: "2026-11-23", herhaling: { soort: "wekelijks", interval: 1, dagen: [1] }, duurMin: 5, denkwerk: 2, eigenaar: "l", uitvoerder: "s" },
    });
    s = doe(s, { type: "verzoek.sturen", aan: "r", soort: "taak", titel: "Gymtas", datum: "2026-11-23", taakId: "gym", origineel: "2026-11-23", voortaan: true });
    s = doe(s, { type: "verzoek.beantwoorden", id: s.verzoeken[0].id, ja: true }, "r");
    expect(s.taken[0]).toMatchObject({ eigenaar: "r", uitvoerder: null });
  });

  it("nee verandert niets; intrekken kan alleen wie het vroeg; een nieuwe vraag vervangt de oude", () => {
    let s = metJudo();
    const vraag: Actie = { type: "verzoek.sturen", aan: "r", soort: "halen", titel: "Judo", datum: "2026-11-24", afspraakId: "judo", leden: ["s"] };
    s = doe(s, vraag);
    s = doe(s, vraag);
    expect(s.verzoeken.map((v) => v.status)).toEqual(["ingetrokken", "open"]);
    expect(() => doe(s, { type: "verzoek.intrekken", id: s.verzoeken[1].id }, "r")).toThrow();
    s = doe(s, { type: "verzoek.beantwoorden", id: s.verzoeken[1].id, ja: false }, "r");
    expect(s.afspraken[0].haalt).toBeNull();
    expect(() => doe(s, { ...vraag, aan: "l" } as Actie)).toThrow(/aan jezelf/);
  });
});
