import { z } from "zod";

/** Datum als JJJJ-MM-DD (in de tijdzone van het gezin). */
export const Datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum moet JJJJ-MM-DD zijn");
/** Kloktijd als UU:MM. */
export const Klok = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Tijd moet UU:MM zijn");
export const Id = z.string().min(1).max(64);

export const KLEUREN = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#64748b"];

export const LidSchema = z.object({
  id: Id,
  naam: z.string().trim().min(1).max(40),
  rol: z.enum(["ouder", "kind"]),
  kleur: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  geboortejaar: z.number().int().min(1900).max(2100).optional(),
});
export type Lid = z.infer<typeof LidSchema>;

export const CATEGORIEEN = {
  huishouden: "Huishouden",
  eten: "Eten en boodschappen",
  kinderen: "Kinderen en zorg",
  school: "School en opvang",
  gezondheid: "Gezondheid",
  financien: "Geld en administratie",
  sociaal: "Familie en sociaal",
  onderhoud: "Huis, auto en tuin",
  overig: "Overig",
} as const;
export type Categorie = keyof typeof CATEGORIEEN;
export const CategorieSchema = z.enum(Object.keys(CATEGORIEEN) as [Categorie, ...Categorie[]]);

export const HerhalingSchema = z.object({
  soort: z.enum(["geen", "dagelijks", "wekelijks", "maandelijks", "jaarlijks"]),
  /** Elke N dagen, weken, maanden of jaren. */
  interval: z.number().int().min(1).max(52).default(1),
  /** Bij wekelijks: ISO-weekdagen (1 = maandag ... 7 = zondag). Leeg = de weekdag van de startdatum. */
  dagen: z.array(z.number().int().min(1).max(7)).max(7).default([]),
  /** Laatste datum (inclusief), optioneel. */
  tot: Datum.optional(),
});
export type Herhaling = z.infer<typeof HerhalingSchema>;
export const GEEN_HERHALING: Herhaling = { soort: "geen", interval: 1, dagen: [] };

/**
 * Denkwerk: hoeveel er in je hoofd zit om een taak goed te laten gaan
 * (eraan denken, plannen, afstemmen, controleren), los van de tijd die het uitvoeren kost.
 */
export const DENKWERK = {
  1: { naam: "Licht", uitleg: "Gaat bijna vanzelf, weinig om aan te denken" },
  2: { naam: "Gemiddeld", uitleg: "Je moet het op tijd voorzien of iets afstemmen" },
  3: { naam: "Zwaar", uitleg: "Vooruitdenken, keuzes maken, afstemmen met anderen en bewaken" },
} as const;
export const DenkwerkSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type Denkwerk = z.infer<typeof DenkwerkSchema>;

export const TaakSchema = z.object({
  id: Id,
  titel: z.string().trim().min(1).max(120),
  categorie: CategorieSchema,
  notitie: z.string().max(2000).default(""),
  /** Eerste keer dat de taak moet gebeuren. */
  start: Datum,
  /** Optioneel tijdstip; dan staat de taak als afspraak in de agenda-feed. */
  tijd: Klok.optional(),
  herhaling: HerhalingSchema,
  /** Geschatte tijd om de taak uit te voeren, in minuten. */
  duurMin: z.number().int().min(0).max(24 * 60),
  denkwerk: DenkwerkSchema,
  /** Wie houdt het in het hoofd: eraan denken, plannen, bewaken. null = nog niet verdeeld. */
  eigenaar: Id.nullable(),
  /** Wie voert het meestal uit. null = de eigenaar. */
  uitvoerder: Id.nullable().default(null),
  /** Voor welke gezinsleden de taak is (bijvoorbeeld een kind). */
  voor: z.array(Id).default([]),
  /** Ook tonen in de agenda-feed (Google/Apple). */
  inAgenda: z.boolean().default(false),
  aangemaaktDoor: Id,
  aangemaaktOp: z.string(),
  gearchiveerd: z.boolean().default(false),
});
export type Taak = z.infer<typeof TaakSchema>;

