import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { pasToe, type Actie, type Context } from "@/lib/acties";
import { appItems } from "@/lib/agenda";
import { demoStaat } from "@/lib/demo";
import { voorvallen, vorige } from "@/lib/herhaling";
import { berekenInzicht, inschattingenVanRonde, structureleVerdeling } from "@/lib/inzicht";
import { openVoorvallen } from "@/lib/taken";
import { legeStaat, type Herhaling, type Staat } from "@/lib/types";

const h = (soort: Herhaling["soort"], interval = 1, dagen: number[] = [], tot?: string): Herhaling => ({ soort, interval, dagen, tot });

describe("herhaling", () => {
  it("eenmalig alleen op de startdatum", () => {
    expect(voorvallen("2026-11-23", h("geen"), "2026-11-01", "2026-12-31")).toEqual(["2026-11-23"]);
    expect(voorvallen("2026-11-23", h("geen"), "2026-11-24", "2026-12-31")).toEqual([]);
  });

  it("wekelijks op meerdere dagen, elke twee weken", () => {
    // 2026-11-23 is een maandag
    expect(voorvallen("2026-11-23", h("wekelijks", 2, [1, 4]), "2026-11-23", "2026-12-13")).toEqual([
      "2026-11-23",
      "2026-11-26",
      "2026-12-07",
      "2026-12-10",
    ]);
  });

  it("wekelijks zonder dagen gebruikt de weekdag van de start, en niet vóór de start", () => {
    expect(voorvallen("2026-11-25", h("wekelijks", 1, [1, 3]), "2026-11-23", "2026-12-01")).toEqual(["2026-11-25", "2026-11-30"]);
    expect(voorvallen("2026-11-25", h("wekelijks"), "2026-11-23", "2026-12-09")).toEqual(["2026-11-25", "2026-12-02", "2026-12-09"]);
  });

  it("dagelijks springt direct naar de periode", () => {
    expect(voorvallen("2020-01-01", h("dagelijks", 3), "2026-11-21", "2026-11-27")).toEqual(["2026-11-22", "2026-11-25"]);
  });

  it("maandelijks op de 31e valt terug op de laatste dag", () => {
    expect(voorvallen("2027-01-31", h("maandelijks"), "2027-01-01", "2027-04-30")).toEqual([
      "2027-01-31",
      "2027-02-28",
      "2027-03-31",
      "2027-04-30",
    ]);
  });

  it("stopt op de einddatum", () => {
    expect(voorvallen("2026-11-23", h("dagelijks", 1, [], "2026-11-25"), "2026-11-01", "2026-12-31")).toHaveLength(3);
  });

  it("vorige", () => {
    expect(vorige("2026-11-02", h("wekelijks"), "2026-11-20")).toBe("2026-11-16");
    expect(vorige("2026-11-25", h("wekelijks"), "2026-11-20")).toBeNull();
  });
});

let n = 0;
function ctx(door = "a"): Context {
  return { door, nu: "2026-11-21T10:00:00.000+01:00", nieuwId: () => `id${++n}`, nieuweSleutel: () => "sleutel" };
}

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

const taak = (extra: Partial<Extract<Actie, { type: "taak.opslaan" }>["taak"]> = {}): Actie => ({
  type: "taak.opslaan",
  taak: {
    titel: "Weekmenu",
    categorie: "eten",
    start: "2026-11-02",
    herhaling: h("wekelijks"),
    duurMin: 20,
    denkwerk: 3,
    eigenaar: "a",
    ...extra,
  },
});

