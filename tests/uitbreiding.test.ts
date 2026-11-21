import { describe, expect, it } from "vitest";
import { pasToe, type Actie, type Context } from "@/lib/acties";
import { afdelingVan, splitsBoodschappen } from "@/lib/boodschappen";
import { aandeelUitKaartjes, berekenInzicht, structureleVerdeling, verschillen } from "@/lib/inzicht";
import { voorvallen } from "@/lib/herhaling";
import { legeStaat, type Staat } from "@/lib/types";

let n = 0;
const ctx = (door = "a"): Context => ({ door, nu: "2026-11-21T10:00:00.000+01:00", nieuwId: () => `id${++n}`, nieuweSleutel: () => `s${++n}` });

function gezin(): Staat {
  return pasToe(
    legeStaat(),
    {
      type: "gezin.instellen",
      gezinsnaam: "Test",
      leden: [
        { id: "a", naam: "A", rol: "ouder" },
        { id: "b", naam: "B", rol: "ouder" },
        { id: "k", naam: "K", rol: "kind" },
      ],
    },
    ctx(),
  );
}

const doe = (s: Staat, actie: Actie, door = "a") => pasToe(s, actie, ctx(door));

describe("sleutels", () => {
  it("krijgt een keuken- en inboxsleutel, en kan ze vernieuwen", () => {
    const s = gezin();
    expect(s.keukenSleutel).toBeTruthy();
    expect(s.inboxSleutel).toBeTruthy();
    const t = doe(s, { type: "sleutel.vernieuwen", welke: "keuken" });
    expect(t.keukenSleutel).not.toBe(s.keukenSleutel);
    expect(t.inboxSleutel).toBe(s.inboxSleutel);
  });
});

describe("boodschappen", () => {
  it("raadt de afdeling", () => {
    expect(afdelingVan("Volle melk")).toBe("Zuivel en eieren");
    expect(afdelingVan("2 kg appels")).toBe("Groente en fruit");
    expect(afdelingVan("kipdijen")).toBe("Vlees en vis");
    expect(afdelingVan("wc-papier")).toBe("Huishouden");
    expect(afdelingVan("geraspte kaas")).toBe("Kaas en vleeswaren");
    expect(afdelingVan("Bananen")).toBe("Groente en fruit");
    expect(afdelingVan("iets raars")).toBe("Overig");
  });

  it("splitst een lijst", () => {
    expect(splitsBoodschappen("melk, kaas en 2 appels\n- brood")).toEqual(["melk", "kaas", "2 appels", "brood"]);
  });

  it("voegt toe zonder dubbelingen, vinkt af en ruimt op", () => {
    let s = doe(gezin(), { type: "boodschappen.toevoegen", namen: ["Melk", "kaas"] });
    s = doe(s, { type: "boodschappen.toevoegen", namen: ["melk", "brood"] }, "b");
    expect(s.boodschappen.map((b) => b.naam)).toEqual(["Melk", "kaas", "brood"]);
    s = doe(s, { type: "boodschap.afvinken", id: s.boodschappen[0].id, gekocht: true });
    s = doe(s, { type: "boodschappen.opruimen" });
    expect(s.boodschappen.map((b) => b.naam)).toEqual(["kaas", "brood"]);
  });
});

describe("menu", () => {
  it("één maaltijd per dag; leeg = weg", () => {
    let s = doe(gezin(), { type: "maaltijd.opslaan", maaltijd: { datum: "2026-11-23", wat: "Taco's", kok: "b", ingredienten: ["tortilla"] } });
    s = doe(s, { type: "maaltijd.opslaan", maaltijd: { datum: "2026-11-23", wat: "Pasta", kok: null, ingredienten: [] } });
    expect(s.maaltijden).toHaveLength(1);
    expect(s.maaltijden[0].wat).toBe("Pasta");
    s = doe(s, { type: "maaltijd.opslaan", maaltijd: { datum: "2026-11-23", wat: "", kok: null, ingredienten: [] } });
    expect(s.maaltijden).toHaveLength(0);
  });
});

