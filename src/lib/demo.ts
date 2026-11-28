import type { DateTime } from "luxon";
import { afdelingVan } from "./boodschappen";
import { alsDatum, maandagVan, plusDagen } from "./datum";
import { voorvallen } from "./herhaling";
import { aandeelUitKaartjes, kaartjes } from "./inzicht";
import { SJABLONEN } from "./sjablonen";
import { StaatSchema, type Afspraak, type Staat, type Taak, type Voltooiing } from "./types";

/** Een voorbeeldgezin met een paar weken geschiedenis, om de app te kunnen proberen. */
export function demoStaat(nu: DateTime): Staat {
  const vandaag = alsDatum(nu);
  const start = plusDagen(vandaag, -35);
  const leden = [
    { id: "anna", naam: "Anna", rol: "ouder" as const, kleur: "#db2777" },
    { id: "bram", naam: "Bram", rol: "ouder" as const, kleur: "#2563eb" },
    { id: "fien", naam: "Fien", rol: "kind" as const, kleur: "#16a34a", geboortejaar: nu.year - 7 },
    { id: "sem", naam: "Sem", rol: "kind" as const, kleur: "#ea580c", geboortejaar: nu.year - 4 },
  ];
  // Een herkenbaar patroon: uitvoeren is redelijk verdeeld, het denkwerk ligt vooral bij Anna.
  const eigenaarVan: Record<string, string | null> = {
    "Weekmenu bedenken": "anna",
    "Boodschappenlijst bijhouden": "anna",
    "Boodschappen doen": "bram",
    Koken: "anna",
    "Lunch en tussendoortjes kinderen klaarmaken": "anna",
    "Vaatwasser in- en uitruimen": "bram",
    "Was draaien en ophangen": "anna",
    "Was vouwen en opruimen": "anna",
    "Bedden verschonen": "anna",
    "Badkamer en wc schoonmaken": "bram",
    Stofzuigen: "bram",
    "Afval en papier buiten zetten": "bram",
    "Kinderen naar bed brengen": "anna",
    "Ochtendritme kinderen (aankleden, tassen)": "anna",
    "Kleding en schoenen kinderen nalopen (te klein?)": "anna",
    "Speelafspraken regelen": "anna",
    "Verjaardagspartijtjes: cadeau en vervoer": "anna",
    "Berichten van school en opvang lezen": "anna",
    "Gymtas en zwemspullen klaarzetten": "anna",
    "Vakanties en studiedagen: opvang plannen": "anna",
    "Tandarts en controles plannen": "anna",
    "Rekeningen en post afhandelen": "bram",
    "Verjaardagen familie en vrienden: kaart of cadeau": "anna",
    "Weekend plannen (uitjes, bezoek)": null,
    "Merken hoe het met de kinderen gaat (school, vriendjes)": "anna",
    "Troosten en er zijn bij verdriet of boosheid": "bram",
    "Opvoedvragen aankaarten (schermtijd, eten, slapen)": "anna",
    "Contact met opa's, oma's en familie onderhouden": "anna",
  };
  const uitvoerderVan: Record<string, string> = {
    Koken: "bram",
    "Kinderen naar bed brengen": "bram",
    "Was draaien en ophangen": "bram",
    "Gymtas en zwemspullen klaarzetten": "fien",
  };
  const op = `${start}T09:00:00.000+01:00`;
  const taken: Taak[] = SJABLONEN.filter((s) => s.standaard).map((s, i) => ({
    id: `t${i}`,
    titel: s.titel,
    categorie: s.categorie,
    notitie: s.denkwerkUitleg ?? "",
    start,
    herhaling: s.herhaling,
    duurMin: s.duurMin,
    denkwerk: s.denkwerk,
    werksoort: s.werksoort ?? "denkwerk",
    eigenaar: eigenaarVan[s.titel] ?? null,
    uitvoerder: uitvoerderVan[s.titel] ?? null,
    voor: s.categorie === "kinderen" || s.categorie === "school" ? ["fien", "sem"] : [],
    inAgenda: false,
    aangemaaktDoor: "anna",
    aangemaaktOp: op,
    gearchiveerd: false,
  }));
  taken.push({
    id: "los1",
    titel: "Winterjassen kopen",
    categorie: "kinderen",
    notitie: "Fien maat 128, Sem maat 110",
    start: plusDagen(vandaag, 2),
    herhaling: { soort: "geen", interval: 1, dagen: [] },
    duurMin: 90,
    denkwerk: 3,
    werksoort: "denkwerk",
    eigenaar: "anna",
    uitvoerder: "bram",
    voor: ["fien", "sem"],
    inAgenda: true,
    aangemaaktDoor: "anna",
    aangemaaktOp: `${plusDagen(vandaag, -6)}T20:15:00.000+01:00`,
    gearchiveerd: false,
  });

  // Geschiedenis: een vaste pseudo-willekeur, zodat de demo elke keer hetzelfde is.
  let zaad = 7;
  const kans = () => ((zaad = (zaad * 16807) % 2147483647) / 2147483647);
  const voltooiingen: Voltooiing[] = [];
  for (const t of taken) {
    for (const datum of voorvallen(t.start, t.herhaling, start, plusDagen(vandaag, -1))) {
      const r = kans();
      if (r < 0.12) continue; // bleef liggen
      const uitvoerder = t.uitvoerder ?? t.eigenaar ?? (r < 0.5 ? "anna" : "bram");
      // Soms neemt de ander het over.
      const door = r > 0.9 ? (uitvoerder === "anna" ? "bram" : "anna") : uitvoerder;
      voltooiingen.push({
        id: `v${voltooiingen.length}`,
        taakId: t.id,
        datum,
        status: r < 0.15 ? "overgeslagen" : "gedaan",
        gedaanDoor: r < 0.15 ? null : door,
        eigenaar: t.eigenaar,
        denkwerk: t.denkwerk,
        duurMin: r < 0.15 ? 0 : t.duurMin,
        op: `${datum}T19:00:00.000+01:00`,
      });
    }
  }

  const afspraak = (a: Partial<Afspraak> & Pick<Afspraak, "id" | "titel" | "datum" | "leden">): Afspraak => ({
    heleDag: false,
    regelaar: null,
    brengt: null,
    haalt: null,
    school: false,
    locatie: "",
    notitie: "",
    herhaling: { soort: "geen", interval: 1, dagen: [] },
    aangemaaktDoor: "anna",
    aangemaaktOp: op,
    ...a,
  });
  const maandag = alsDatum(nu.startOf("week").minus({ weeks: 5 }));
  const afspraken: Afspraak[] = [
    afspraak({ id: "a1", titel: "Zwemles", datum: plusDagen(maandag, 2), begin: "15:30", eind: "16:15", leden: ["fien"], regelaar: "anna", brengt: "anna", locatie: "Zwembad", herhaling: { soort: "wekelijks", interval: 1, dagen: [3] } }),
    afspraak({ id: "a2", titel: "Voetbal", datum: plusDagen(maandag, 5), begin: "09:00", eind: "10:00", leden: ["sem"], regelaar: "bram", brengt: "bram", haalt: "bram", herhaling: { soort: "wekelijks", interval: 1, dagen: [6] } }),
    afspraak({ id: "a3", titel: "Tandarts", datum: plusDagen(vandaag, 4), begin: "08:30", eind: "09:00", leden: ["fien", "sem"], regelaar: "anna" }),
    afspraak({ id: "a4", titel: "Studiedag school", datum: plusDagen(vandaag, 9), heleDag: true, leden: ["fien"], regelaar: "bram" }),
    afspraak({ id: "a5", titel: "Etentje met vrienden", datum: plusDagen(vandaag, 6), begin: "19:00", eind: "22:30", leden: ["anna", "bram"], aangemaaktDoor: "bram" }),
  ];

  const staat = StaatSchema.parse({
    versie: 0,
    gezinsnaam: "Gezin De Boer",
    leden,
    taken,
    voltooiingen,
    afspraken,
    agendas: [],
    opgemerkt: [
      { id: "o1", tekst: "Sem heeft bijna geen luiers meer voor de nacht", door: "anna", op: `${plusDagen(vandaag, -2)}T21:00:00.000+01:00`, afgehandeld: false },
      { id: "o2", tekst: "Cadeau voor oma's verjaardag (14 december)", door: "anna", op: `${plusDagen(vandaag, -9)}T21:00:00.000+01:00`, afgehandeld: false },
      { id: "o3", tekst: "Fietsband Fien zacht", door: "bram", op: `${plusDagen(vandaag, -4)}T08:00:00.000+01:00`, afgehandeld: true },
    ],
    inschattingen: [],
    gesprekken: [],
    ronde: 1,
    feedSleutel: "demo",
    keukenSleutel: "demo",
    inboxSleutel: "demo",
    regio: "midden",
    maaltijden: [
      ["Pasta pesto", "bram", ["pasta", "pesto", "cherrytomaten"]],
      ["Stamppot boerenkool", "anna", ["boerenkool", "aardappels", "rookworst"]],
      ["Taco's", "bram", ["tortilla's", "gehakt", "sla", "geraspte kaas"]],
      ["", null, []],
      ["Pannenkoeken", "bram", ["melk", "eieren", "bloem"]],
      ["Pizza", null, []],
      ["Soep met brood", "anna", ["soep", "stokbrood"]],
    ]
      .map(([wat, kok, ingredienten], i) => ({ datum: plusDagen(maandagVan(vandaag), i), wat, kok, ingredienten }))
      .filter((m) => m.wat),
    boodschappen: ["Melk", "Bananen", "Luiers maat 5", "Hagelslag", "Wc-papier", "Tortilla's"].map((naam, i) => ({
      id: `b${i}`,
      naam,
      afdeling: afdelingVan(naam),
      gekocht: false,
      door: i % 2 ? "bram" : "anna",
      op: `${vandaag}T08:00:00.000+01:00`,
    })),
  });
  // Bram heeft de kaartjesronde al gedaan: hij ziet het zware denkwerk vaker als "samen".
  staat.percepties = kaartjes(staat).map((t) => ({
    door: "bram",
    ronde: 1,
    taakId: t.id,
    antwoord: t.eigenaar === "bram" ? "ik" : t.eigenaar === "anna" ? (t.denkwerk >= 2 ? "samen" : "ander") : "weetniet",
  }));
  const bram = aandeelUitKaartjes(staat, "bram");
  staat.inschattingen = [
    { door: "bram", ronde: 1, denkwerk: bram.denkwerk ?? 50, emotioneel: bram.emotioneel ?? undefined, uitvoeren: 55, op: `${plusDagen(vandaag, -1)}T21:00:00.000+01:00` },
  ];
  return staat;
}
