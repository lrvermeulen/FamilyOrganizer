import type { Categorie, Denkwerk, Herhaling, Werksoort } from "./types";

export interface Sjabloon {
  titel: string;
  categorie: Categorie;
  herhaling: Herhaling;
  duurMin: number;
  denkwerk: Denkwerk;
  werksoort?: Werksoort;
  /** Een korte uitleg wat het denkwerk is: dat is wat vaak onzichtbaar blijft. */
  denkwerkUitleg?: string;
  /** Standaard aangevinkt in de startlijst. */
  standaard?: boolean;
}

const w = (dagen: number[] = [], interval = 1): Herhaling => ({ soort: "wekelijks", interval, dagen });
const d = (interval = 1): Herhaling => ({ soort: "dagelijks", interval, dagen: [] });
const m = (interval = 1): Herhaling => ({ soort: "maandelijks", interval, dagen: [] });
const j = (): Herhaling => ({ soort: "jaarlijks", interval: 1, dagen: [] });
/** Doorlopend: ongeveer n keer per week. */
const dl = (n: number): Herhaling => ({ soort: "doorlopend", interval: n, dagen: [] });

/**
 * Taken die in veel gezinnen met jonge kinderen terugkomen. Zwaar denkwerk = vooruitdenken,
 * keuzes maken en afstemmen; dat is het deel dat in de meeste gezinnen het minst zichtbaar is.
 */