export const VoltooiingSchema = z.object({
  id: Id,
  taakId: Id,
  /** De datum van het voorval (niet per se de dag waarop het gedaan is). */
  datum: Datum,
  status: z.enum(["gedaan", "overgeslagen"]),
  gedaanDoor: Id.nullable(),
  /** Momentopname: wie op dat moment eigenaar was, en hoe zwaar en lang de taak was. */
  eigenaar: Id.nullable(),
  denkwerk: DenkwerkSchema,
  duurMin: z.number().int().min(0).max(24 * 60),
  op: z.string(),
});
export type Voltooiing = z.infer<typeof VoltooiingSchema>;

export const AfspraakSchema = z.object({
  id: Id,
  titel: z.string().trim().min(1).max(120),
  datum: Datum,
  heleDag: z.boolean().default(false),
  begin: Klok.optional(),
  eind: Klok.optional(),
  /** Voor wie de afspraak is. */
  leden: z.array(Id).min(1),
  /** Welke ouder het regelt (brengen, halen, erbij zijn). Telt mee in de inzichten. */
  regelaar: Id.nullable().default(null),
  locatie: z.string().max(200).default(""),
  notitie: z.string().max(2000).default(""),
  herhaling: HerhalingSchema,
  aangemaaktDoor: Id,
  aangemaaktOp: z.string(),
});
export type Afspraak = z.infer<typeof AfspraakSchema>;

/** Een agenda van buiten (Google of Apple) die de app inleest via een iCal-adres. */
export const ExterneAgendaSchema = z.object({
  id: Id,
  naam: z.string().trim().min(1).max(60),
  url: z.string().url().max(2000),
  lid: Id,
  /** Alleen "Bezet" tonen, zonder titels. */
  alleenBezet: z.boolean().default(false),
});
export type ExterneAgenda = z.infer<typeof ExterneAgendaSchema>;

/** Iets wat iemand opmerkt en vastlegt ("de winterjassen zijn te klein"). Telt als denkwerk. */
export const OpgemerktSchema = z.object({
  id: Id,
  tekst: z.string().trim().min(1).max(500),
  door: Id,
  op: z.string(),
  afgehandeld: z.boolean().default(false),
  taakId: Id.optional(),
});
export type Opgemerkt = z.infer<typeof OpgemerktSchema>;

/** Hoe groot iemand zijn eigen aandeel inschat (0 tot 100), vóór het gesprek. */
export const InschattingSchema = z.object({
  door: Id,
  ronde: z.number().int().min(1),
  denkwerk: z.number().int().min(0).max(100),
  uitvoeren: z.number().int().min(0).max(100),
  op: z.string(),
});
export type Inschatting = z.infer<typeof InschattingSchema>;

/** Een gesprek over de verdeling, met de afspraken die jullie maakten. */
export const GesprekSchema = z.object({
  id: Id,
  ronde: z.number().int().min(1),
  datum: Datum,
  afspraken: z.string().max(4000),
  op: z.string(),
});
export type Gesprek = z.infer<typeof GesprekSchema>;

export const StaatSchema = z.object({
  versie: z.number().int().min(0),
  gezinsnaam: z.string().max(60).default(""),
  leden: z.array(LidSchema).default([]),
  taken: z.array(TaakSchema).default([]),
  voltooiingen: z.array(VoltooiingSchema).default([]),
  afspraken: z.array(AfspraakSchema).default([]),
  agendas: z.array(ExterneAgendaSchema).default([]),
  opgemerkt: z.array(OpgemerktSchema).default([]),
  inschattingen: z.array(InschattingSchema).default([]),
  gesprekken: z.array(GesprekSchema).default([]),
  /** Huidige ronde van inschattingen; na een gesprek begint een nieuwe ronde. */
  ronde: z.number().int().min(1).default(1),
  /** Geheim stukje van de adressen van de agenda-feeds. */
  feedSleutel: z.string().default(""),
});
export type Staat = z.infer<typeof StaatSchema>;

export function legeStaat(): Staat {
  return StaatSchema.parse({ versie: 0 });
}