describe("acties", () => {
  it("stelt het gezin in en geeft kleuren", () => {
    const s = gezin();
    expect(s.leden.map((l) => l.kleur)).toHaveLength(3);
    expect(s.feedSleutel).toBe("sleutel");
    expect(() => pasToe(s, { type: "gezin.instellen", gezinsnaam: "", leden: [{ naam: "X", rol: "ouder" }] }, ctx())).toThrow();
  });

  it("alleen ouders zijn eigenaar en kunnen acties doen", () => {
    const s = gezin();
    expect(() => pasToe(s, taak({ eigenaar: "k" }), ctx())).toThrow(/geen ouder/);
    expect(() => pasToe(s, taak(), ctx("k"))).toThrow(/geen ouder/);
  });

  it("afvinken legt een momentopname vast", () => {
    let s = pasToe(gezin(), taak(), ctx());
    const id = s.taken[0].id;
    s = pasToe(s, { type: "taak.afvinken", taakId: id, datum: "2026-11-02", gedaanDoor: "b" }, ctx());
    s = pasToe(s, { type: "taak.overdragen", taakId: id, naar: "b" }, ctx());
    expect(s.voltooiingen[0]).toMatchObject({ gedaanDoor: "b", eigenaar: "a", denkwerk: 3, duurMin: 20, status: "gedaan" });
    expect(s.taken[0].eigenaar).toBe("b");
  });

  it("een taak met geschiedenis wordt gearchiveerd in plaats van verwijderd", () => {
    let s = pasToe(gezin(), taak(), ctx());
    const id = s.taken[0].id;
    s = pasToe(s, { type: "taak.afvinken", taakId: id, datum: "2026-11-02" }, ctx());
    s = pasToe(s, { type: "taak.verwijderen", id }, ctx());
    expect(s.taken[0].gearchiveerd).toBe(true);
  });

  it("verhoogt de versie en laat de oude staat ongemoeid", () => {
    const s = gezin();
    const t = pasToe(s, taak(), ctx());
    expect(t.versie).toBe(s.versie + 1);
    expect(s.taken).toHaveLength(0);
  });

  it("zet webcal om naar https en weigert http", () => {
    const s = pasToe(gezin(), { type: "agenda.opslaan", agenda: { naam: "Werk", url: "webcal://p01.icloud.com/x.ics", lid: "a" } }, ctx());
    expect(s.agendas[0].url).toBe("https://p01.icloud.com/x.ics");
    expect(() => pasToe(s, { type: "agenda.opslaan", agenda: { naam: "X", url: "http://x.nl/a.ics", lid: "a" } }, ctx())).toThrow();
  });

  it("een nieuw gesprek start een nieuwe ronde inschattingen", () => {
    let s = pasToe(gezin(), { type: "inschatting.opslaan", denkwerk: 60, uitvoeren: 50 }, ctx("a"));
    expect(inschattingenVanRonde(s).allemaal).toBe(false);
    s = pasToe(s, { type: "inschatting.opslaan", denkwerk: 50, uitvoeren: 50 }, ctx("b"));
    expect(inschattingenVanRonde(s).allemaal).toBe(true);
    s = pasToe(s, { type: "gesprek.opslaan", datum: "2026-11-21", afspraken: "B neemt het weekmenu over" }, ctx());
    expect(s.ronde).toBe(2);
    expect(inschattingenVanRonde(s).allemaal).toBe(false);
  });
});

describe("open taken", () => {
  it("herhalende taken stapelen niet op, losse taken wel", () => {
    let s = pasToe(gezin(), taak({ herhaling: h("dagelijks") }), ctx());
    s = pasToe(s, taak({ titel: "Jassen kopen", herhaling: h("geen"), start: "2026-11-10" }), ctx());
    const open = openVoorvallen(s, "2026-11-21", "2026-11-21");
    expect(open.map((v) => `${v.taak.titel} ${v.datum}`)).toEqual(["Jassen kopen 2026-11-10", "Weekmenu 2026-11-20", "Weekmenu 2026-11-21"]);
  });
});

