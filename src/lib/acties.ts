import { z } from "zod";
import { keerOp, splitsAfspraak, veldenVan, verwijderAfspraak, wijzigAfspraak } from "./afspraken";
import { afdelingVan } from "./boodschappen";
import {
  AfspraakSchema,
  CategorieSchema,
  Datum,
  DenkwerkSchema,
  ExterneAgendaSchema,
  HerhalingSchema,
  Id,
  KLEUREN,
  Klok,
  LidSchema,
  MaaltijdSchema,
  MeldingInstellingSchema,
  TaakSchema,
  WerksoortSchema,
  type Staat,
} from "./types";

const NieuwLid = LidSchema.omit({ id: true, kleur: true }).extend({
  id: Id.optional(),
  kleur: LidSchema.shape.kleur.optional(),
});

const TaakInvoer = z.object({
  id: Id.optional(),
  titel: TaakSchema.shape.titel,
  categorie: CategorieSchema,
  notitie: z.string().max(2000).default(""),
  start: Datum,
  tijd: Klok.optional(),
  herhaling: HerhalingSchema,
  duurMin: TaakSchema.shape.duurMin,
  denkwerk: DenkwerkSchema,
  werksoort: WerksoortSchema.default("denkwerk"),
  eigenaar: Id.nullable(),
  uitvoerder: Id.nullable().default(null),
  voor: z.array(Id).default([]),
  inAgenda: z.boolean().default(false),
});
export type TaakInvoer = z.input<typeof TaakInvoer>;

const AfspraakInvoer = AfspraakSchema.omit({ id: true, aangemaaktDoor: true, aangemaaktOp: true }).extend({
  id: Id.optional(),
});
export type AfspraakInvoer = z.input<typeof AfspraakInvoer>;