describe("brengen en halen", () => {
  it("telt 20 minuten per rit, ook bij gekoppelde agenda's", () => {
    let s = doe(gezin(), {
      type: "afspraak.opslaan",
      afspraak: { titel: "Zwemles", datum: "2026-11-18", begin: "15:30", eind: "16:15", leden: ["k"], regelaar: "a", brengt: "a", haalt: "b", herhaling: { soort: "geen", interval: 1, dagen: [] } },
    });
    s = doe(s, { type: "extern.regelen", sleutel: "g1|uid|2026-11-19", datum: "2026-11-19", titel: "Voetbal", leden: ["k"], brengt: "b", haalt: null });
    const i = berekenInzicht(s, "2026-11-16", "2026-11-22", "2026-11-21");
    const a = i.ouders.find((o) => o.lid.id === "a")!;
    const b = i.ouders.find((o) => o.lid.id === "b")!;
    expect(a.uitvoerMin).toBe(20);
    expect(a.denkwerk).toBe(1); // regelen
    expect(b.uitvoerMin).toBe(40);
    expect(b.ritten).toBe(2);
  });

  it("zonder brengen of halen telt de duur voor de regelaar (erbij zijn)", () => {
    const s = doe(gezin(), {
      type: "afspraak.opslaan",
      afspraak: { titel: "Tandarts", datum: "2026-11-18", begin: "08:30", eind: "09:00", leden: ["k"], regelaar: "b", herhaling: { soort: "geen", interval: 1, dagen: [] } },
    });
    const b = berekenInzicht(s, "2026-11-16", "2026-11-22", "2026-11-21").ouders.find((o) => o.lid.id === "b")!;
    expect(b.uitvoerMin).toBe(30);
  });

  it("een regeling zonder brengen of halen wordt verwijderd", () => {
    let s = doe(gezin(), { type: "extern.regelen", sleutel: "x", datum: "2026-11-19", titel: "Voetbal", brengt: "a", haalt: null });
    s = doe(s, { type: "extern.regelen", sleutel: "x", datum: "2026-11-19", titel: "Voetbal", brengt: null, haalt: null });
    expect(s.externRegelingen).toHaveLength(0);
  });
});

describe("emotioneel werk en doorlopende verantwoordelijkheden", () => {
  const troosten: Actie = {
    type: "taak.opslaan",
    taak: {
      titel: "Troosten",
      categorie: "kinderen",
      start: "2026-11-01",
      herhaling: { soort: "doorlopend", interval: 3, dagen: [] },
      duurMin: 15,
      denkwerk: 2,
      werksoort: "emotioneel",
      eigenaar: "b",
    },
  };

  it("een doorlopende taak heeft geen vaste momenten", () => {
    expect(voorvallen("2026-11-01", { soort: "doorlopend", interval: 3, dagen: [] }, "2026-11-01", "2026-12-01")).toEqual([]);
  });

  it("telt als emotioneel werk, zo vaak per week als ingesteld", () => {
    const s = doe(gezin(), troosten);
    // 14 dagen = 2 weken x 3 keer x 2 punten = 12
    const b = berekenInzicht(s, "2026-11-09", "2026-11-22", "2026-11-22").ouders.find((o) => o.lid.id === "b")!;
    expect(b.emotioneel).toBeCloseTo(12);
    expect(b.denkwerk).toBe(0);
    expect(b.aandeelEmotioneel).toBe(1);
    const v = structureleVerdeling(s);
    expect(v.b.emotioneel).toBe(6);
    expect(v.b.uitvoerMin).toBe(0);
  });
});