export const SJABLONEN: Sjabloon[] = [
  // Eten
  { titel: "Weekmenu bedenken", categorie: "eten", herhaling: w([7]), duurMin: 20, denkwerk: 3, denkwerkUitleg: "Wat eet iedereen, wat is er nog, wie is er wanneer?", standaard: true },
  { titel: "Boodschappenlijst bijhouden", categorie: "eten", herhaling: w([6]), duurMin: 10, denkwerk: 2, standaard: true },
  { titel: "Boodschappen doen", categorie: "eten", herhaling: w([6]), duurMin: 60, denkwerk: 1, standaard: true },
  { titel: "Koken", categorie: "eten", herhaling: d(), duurMin: 45, denkwerk: 2, standaard: true },
  { titel: "Lunch en tussendoortjes kinderen klaarmaken", categorie: "eten", herhaling: w([1, 2, 3, 4, 5]), duurMin: 15, denkwerk: 1, standaard: true },
  { titel: "Vaatwasser in- en uitruimen", categorie: "huishouden", herhaling: d(), duurMin: 15, denkwerk: 1, standaard: true },
  // Emotioneel werk: doorlopende verantwoordelijkheden zonder vaste momenten
  { titel: "Merken hoe het met de kinderen gaat (school, vriendjes)", categorie: "kinderen", herhaling: dl(3), duurMin: 15, denkwerk: 2, werksoort: "emotioneel", standaard: true },
  { titel: "Troosten en er zijn bij verdriet of boosheid", categorie: "kinderen", herhaling: dl(3), duurMin: 15, denkwerk: 2, werksoort: "emotioneel", standaard: true },
  { titel: "Opvoedvragen aankaarten (schermtijd, eten, slapen)", categorie: "kinderen", herhaling: dl(1), duurMin: 15, denkwerk: 3, werksoort: "emotioneel", standaard: true },
  { titel: "Contact met opa's, oma's en familie onderhouden", categorie: "sociaal", herhaling: dl(1), duurMin: 20, denkwerk: 2, werksoort: "emotioneel", standaard: true },
  { titel: "Contact met juf, meester en opvang", categorie: "school", herhaling: dl(1), duurMin: 10, denkwerk: 2, werksoort: "emotioneel" },
  // Huishouden
  { titel: "Was draaien en ophangen", categorie: "huishouden", herhaling: w([1, 4, 6]), duurMin: 30, denkwerk: 1, standaard: true },
  { titel: "Was vouwen en opruimen", categorie: "huishouden", herhaling: w([2, 7]), duurMin: 25, denkwerk: 1, standaard: true },
  { titel: "Bedden verschonen", categorie: "huishouden", herhaling: w([6], 2), duurMin: 40, denkwerk: 1, standaard: true },
  { titel: "Badkamer en wc schoonmaken", categorie: "huishouden", herhaling: w([6]), duurMin: 40, denkwerk: 1, standaard: true },
  { titel: "Stofzuigen", categorie: "huishouden", herhaling: w([3, 6]), duurMin: 30, denkwerk: 1, standaard: true },
  { titel: "Afval en papier buiten zetten", categorie: "huishouden", herhaling: w([3]), duurMin: 5, denkwerk: 2, denkwerkUitleg: "Weten welke bak wanneer", standaard: true },
  { titel: "Huishoudspullen aanvullen (wc-papier, wasmiddel)", categorie: "huishouden", herhaling: w([], 2), duurMin: 10, denkwerk: 2, denkwerkUitleg: "Zien dat het bijna op is" },
  // Kinderen
  { titel: "Kinderen naar bed brengen", categorie: "kinderen", herhaling: d(), duurMin: 30, denkwerk: 1, standaard: true },
  { titel: "Ochtendritme kinderen (aankleden, tassen)", categorie: "kinderen", herhaling: w([1, 2, 3, 4, 5]), duurMin: 30, denkwerk: 2, standaard: true },
  { titel: "Kleding en schoenen kinderen nalopen (te klein?)", categorie: "kinderen", herhaling: m(3), duurMin: 30, denkwerk: 3, denkwerkUitleg: "Zien wat te klein wordt, maten weten, kopen", standaard: true },
  { titel: "Speelafspraken regelen", categorie: "kinderen", herhaling: w(), duurMin: 10, denkwerk: 2, standaard: true },
  { titel: "Oppas regelen", categorie: "kinderen", herhaling: m(), duurMin: 15, denkwerk: 3, denkwerkUitleg: "Vooruitkijken, mensen vragen, afstemmen" },
  { titel: "Verjaardagspartijtjes: cadeau en vervoer", categorie: "sociaal", herhaling: m(), duurMin: 45, denkwerk: 3, standaard: true },
  { titel: "Luizencontrole", categorie: "kinderen", herhaling: w([3]), duurMin: 10, denkwerk: 1 },
  // School en opvang
  { titel: "Berichten van school en opvang lezen", categorie: "school", herhaling: w([1, 4]), duurMin: 10, denkwerk: 2, standaard: true },
  { titel: "Gymtas en zwemspullen klaarzetten", categorie: "school", herhaling: w([2]), duurMin: 5, denkwerk: 2, standaard: true },
  { titel: "Vakanties en studiedagen: opvang plannen", categorie: "school", herhaling: m(2), duurMin: 30, denkwerk: 3, standaard: true },
  { titel: "Clubs en lessen: inschrijven en betalen", categorie: "school", herhaling: m(6), duurMin: 30, denkwerk: 3 },
  // Gezondheid
  { titel: "Tandarts en controles plannen", categorie: "gezondheid", herhaling: m(6), duurMin: 15, denkwerk: 2, standaard: true },
  { titel: "Medicijnen en EHBO-spullen aanvullen", categorie: "gezondheid", herhaling: m(3), duurMin: 15, denkwerk: 2 },
  // Geld en administratie
  { titel: "Rekeningen en post afhandelen", categorie: "financien", herhaling: w([], 2), duurMin: 30, denkwerk: 2, standaard: true },
  { titel: "Abonnementen en verzekeringen nalopen", categorie: "financien", herhaling: j(), duurMin: 90, denkwerk: 3 },
  { titel: "Belastingaangifte", categorie: "financien", herhaling: j(), duurMin: 180, denkwerk: 3 },
  // Sociaal
  { titel: "Verjaardagen familie en vrienden: kaart of cadeau", categorie: "sociaal", herhaling: m(), duurMin: 30, denkwerk: 3, denkwerkUitleg: "Onthouden, iets bedenken, op tijd versturen", standaard: true },
  { titel: "Weekend plannen (uitjes, bezoek)", categorie: "sociaal", herhaling: w([4]), duurMin: 15, denkwerk: 2, standaard: true },
  // Emotioneel werk: doorlopende verantwoordelijkheden zonder vaste momenten
  { titel: "Merken hoe het met de kinderen gaat (school, vriendjes)", categorie: "kinderen", herhaling: dl(3), duurMin: 15, denkwerk: 2, werksoort: "emotioneel", standaard: true },
  { titel: "Troosten en er zijn bij verdriet of boosheid", categorie: "kinderen", herhaling: dl(3), duurMin: 15, denkwerk: 2, werksoort: "emotioneel", standaard: true },
  { titel: "Opvoedvragen aankaarten (schermtijd, eten, slapen)", categorie: "kinderen", herhaling: dl(1), duurMin: 15, denkwerk: 3, werksoort: "emotioneel", standaard: true },
  { titel: "Contact met opa's, oma's en familie onderhouden", categorie: "sociaal", herhaling: dl(1), duurMin: 20, denkwerk: 2, werksoort: "emotioneel", standaard: true },
  { titel: "Contact met juf, meester en opvang", categorie: "school", herhaling: dl(1), duurMin: 10, denkwerk: 2, werksoort: "emotioneel" },
  // Huis
  { titel: "Planten water geven", categorie: "onderhoud", herhaling: w([7]), duurMin: 10, denkwerk: 1 },
  { titel: "Tuin bijhouden", categorie: "onderhoud", herhaling: w([6], 2), duurMin: 60, denkwerk: 1 },
  { titel: "Auto: onderhoud, APK en banden", categorie: "onderhoud", herhaling: m(6), duurMin: 60, denkwerk: 2 },
  { titel: "Klusjes in huis (lampje, kraan)", categorie: "onderhoud", herhaling: m(), duurMin: 60, denkwerk: 2 },
];