describe("inzicht", () => {
  it("denkwerk gaat naar de eigenaar, uitvoertijd naar wie het deed", () => {
    let s = pasToe(gezin(), taak(), ctx());
    const id = s.taken[0].id;
    s = pasToe(s, { type: "taak.afvinken", taakId: id, datum: "2026-11-02", gedaanDoor: "b" }, ctx());
    s = pasToe(s, { type: "taak.afvinken", taakId: id, datum: "2026-11-09", gedaanDoor: "a" }, ctx());
    s = pasToe(s, { type: "taak.afvinken", taakId: id, datum: "2026-11-16", gedaanDoor: "k" }, ctx());
    s = pasToe(s, { type: "opgemerkt.toevoegen", tekst: "Jassen te klein" }, ctx("b"));
    const i = berekenInzicht(s, "2026-11-01", "2026-11-21", "2026-11-21");
    const a = i.ouders.find((o) => o.lid.id === "a")!;
    const b = i.ouders.find((o) => o.lid.id === "b")!;
    expect(a.denkwerk).toBe(9); // 3 keer zwaar
    expect(b.denkwerk).toBe(1); // opgemerkt
    expect(a.uitvoerMin).toBe(20);
    expect(b.uitvoerMin).toBe(20);
    expect(b.overgenomen).toBe(1);
    expect(i.kinderenMin).toBe(20);
    expect(a.aandeelDenkwerk).toBeCloseTo(0.9);
  });

  it("toekomstige keren tellen niet mee, gemiste keren wel als denkwerk", () => {
    const s = pasToe(gezin(), taak(), ctx());
    const i = berekenInzicht(s, "2026-11-01", "2026-11-30", "2026-11-21");
    const a = i.ouders.find((o) => o.lid.id === "a")!;
    expect(a.denkwerk).toBe(9); // 2, 9 en 16 november; 23 en 30 nog niet
    expect(a.blijvenLiggen).toBe(3);
  });

  it("afspraken die je regelt tellen mee", () => {
    const s = pasToe(
      gezin(),
      {
        type: "afspraak.opslaan",
        afspraak: { titel: "Zwemles", datum: "2026-11-04", begin: "15:30", eind: "16:15", leden: ["k"], regelaar: "b", herhaling: h("wekelijks") },
      },
      ctx(),
    );
    const i = berekenInzicht(s, "2026-11-01", "2026-11-21", "2026-11-21");
    const b = i.ouders.find((o) => o.lid.id === "b")!;
    expect(b.uitRegelen).toBe(3);
    expect(b.uitvoerMin).toBe(135);
  });

  it("structurele verdeling per week", () => {
    const s = pasToe(gezin(), taak({ herhaling: h("wekelijks", 1, [1, 4]), uitvoerder: "b" }), ctx());
    const v = structureleVerdeling(s);
    expect(v.a.denkwerk).toBe(6);
    expect(v.b.uitvoerMin).toBe(40);
  });

  it("de demo geeft een herkenbaar beeld", () => {
    const nu = DateTime.fromISO("2026-11-21T12:00:00", { zone: "Europe/Amsterdam" });
    const s = demoStaat(nu);
    const i = berekenInzicht(s, "2026-10-24", "2026-11-21", "2026-11-21");
    const anna = i.ouders.find((o) => o.lid.id === "anna")!;
    expect(i.genoegGegevens).toBe(true);
    expect(anna.aandeelDenkwerk).toBeGreaterThan(0.6);
    expect(anna.aandeelUitvoeren).toBeLessThan(anna.aandeelDenkwerk);
  });
});

describe("agenda-items", () => {
  it("toont afspraken en taken met tijd of 'in agenda'", () => {
    let s = pasToe(gezin(), taak({ tijd: "19:00" }), ctx());
    s = pasToe(s, taak({ titel: "Zonder tijd" }), ctx());
    s = pasToe(s, { type: "afspraak.opslaan", afspraak: { titel: "Feest", datum: "2026-11-21", heleDag: true, leden: ["k"], herhaling: h("geen") } }, ctx());
    const items = appItems(s, "2026-11-16", "2026-11-22");
    expect(items.map((i) => i.titel)).toEqual(["Weekmenu", "Feest"]);
    expect(items[0]).toMatchObject({ begin: "19:00", eind: "19:20" });
  });
});

describe("opslaan", () => {
  it("de eerste wijziging in een lege opslag lukt, ook met de demo", async () => {
    const { GeheugenOpslag, gebruikOpslag } = await import("@/lib/opslag");
    const { voerUit, laadStaat } = await import("@/lib/dienst");
    gebruikOpslag(new GeheugenOpslag());
    const s = await voerUit({ type: "opgemerkt.toevoegen", tekst: "Test" }, "anna");
    expect(s.opgemerkt.some((o) => o.tekst === "Test")).toBe(true);
    expect((await laadStaat()).versie).toBe(s.versie);
    await voerUit({ type: "opgemerkt.toevoegen", tekst: "Nog een" }, "bram");
    expect((await laadStaat()).opgemerkt.filter((o) => o.tekst === "Nog een")).toHaveLength(1);
    gebruikOpslag(null);
  });

  it("weigert schrijven met een verouderde versie", async () => {
    const { GeheugenOpslag } = await import("@/lib/opslag");
    const o = new GeheugenOpslag();
    expect(await o.zetAls("k", 0, 1, "a")).toBe(true);
    expect(await o.zetAls("k", 0, 1, "b")).toBe(false);
    expect(await o.lees("k")).toBe("a");
  });
});