describe("kaartjesronde", () => {
  function metTaken() {
    let s = gezin();
    for (const [titel, eigenaar, werksoort] of [
      ["Weekmenu", "a", "denkwerk"],
      ["Gymtas", "a", "denkwerk"],
      ["Troosten", "b", "emotioneel"],
    ] as const) {
      s = doe(s, {
        type: "taak.opslaan",
        taak: { titel, categorie: "kinderen", start: "2026-11-02", herhaling: { soort: "wekelijks", interval: 1, dagen: [] }, duurMin: 10, denkwerk: 2, werksoort, eigenaar },
      });
    }
    return s;
  }

  it("berekent het eigen aandeel en de verschillen", () => {
    let s = metTaken();
    const [menu, gym, troost] = s.taken;
    s = doe(s, { type: "perceptie.opslaan", taakId: menu.id, antwoord: "ik" }, "a");
    s = doe(s, { type: "perceptie.opslaan", taakId: gym.id, antwoord: "samen" }, "a");
    s = doe(s, { type: "perceptie.opslaan", taakId: troost.id, antwoord: "ander" }, "a");
    s = doe(s, { type: "perceptie.opslaan", taakId: menu.id, antwoord: "ander" }, "b");
    s = doe(s, { type: "perceptie.opslaan", taakId: gym.id, antwoord: "ik" }, "b");
    s = doe(s, { type: "perceptie.opslaan", taakId: troost.id, antwoord: "ik" }, "b");
    expect(aandeelUitKaartjes(s, "a")).toEqual({ denkwerk: 75, emotioneel: 0 });
    expect(aandeelUitKaartjes(s, "b")).toEqual({ denkwerk: 50, emotioneel: 100 });
    const v = verschillen(s);
    expect(v.gelijk).toBe(2); // menu: a; troosten: b
    expect(v.verschillen.map((x) => x.taak.titel)).toEqual(["Gymtas"]);
    expect(v.verschillen[0].volgens).toEqual({ a: "samen", b: "b" });
  });

  it("een antwoord wissen en per ronde bewaren", () => {
    let s = metTaken();
    const id = s.taken[0].id;
    s = doe(s, { type: "perceptie.opslaan", taakId: id, antwoord: "ik" });
    s = doe(s, { type: "perceptie.opslaan", taakId: id, antwoord: null });
    expect(s.percepties).toHaveLength(0);
    s = doe(s, { type: "perceptie.opslaan", taakId: id, antwoord: "ik" });
    s = doe(s, { type: "gesprek.opslaan", datum: "2026-11-21", afspraken: "x" });
    expect(aandeelUitKaartjes(s, "a").denkwerk).toBeNull();
  });
});

describe("meldingen en regio", () => {
  it("bewaart instellingen per persoon", () => {
    let s = doe(gezin(), { type: "meldingen.instellen", instelling: { briefing: true, briefingTijd: "06:45", herinneringMin: null, takenAvond: false, takenAvondTijd: "19:30", afgevinkt: true } }, "b");
    s = doe(s, { type: "regio.instellen", regio: "zuid" });
    expect(s.meldingen).toEqual([expect.objectContaining({ lid: "b", briefingTijd: "06:45", herinneringMin: null })]);
    expect(s.regio).toBe("zuid");
  });
});

describe("schoolvakanties", async () => {
  const { leesVakanties, schooljaarVan, vakantieOp, vakantiesVan } = await import("@/lib/vakanties");
  it("leest het formaat van de Rijksoverheid, met de einddatum in de goede tijdzone", () => {
    const lijst = leesVakanties({
      content: [
        {
          schoolyear: "\n 2026-2027 \n",
          vacations: [
            { type: "\n Kerstvakantie \n", regions: [{ region: "heel Nederland", startdate: "2026-12-19T00:00:00.000Z", enddate: "2027-01-03T22:59:00.000Z" }] },
            { type: " Meivakantie ", regions: [{ region: "zuid", startdate: "2027-04-24T00:00:00.000Z", enddate: "2027-05-02T21:59:00.000Z" }] },
          ],
        },
      ],
    });
    expect(lijst).toHaveLength(4);
    expect(lijst[0]).toEqual({ schooljaar: "2026-2027", naam: "Kerstvakantie", regio: "noord", van: "2026-12-19", tot: "2027-01-03" });
    expect(lijst[3]).toMatchObject({ regio: "zuid", tot: "2027-05-02" });
  });

  it("vindt de vakantie op een dag per regio", () => {
    expect(schooljaarVan("2026-11-21")).toBe("2026-2027");
    expect(schooljaarVan("2027-03-01")).toBe("2026-2027");
    expect(vakantieOp("zuid", "2027-02-15")?.naam).toBe("Voorjaarsvakantie");
    expect(vakantieOp("noord", "2027-02-15")).toBeUndefined();
    expect(vakantieOp(null, "2026-12-24")).toBeUndefined();
  });

  it("gebruikt de vaste gegevens zonder internet", async () => {
    const nooit = (() => Promise.reject(new Error("geen internet"))) as unknown as typeof fetch;
    expect((await vakantiesVan("2027-2028", nooit)).length).toBe(15);
    expect(await vakantiesVan("2030-2031", nooit)).toEqual([]);
  });
});
