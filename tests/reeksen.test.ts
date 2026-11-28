import { describe, expect, it } from "vitest";
import { pasToe, type Actie, type Context } from "@/lib/acties";
import { appItems } from "@/lib/agenda";
import { berekenInzicht } from "@/lib/inzicht";
import { legeStaat, type Lid, type Staat } from "@/lib/types";

const leden: Lid[] = [
  { id: "l", naam: "Lau", rol: "ouder", kleur: "#000000" },
  { id: "r", naam: "Roos", rol: "ouder", kleur: "#000000" },
  { id: "s", naam: "Stijn", rol: "kind", kleur: "#000000" },
  { id: "t", naam: "Tobias", rol: "kind", kleur: "#000000" },
];
let n = 0;
const ctx = (door = "l"): Context => ({ door, nu: "2026-11-28T10:00:00Z", nieuwId: () => `id${++n}`, nieuweSleutel: () => "k" });
const doe = (s: Staat, a: Actie, door = "l") => pasToe(s, a, ctx(door));

/** Elke dinsdag school, Lau brengt en haalt. Dinsdagen: 1, 8, 15, 22 december. */
function metSchool(): Staat {
  let s = pasToe(legeStaat(), { type: "gezin.instellen", gezinsnaam: "V", leden }, ctx());
  s = doe(s, {
    type: "afspraak.opslaan",
    afspraak: {
      id: "school",
      titel: "School",
      datum: "2026-12-01",
      begin: "08:30",
      eind: "15:00",
      leden: ["s", "t"],
      brengt: "l",
      haalt: "l",
      school: true,
      herhaling: { soort: "wekelijks", interval: 1, dagen: [2] },
    },
  });
  return s;
}
const december = (s: Staat) =>
  appItems(s, "2026-12-01", "2026-12-22")
    .filter((i) => i.soort === "afspraak")
    .map((i) => `${i.datum.slice(8)} ${i.titel} ${i.begin}-${i.eind} ${i.leden.join("+")} ↗${i.brengt} ↙${i.haalt}`);
const invoer = (extra: object = {}) => ({
  id: "school",
  titel: "School",
  datum: "2026-12-08",
  begin: "08:30",
  eind: "15:00",
  leden: ["s", "t"],
  brengt: "l",
  haalt: "l",
  school: true,
  herhaling: { soort: "wekelijks" as const, interval: 1, dagen: [2] },
  ...extra,
});

describe("alleen deze keer", () => {
  it("past alleen die dinsdag aan", () => {
    const s = doe(metSchool(), { type: "afspraak.opslaan", afspraak: invoer({ haalt: "r", eind: "12:30" }), origineel: "2026-12-08", bereik: "deze" });
    expect(december(s)).toEqual([
      "01 School 08:30-15:00 s+t ↗l ↙l",
      "08 School 08:30-12:30 s+t ↗l ↙r",
      "15 School 08:30-15:00 s+t ↗l ↙l",
      "22 School 08:30-15:00 s+t ↗l ↙l",
    ]);
  });

  it("verzetten naar een andere dag", () => {
    const s = doe(metSchool(), { type: "afspraak.opslaan", afspraak: invoer({ datum: "2026-12-09" }), origineel: "2026-12-08", bereik: "deze" });
    expect(december(s).map((x) => x.slice(0, 2))).toEqual(["01", "09", "15", "22"]);
  });

  it("een latere wijziging aan de reeks laat de aangepaste keer met rust", () => {
    let s = doe(metSchool(), { type: "afspraak.opslaan", afspraak: invoer({ haalt: "r" }), origineel: "2026-12-08", bereik: "deze" });
    s = doe(s, { type: "afspraak.opslaan", afspraak: invoer({ begin: "08:15" }), origineel: "2026-12-15", bereik: "reeks" });
    expect(december(s)).toEqual([
      "01 School 08:15-15:00 s+t ↗l ↙l",
      "08 School 08:30-15:00 s+t ↗l ↙r",
      "15 School 08:15-15:00 s+t ↗l ↙l",
      "22 School 08:15-15:00 s+t ↗l ↙l",
    ]);
    // De reeks begint nog steeds op 1 december.
    expect(s.afspraken[0].datum).toBe("2026-12-01");
  });

  it("verwijderen", () => {
    const s = doe(metSchool(), { type: "afspraak.verwijderen", id: "school", origineel: "2026-12-08", bereik: "deze" });
    expect(december(s).map((x) => x.slice(0, 2))).toEqual(["01", "15", "22"]);
  });
});