export const ActieSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("gezin.instellen"),
    gezinsnaam: z.string().trim().max(60),
    leden: z.array(NieuwLid).min(1).max(12),
    taken: z.array(TaakInvoer).max(100).default([]),
  }),
  z.object({ type: z.literal("gezin.naam"), gezinsnaam: z.string().trim().max(60) }),
  z.object({ type: z.literal("lid.opslaan"), lid: NieuwLid }),
  z.object({ type: z.literal("lid.verwijderen"), id: Id }),
  z.object({ type: z.literal("taak.opslaan"), taak: TaakInvoer }),
  z.object({ type: z.literal("taken.toevoegen"), taken: z.array(TaakInvoer).min(1).max(100) }),
  z.object({ type: z.literal("taak.verwijderen"), id: Id }),
  z.object({
    type: z.literal("taak.afvinken"),
    taakId: Id,
    datum: Datum,
    gedaanDoor: Id.optional(),
    duurMin: z.number().int().min(0).max(24 * 60).optional(),
  }),
  z.object({ type: z.literal("taak.overslaan"), taakId: Id, datum: Datum }),
  z.object({ type: z.literal("taak.verzetten"), taakId: Id, origineel: Datum, naar: Datum }),
  z.object({
    type: z.literal("verzoek.sturen"),
    aan: Id,
    soort: z.enum(["brengen", "halen", "taak"]),
    titel: z.string().trim().min(1).max(200),
    datum: Datum,
    tijd: Klok.optional(),
    afspraakId: Id.optional(),
    regelSleutel: z.string().max(600).optional(),
    leden: z.array(Id).max(12).default([]),
    taakId: Id.optional(),
    origineel: Datum.optional(),
    voortaan: z.boolean().default(false),
    bericht: z.string().trim().max(300).default(""),
  }),
  z.object({ type: z.literal("verzoek.beantwoorden"), id: Id, ja: z.boolean() }),
  z.object({ type: z.literal("verzoek.intrekken"), id: Id }),
  z.object({ type: z.literal("taak.ongedaan"), taakId: Id, datum: Datum }),
  z.object({
    type: z.literal("taak.overdragen"),
    taakId: Id,
    naar: Id.nullable(),
    /** true: het hele pakket (denkwerk én uitvoeren). false: alleen het denkwerk. */
    heelPakket: z.boolean().default(true),
  }),
  z.object({
    type: z.literal("afspraak.opslaan"),
    afspraak: AfspraakInvoer,
    /** Bij een herhalende afspraak: welke keer (oorspronkelijke dag) en wat je aanpast. Standaard de hele reeks. */
    origineel: Datum.optional(),
    bereik: z.enum(["deze", "volgende", "reeks"]).default("reeks"),
  }),
  z.object({
    type: z.literal("afspraak.verwijderen"),
    id: Id,
    origineel: Datum.optional(),
    bereik: z.enum(["deze", "volgende", "reeks"]).default("reeks"),
  }),
  z.object({
    type: z.literal("afspraak.ritten"),
    id: Id,
    origineel: Datum,
    bereik: z.enum(["deze", "volgende", "reeks"]).default("deze"),
    brengt: Id.nullable(),
    haalt: Id.nullable(),
    /** Alleen voor deze kinderen (de afspraak wordt dan gesplitst). Leeg of weggelaten: voor iedereen. */
    voor: z.array(Id).max(12).optional(),
  }),
  z.object({
    type: z.literal("agenda.opslaan"),
    // Een leeg adres bij een bestaande agenda: het oude adres houden.
    agenda: ExterneAgendaSchema.omit({ id: true }).extend({ id: Id.optional(), url: z.string().trim().max(2000) }),
  }),
  z.object({ type: z.literal("agenda.verwijderen"), id: Id }),
  z.object({
    type: z.literal("opgemerkt.toevoegen"),
    tekst: z.string().trim().min(1).max(2000),
    bron: z.enum(["zelf", "plakken", "foto", "delen"]).default("zelf"),
    /** Meteen verwerkt (bijvoorbeeld een geplakt bericht waar direct een afspraak van is gemaakt). */
    afgehandeld: z.boolean().default(false),
  }),
  z.object({ type: z.literal("opgemerkt.afhandelen"), id: Id, taakId: Id.optional() }),
  z.object({ type: z.literal("opgemerkt.verwijderen"), id: Id }),
  z.object({
    type: z.literal("inschatting.opslaan"),
    denkwerk: z.number().int().min(0).max(100),
    uitvoeren: z.number().int().min(0).max(100),
    emotioneel: z.number().int().min(0).max(100).optional(),
  }),
  z.object({
    type: z.literal("perceptie.opslaan"),
    taakId: Id,
    antwoord: z.enum(["ik", "ander", "samen", "weetniet", "nvt"]).nullable(),
  }),
  z.object({
    type: z.literal("extern.regelen"),
    sleutel: z.string().min(1).max(600),
    datum: Datum,
    titel: z.string().max(200),
    leden: z.array(Id).max(12).default([]),
    brengt: Id.nullable(),
    haalt: Id.nullable(),
  }),
  z.object({ type: z.literal("maaltijd.opslaan"), maaltijd: MaaltijdSchema }),
  z.object({
    type: z.literal("boodschappen.toevoegen"),
    namen: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
    voor: Datum.optional(),
  }),
  z.object({ type: z.literal("boodschap.afvinken"), id: Id, gekocht: z.boolean() }),
  z.object({ type: z.literal("boodschap.verwijderen"), id: Id }),
  z.object({ type: z.literal("boodschappen.opruimen") }),
  z.object({ type: z.literal("meldingen.instellen"), instelling: MeldingInstellingSchema.omit({ lid: true }) }),
  z.object({ type: z.literal("regio.instellen"), regio: z.enum(["noord", "midden", "zuid"]).nullable() }),
  z.object({ type: z.literal("sleutel.vernieuwen"), welke: z.enum(["keuken", "inbox"]) }),
  z.object({ type: z.literal("gesprek.opslaan"), datum: Datum, afspraken: z.string().max(4000) }),
  z.object({ type: z.literal("feed.vernieuwen") }),
]);
export type Actie = z.input<typeof ActieSchema>;

