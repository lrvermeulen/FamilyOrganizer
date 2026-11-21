import { DateTime } from "luxon";
import { pasToe, type Context } from "./acties";
import { demoStaat } from "./demo";
import { TIJDZONE } from "./datum";
import { opslag } from "./opslag";
import { modus, nieuweSleutel, nieuwId } from "./sessie";
import { legeStaat, StaatSchema, type Staat } from "./types";

/** In de demo nooit de echte gezinsgegevens gebruiken. */
export function sleutel(): string {
  return modus() === "demo" ? "demo:staat" : "gezin:staat";
}

export async function laadStaat(): Promise<Staat> {
  const tekst = await opslag().lees(sleutel());
  if (tekst) return StaatSchema.parse(JSON.parse(tekst));
  return modus() === "demo" ? demoStaat(DateTime.now().setZone(TIJDZONE)) : legeStaat();
}

/** Past een actie toe en slaat op. Bij een botsing (iemand anders schreef net) opnieuw proberen. */
export async function voerUit(actie: unknown, door: string): Promise<Staat> {
  for (let poging = 0; poging < 5; poging++) {
    const oud = await laadStaat();
    const ctx: Context = { door, nu: DateTime.now().setZone(TIJDZONE).toISO()!, nieuwId, nieuweSleutel };
    const nieuw = pasToe(oud, actie, ctx);
    if (await opslag().zetAls(sleutel(), oud.versie, nieuw.versie, JSON.stringify(nieuw))) return nieuw;
  }
  throw new Error("Het lukte niet om op te slaan, probeer het nog eens");
}

/** Zorg dat er een feedsleutel is (nodig voor de agenda-adressen). */
export async function staatMetSleutel(): Promise<Staat> {
  const staat = await laadStaat();
  if (staat.feedSleutel || staat.leden.length === 0) return staat;
  const nieuw = { ...staat, feedSleutel: nieuweSleutel(), versie: staat.versie + 1 };
  return (await opslag().zetAls(sleutel(), staat.versie, nieuw.versie, JSON.stringify(nieuw))) ? nieuw : laadStaat();
}