describe("deze en de volgende", () => {
  it("knipt de reeks: tot 14 december zoals het was, daarna anders", () => {
    const s = doe(metSchool(), { type: "afspraak.opslaan", afspraak: invoer({ datum: "2026-12-15", brengt: "r", haalt: "r" }), origineel: "2026-12-15", bereik: "volgende" });
    expect(december(s)).toEqual([
      "01 School 08:30-15:00 s+t ↗l ↙l",
      "08 School 08:30-15:00 s+t ↗l ↙l",
      "15 School 08:30-15:00 s+t ↗r ↙r",
      "22 School 08:30-15:00 s+t ↗r ↙r",
    ]);
    expect(s.afspraken).toHaveLength(2);
    expect(s.afspraken[0].herhaling.tot).toBe("2026-12-14");
  });

  it("verwijderen vanaf een dag", () => {
    const s = doe(metSchool(), { type: "afspraak.verwijderen", id: "school", origineel: "2026-12-15", bereik: "volgende" });
    expect(december(s).map((x) => x.slice(0, 2))).toEqual(["01", "08"]);
  });

  it("vanaf de eerste keer is het de hele reeks", () => {
    const s = doe(metSchool(), { type: "afspraak.opslaan", afspraak: invoer({ datum: "2026-12-01", brengt: "r" }), origineel: "2026-12-01", bereik: "volgende" });
    expect(s.afspraken).toHaveLength(1);
    expect(s.afspraken[0].brengt).toBe("r");
  });
});

describe("per kind splitsen", () => {
  it("deze keer brengt Roos Tobias; Stijn blijft bij Lau", () => {
    const s = doe(metSchool(), { type: "afspraak.ritten", id: "school", origineel: "2026-12-08", bereik: "deze", brengt: "r", haalt: "l", voor: ["t"] });
    expect(december(s)).toEqual([
      "01 School 08:30-15:00 s+t ↗l ↙l",
      "08 School 08:30-15:00 s ↗l ↙l",
      "08 School 08:30-15:00 t ↗r ↙l",
      "15 School 08:30-15:00 s+t ↗l ↙l",
      "22 School 08:30-15:00 s+t ↗l ↙l",
    ]);
  });

  it("voortaan (deze en volgende) per kind", () => {
    const s = doe(metSchool(), { type: "afspraak.ritten", id: "school", origineel: "2026-12-15", bereik: "volgende", brengt: "r", haalt: "r", voor: ["t"] });
    expect(december(s)).toEqual([
      "01 School 08:30-15:00 s+t ↗l ↙l",
      "08 School 08:30-15:00 s+t ↗l ↙l",
      "15 School 08:30-15:00 s ↗l ↙l",
      "15 School 08:30-15:00 t ↗r ↙r",
      "22 School 08:30-15:00 s ↗l ↙l",
      "22 School 08:30-15:00 t ↗r ↙r",
    ]);
  });

  it("zonder kinderkeuze: alleen de rollen van deze keer", () => {
    const s = doe(metSchool(), { type: "afspraak.ritten", id: "school", origineel: "2026-12-08", bereik: "deze", brengt: "r", haalt: "r" });
    expect(december(s)[1]).toBe("08 School 08:30-15:00 s+t ↗r ↙r");
    expect(s.afspraken).toHaveLength(1);
  });
});

describe("een vraag geldt voor die ene keer", () => {
  it("Roos haalt op 8 december, niet elke dinsdag", () => {
    let s = metSchool();
    s = doe(s, { type: "verzoek.sturen", aan: "r", soort: "halen", titel: "School", datum: "2026-12-08", origineel: "2026-12-08", afspraakId: "school", leden: ["s", "t"] });
    s = doe(s, { type: "verzoek.beantwoorden", id: s.verzoeken[0].id, ja: true }, "r");
    expect(december(s).map((x) => x.split(" ").at(-1))).toEqual(["↙l", "↙r", "↙l", "↙l"]);
  });
});

describe("het inzicht telt de aangepaste keren", () => {
  it("brengen en halen per keer", () => {
    const s = doe(metSchool(), { type: "afspraak.ritten", id: "school", origineel: "2026-12-08", bereik: "deze", brengt: "r", haalt: "r" });
    const i = berekenInzicht(s, "2026-12-01", "2026-12-14", "2026-12-14");
    expect(i.ouders.find((o) => o.lid.id === "r")!.ritten).toBe(2);
    expect(i.ouders.find((o) => o.lid.id === "l")!.ritten).toBe(2);
  });
});