export interface Context {
  /** Het gezinslid dat de actie doet. */
  door: string;
  /** Nu, als ISO-tekst. */
  nu: string;
  nieuwId: () => string;
  nieuweSleutel: () => string;
}

export class ActieFout extends Error {}

function vind<T extends { id: string }>(lijst: T[], id: string, wat: string): T {
  const x = lijst.find((i) => i.id === id);
  if (!x) throw new ActieFout(`${wat} niet gevonden`);
  return x;
}

function controleerLid(staat: Staat, id: string | null | undefined, ouder = false) {
  if (id == null) return;
  const lid = staat.leden.find((l) => l.id === id);
  if (!lid) throw new ActieFout("Onbekend gezinslid");
  if (ouder && lid.rol !== "ouder") throw new ActieFout(`${lid.naam} is geen ouder`);
}

function bouwTaak(staat: Staat, invoer: z.output<typeof TaakInvoer>, ctx: Context) {
  controleerLid(staat, invoer.eigenaar, true);
  controleerLid(staat, invoer.uitvoerder);
  invoer.voor.forEach((v) => controleerLid(staat, v));
  const bestaand = invoer.id ? staat.taken.find((t) => t.id === invoer.id) : undefined;
  return TaakSchema.parse({
    ...invoer,
    id: bestaand?.id ?? invoer.id ?? ctx.nieuwId(),
    aangemaaktDoor: bestaand?.aangemaaktDoor ?? ctx.door,
    aangemaaktOp: bestaand?.aangemaaktOp ?? ctx.nu,
    gearchiveerd: false,
  });
}

/**
 * Past één actie toe en geeft een nieuwe staat terug (de oude blijft ongewijzigd).
 * Gooit een ActieFout bij ongeldige invoer.
 */
export function pasToe(oud: Staat, ruweActie: unknown, ctx: Context): Staat {
  const actie = ActieSchema.parse(ruweActie);
  const staat: Staat = structuredClone(oud);
  if (!staat.feedSleutel) staat.feedSleutel = ctx.nieuweSleutel();
  if (!staat.keukenSleutel) staat.keukenSleutel = ctx.nieuweSleutel();
  if (!staat.inboxSleutel) staat.inboxSleutel = ctx.nieuweSleutel();

  if (actie.type !== "gezin.instellen") {
    if (staat.leden.length === 0) throw new ActieFout("Stel eerst het gezin in");
    controleerLid(staat, ctx.door, true);
  }

  switch (actie.type) {
    case "gezin.instellen": {
      if (staat.leden.length > 0) throw new ActieFout("Het gezin is al ingesteld");
      staat.gezinsnaam = actie.gezinsnaam;
      staat.leden = actie.leden.map((l, i) =>
        LidSchema.parse({ ...l, id: l.id ?? ctx.nieuwId(), kleur: l.kleur ?? KLEUREN[i % KLEUREN.length] }),
      );
      if (!staat.leden.some((l) => l.rol === "ouder")) throw new ActieFout("Er moet minstens één ouder zijn");
      const door = staat.leden.find((l) => l.id === ctx.door)?.id ?? staat.leden.find((l) => l.rol === "ouder")!.id;
      for (const t of actie.taken) staat.taken.push(bouwTaak(staat, t, { ...ctx, door }));
      break;
    }
    case "gezin.naam":
      staat.gezinsnaam = actie.gezinsnaam;
      break;
    case "lid.opslaan": {
      const bestaand = actie.lid.id ? staat.leden.find((l) => l.id === actie.lid.id) : undefined;
      if (bestaand) {
        if (bestaand.rol === "ouder" && actie.lid.rol === "kind") {
          const inGebruik = staat.taken.some((t) => t.eigenaar === bestaand.id);
          if (inGebruik) throw new ActieFout("Draag eerst de taken van deze ouder over");
        }
        Object.assign(bestaand, LidSchema.parse({ ...bestaand, ...actie.lid, kleur: actie.lid.kleur ?? bestaand.kleur }));
        if (!bestaand.code) delete bestaand.code;
        if (!bestaand.groep) delete bestaand.groep;
      } else {
        staat.leden.push(
          LidSchema.parse({
            ...actie.lid,
            id: ctx.nieuwId(),
            kleur: actie.lid.kleur ?? KLEUREN[staat.leden.length % KLEUREN.length],
          }),
        );
      }
      if (!staat.leden.some((l) => l.rol === "ouder")) throw new ActieFout("Er moet minstens één ouder zijn");
      break;
    }
    case "lid.verwijderen": {
      vind(staat.leden, actie.id, "Gezinslid");
      if (actie.id === ctx.door) throw new ActieFout("Je kunt jezelf niet verwijderen");
      const inGebruik =
        staat.taken.some((t) => !t.gearchiveerd && (t.eigenaar === actie.id || t.uitvoerder === actie.id || t.voor.includes(actie.id))) ||
        staat.afspraken.some((a) => a.leden.includes(actie.id) || [a.regelaar, a.brengt, a.haalt].includes(actie.id)) ||
        staat.agendas.some((a) => a.lid === actie.id);
      if (inGebruik) throw new ActieFout("Dit gezinslid hangt nog aan taken, afspraken of agenda's");
      staat.leden = staat.leden.filter((l) => l.id !== actie.id);
      break;
    }
    case "taak.opslaan": {
      const taak = bouwTaak(staat, actie.taak, ctx);
      const i = staat.taken.findIndex((t) => t.id === taak.id);
      if (i >= 0) staat.taken[i] = taak;
      else staat.taken.push(taak);
      break;
    }
    case "taken.toevoegen":
      for (const t of actie.taken) staat.taken.push(bouwTaak(staat, { ...t, id: undefined }, ctx));
      break;
    case "taak.verwijderen": {
      const taak = vind(staat.taken, actie.id, "Taak");
      // Met geschiedenis: archiveren, zodat de inzichten kloppen.
      if (staat.voltooiingen.some((v) => v.taakId === taak.id)) taak.gearchiveerd = true;
      else staat.taken = staat.taken.filter((t) => t.id !== taak.id);
      break;
    }
    case "taak.afvinken":
    case "taak.overslaan": {
      const taak = vind(staat.taken, actie.taakId, "Taak");
      const gedaanDoor = actie.type === "taak.afvinken" ? (actie.gedaanDoor ?? ctx.door) : null;
      controleerLid(staat, gedaanDoor);
      staat.voltooiingen = staat.voltooiingen.filter((v) => !(v.taakId === taak.id && v.datum === actie.datum));
      staat.voltooiingen.push({
        id: ctx.nieuwId(),
        taakId: taak.id,
        datum: actie.datum,
        status: actie.type === "taak.afvinken" ? "gedaan" : "overgeslagen",
        gedaanDoor,
        eigenaar: taak.eigenaar,
        denkwerk: taak.denkwerk,
        duurMin: actie.type === "taak.afvinken" ? (actie.duurMin ?? taak.duurMin) : 0,
        op: ctx.nu,
      });
      break;
    }
    case "taak.verzetten": {
      const taak = vind(staat.taken, actie.taakId, "Taak");
      if (taak.herhaling.soort === "geen") {
        // Een losse taak verschuift gewoon.
        taak.start = actie.naar;
        break;
      }
      staat.verzettingen = staat.verzettingen.filter((v) => !(v.taakId === taak.id && v.origineel === actie.origineel));
      if (actie.naar !== actie.origineel) staat.verzettingen.push({ taakId: taak.id, origineel: actie.origineel, naar: actie.naar });
      break;
    }
    case "verzoek.sturen": {
      controleerLid(staat, actie.aan, true);
      if (actie.aan === ctx.door) throw new ActieFout("Je kunt het niet aan jezelf vragen");
      if (actie.soort === "taak") {
        vind(staat.taken, actie.taakId ?? "", "Taak");
        if (!actie.origineel) throw new ActieFout("Welke keer van de taak?");
      } else if (!actie.afspraakId && !actie.regelSleutel) {
        throw new ActieFout("Bij welke afspraak?");
      }
      // Een eerdere open vraag over hetzelfde vervalt.
      for (const v of staat.verzoeken) {
        const zelfde =
          v.status === "open" &&
          v.soort === actie.soort &&
          v.datum === actie.datum &&
          (v.afspraakId ?? v.regelSleutel ?? v.taakId) === (actie.afspraakId ?? actie.regelSleutel ?? actie.taakId);
        if (zelfde) v.status = "ingetrokken";
      }
      staat.verzoeken.push({ ...actie, id: ctx.nieuwId(), van: ctx.door, status: "open", op: ctx.nu });
      break;
    }
    case "verzoek.beantwoorden": {
      const v = vind(staat.verzoeken, actie.id, "Vraag");
      if (v.aan !== ctx.door) throw new ActieFout("Deze vraag is niet aan jou gesteld");
      if (v.status !== "open") throw new ActieFout("Deze vraag is al beantwoord of ingetrokken");
      v.status = actie.ja ? "ja" : "nee";
      v.antwoordOp = ctx.nu;
      if (!actie.ja) break;
      if (v.soort === "taak") {
        const taak = vind(staat.taken, v.taakId!, "Taak");
        if (v.voortaan) {
          // De hele taak: eraan denken, plannen en uitvoeren.
          taak.eigenaar = v.aan;
          taak.uitvoerder = null;
        } else {
          staat.toewijzingen = staat.toewijzingen.filter((t) => !(t.taakId === taak.id && t.origineel === v.origineel));
          staat.toewijzingen.push({ taakId: taak.id, origineel: v.origineel!, lid: v.aan });
        }
      } else {
        const rol = v.soort === "brengen" ? "brengt" : "haalt";
        const afspraak = v.afspraakId ? staat.afspraken.find((a) => a.id === v.afspraakId) : undefined;
        if (afspraak) {
          // Alleen die ene keer (bij een reeks), niet elke week.
          const keer = keerOp(afspraak, v.origineel ?? v.datum);
          if (keer) wijzigAfspraak(staat, afspraak, keer.origineel, "deze", { velden: { ...keer.velden, [rol]: v.aan }, datum: keer.datum }, ctx.nieuwId);
          else afspraak[rol] = v.aan;
        }
        else if (v.regelSleutel) {
          const r = staat.externRegelingen.find((x) => x.sleutel === v.regelSleutel);
          if (r) r[rol] = v.aan;
          else
            staat.externRegelingen.push({
              sleutel: v.regelSleutel,
              datum: v.datum,
              titel: v.titel,
              leden: v.leden,
              brengt: rol === "brengt" ? v.aan : null,
              haalt: rol === "haalt" ? v.aan : null,
            });
        }
      }
      break;
    }
    case "verzoek.intrekken": {
      const v = vind(staat.verzoeken, actie.id, "Vraag");
      if (v.van !== ctx.door) throw new ActieFout("Alleen wie het vroeg, kan de vraag intrekken");
      if (v.status === "open") v.status = "ingetrokken";
      break;
    }
    case "taak.ongedaan":
      staat.voltooiingen = staat.voltooiingen.filter((v) => !(v.taakId === actie.taakId && v.datum === actie.datum));
      break;
    case "taak.overdragen": {
      const taak = vind(staat.taken, actie.taakId, "Taak");
      controleerLid(staat, actie.naar, true);
      taak.eigenaar = actie.naar;
      if (actie.heelPakket) taak.uitvoerder = null;
      break;
    }
    case "afspraak.opslaan": {
      const a = actie.afspraak;
      a.leden.forEach((l) => controleerLid(staat, l));
      controleerLid(staat, a.regelaar, true);
      controleerLid(staat, a.brengt);
      controleerLid(staat, a.haalt);
      const bestaand = a.id ? staat.afspraken.find((x) => x.id === a.id) : undefined;
      const afspraak = AfspraakSchema.parse({
        ...a,
        id: bestaand?.id ?? a.id ?? ctx.nieuwId(),
        aangemaaktDoor: bestaand?.aangemaaktDoor ?? ctx.door,
        aangemaaktOp: bestaand?.aangemaaktOp ?? ctx.nu,
      });
      if (!afspraak.heleDag && !afspraak.begin) throw new ActieFout("Kies een begintijd of 'hele dag'");
      if (afspraak.begin && afspraak.eind && afspraak.eind <= afspraak.begin) {
        throw new ActieFout("De eindtijd moet na de begintijd liggen");
      }
      if (afspraak.haalVan && (!afspraak.eind || !afspraak.begin || afspraak.haalVan <= afspraak.begin || afspraak.haalVan > afspraak.eind)) {
        throw new ActieFout("Ophalen vanaf moet tussen de begin- en eindtijd liggen");
      }
      if (!bestaand) {
        staat.afspraken.push(afspraak);
        break;
      }
      // Een bestaande afspraak: bij een reeks alleen deze keer, deze en volgende, of de hele reeks.
      wijzigAfspraak(
        staat,
        bestaand,
        actie.origineel ?? bestaand.datum,
        actie.bereik,
        { velden: veldenVan(afspraak), datum: afspraak.datum, herhaling: afspraak.herhaling, school: afspraak.school },
        ctx.nieuwId,
      );
      break;
    }
    case "afspraak.verwijderen":
      verwijderAfspraak(staat, vind(staat.afspraken, actie.id, "Afspraak"), actie.origineel, actie.bereik);
      break;
    case "afspraak.ritten": {
      const a = vind(staat.afspraken, actie.id, "Afspraak");
      controleerLid(staat, actie.brengt);
      controleerLid(staat, actie.haalt);
      const rollen = { brengt: actie.brengt, haalt: actie.haalt };
      if (actie.voor?.length) splitsAfspraak(staat, a, actie.origineel, actie.bereik, actie.voor, rollen, ctx.nieuwId);
      else {
        const keer = keerOp(a, actie.origineel);
        if (!keer) throw new ActieFout("Deze keer bestaat niet (meer)");
        wijzigAfspraak(staat, a, actie.origineel, actie.bereik, { velden: { ...keer.velden, ...rollen }, datum: keer.datum }, ctx.nieuwId);
      }
      break;
    }
    case "agenda.opslaan": {
      const g = actie.agenda;
      controleerLid(staat, g.lid);
      const bestaand = g.id ? staat.agendas.find((x) => x.id === g.id) : undefined;
      const url = (g.url || bestaand?.url || "").trim().replace(/^webcal:\/\//i, "https://");
      if (!/^https:\/\/[^\s/]+\.[^\s]+$/i.test(url)) {
        throw new ActieFout("Gebruik een iCal-adres dat begint met https:// of webcal://");
      }
      const agenda = ExterneAgendaSchema.parse({ ...g, url, id: bestaand?.id ?? ctx.nieuwId() });
      if (bestaand) Object.assign(bestaand, agenda);
      else staat.agendas.push(agenda);
      break;
    }
    case "agenda.verwijderen":
      vind(staat.agendas, actie.id, "Agenda");
      staat.agendas = staat.agendas.filter((a) => a.id !== actie.id);
      break;
    case "opgemerkt.toevoegen":
      staat.opgemerkt.push({ id: ctx.nieuwId(), tekst: actie.tekst, door: ctx.door, op: ctx.nu, afgehandeld: actie.afgehandeld, bron: actie.bron });
      break;
    case "opgemerkt.afhandelen": {
      const o = vind(staat.opgemerkt, actie.id, "Notitie");
      o.afgehandeld = true;
      if (actie.taakId) o.taakId = actie.taakId;
      break;
    }
    case "opgemerkt.verwijderen":
      vind(staat.opgemerkt, actie.id, "Notitie");
      staat.opgemerkt = staat.opgemerkt.filter((o) => o.id !== actie.id);
      break;
    case "inschatting.opslaan":
      staat.inschattingen = staat.inschattingen.filter((i) => !(i.door === ctx.door && i.ronde === staat.ronde));
      staat.inschattingen.push({
        door: ctx.door,
        ronde: staat.ronde,
        denkwerk: actie.denkwerk,
        uitvoeren: actie.uitvoeren,
        emotioneel: actie.emotioneel,
        op: ctx.nu,
      });
      break;
    case "perceptie.opslaan":
      vind(staat.taken, actie.taakId, "Taak");
      staat.percepties = staat.percepties.filter(
        (p) => !(p.door === ctx.door && p.ronde === staat.ronde && p.taakId === actie.taakId),
      );
      if (actie.antwoord) {
        staat.percepties.push({ door: ctx.door, ronde: staat.ronde, taakId: actie.taakId, antwoord: actie.antwoord });
      }
      break;
    case "extern.regelen": {
      controleerLid(staat, actie.brengt);
      controleerLid(staat, actie.haalt);
      staat.externRegelingen = staat.externRegelingen.filter((r) => r.sleutel !== actie.sleutel);
      if (actie.brengt || actie.haalt) {
        staat.externRegelingen.push({
          sleutel: actie.sleutel,
          datum: actie.datum,
          titel: actie.titel,
          leden: actie.leden.filter((l) => staat.leden.some((x) => x.id === l)),
          brengt: actie.brengt,
          haalt: actie.haalt,
        });
      }
      break;
    }
    case "maaltijd.opslaan": {
      const m = actie.maaltijd;
      controleerLid(staat, m.kok);
      staat.maaltijden = staat.maaltijden.filter((x) => x.datum !== m.datum);
      if (m.wat || m.ingredienten.length) staat.maaltijden.push(m);
      staat.maaltijden.sort((a, b) => a.datum.localeCompare(b.datum));
      break;
    }
    case "boodschappen.toevoegen": {
      const open = new Set(staat.boodschappen.filter((b) => !b.gekocht).map((b) => b.naam.toLowerCase()));
      for (const naam of actie.namen) {
        // Wat al op de lijst staat, niet dubbel.
        if (open.has(naam.toLowerCase())) continue;
        open.add(naam.toLowerCase());
        staat.boodschappen.push({ id: ctx.nieuwId(), naam, afdeling: afdelingVan(naam), gekocht: false, door: ctx.door, op: ctx.nu, voor: actie.voor });
      }
      break;
    }
    case "boodschap.afvinken":
      vind(staat.boodschappen, actie.id, "Boodschap").gekocht = actie.gekocht;
      break;
    case "boodschap.verwijderen":
      vind(staat.boodschappen, actie.id, "Boodschap");
      staat.boodschappen = staat.boodschappen.filter((b) => b.id !== actie.id);
      break;
    case "boodschappen.opruimen":
      staat.boodschappen = staat.boodschappen.filter((b) => !b.gekocht);
      break;
    case "meldingen.instellen":
      staat.meldingen = staat.meldingen.filter((m) => m.lid !== ctx.door);
      staat.meldingen.push({ ...actie.instelling, lid: ctx.door });
      break;
    case "regio.instellen":
      staat.regio = actie.regio;
      break;
    case "sleutel.vernieuwen":
      if (actie.welke === "keuken") staat.keukenSleutel = ctx.nieuweSleutel();
      else staat.inboxSleutel = ctx.nieuweSleutel();
      break;
    case "gesprek.opslaan":
      staat.gesprekken.push({ id: ctx.nieuwId(), ronde: staat.ronde, datum: actie.datum, afspraken: actie.afspraken, op: ctx.nu });
      staat.ronde += 1;
      break;
    case "feed.vernieuwen":
      staat.feedSleutel = ctx.nieuweSleutel();
      break;
  }

  staat.versie = oud.versie + 1;
  return staat;
}
