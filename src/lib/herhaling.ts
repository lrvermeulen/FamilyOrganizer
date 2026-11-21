import type { DateTime } from "luxon";
import { alsDatum, dag, WEEKDAG_KORT } from "./datum";
import type { Herhaling } from "./types";

/** Voorkomt eindeloze lussen bij rare invoer. */
const MAX_STAPPEN = 5000;

/**
 * Alle datums (JJJJ-MM-DD) waarop iets met deze herhaling gebeurt, binnen [van, tot] (inclusief).
 * De startdatum is altijd het eerste voorval (bij wekelijks: de eerste gekozen weekdag vanaf de start).
 */
export function voorvallen(start: string, h: Herhaling, van: string, tot: string): string[] {
  const eind = h.tot && h.tot < tot ? h.tot : tot;
  if (eind < van || start > eind) return [];
  const uit: string[] = [];
  const s = dag(start);
  const n = Math.max(1, h.interval || 1);
  const neem = (d: DateTime) => {
    const x = alsDatum(d);
    if (x >= van && x <= eind && x >= start) uit.push(x);
  };

  switch (h.soort) {
    case "geen":
      neem(s);
      break;
    case "dagelijks": {
      // Spring direct naar het eerste voorval rond 'van'.
      const verschil = Math.max(0, Math.floor(dag(van).diff(s, "days").days));
      let d = s.plus({ days: Math.floor(verschil / n) * n });
      for (let i = 0; i < MAX_STAPPEN && alsDatum(d) <= eind; i++, d = d.plus({ days: n })) neem(d);
      break;
    }
    case "wekelijks": {
      const dagen = h.dagen.length ? [...new Set(h.dagen)].sort() : [s.weekday];
      const startWeek = s.startOf("week");
      const verschilWeken = Math.max(0, Math.floor(dag(van).startOf("week").diff(startWeek, "weeks").weeks));
      let week = startWeek.plus({ weeks: Math.floor(verschilWeken / n) * n });
      for (let i = 0; i < MAX_STAPPEN && alsDatum(week) <= eind; i++, week = week.plus({ weeks: n })) {
        for (const wd of dagen) neem(week.plus({ days: wd - 1 }));
      }
      break;
    }
    case "maandelijks": {
      for (let i = 0; i < MAX_STAPPEN; i += n) {
        // luxon zet 31 januari + 1 maand op 28/29 februari: de laatste dag van de maand.
        const d = s.plus({ months: i });
        if (alsDatum(d) > eind) break;
        neem(d);
      }
      break;
    }
    case "jaarlijks": {
      for (let i = 0; i < MAX_STAPPEN; i += n) {
        const d = s.plus({ years: i });
        if (alsDatum(d) > eind) break;
        neem(d);
      }
      break;
    }
    case "doorlopend":
      // Geen vaste momenten: komt niet op de takenlijst of in de agenda.
      break;
  }
  return uit.sort();
}

/** Het eerste voorval op of na 'vanaf', binnen een jaar of twee. */
export function volgende(start: string, h: Herhaling, vanaf: string): string | null {
  const tot = alsDatum(dag(vanaf).plus({ years: h.soort === "jaarlijks" ? h.interval + 1 : 2 }));
  return voorvallen(start, h, vanaf, tot)[0] ?? null;
}

/** Het laatste voorval op of vóór 'tot', of null. */
export function vorige(start: string, h: Herhaling, tot: string): string | null {
  const van = alsDatum(dag(tot).minus({ years: h.soort === "jaarlijks" ? h.interval + 1 : 1 }));
  const lijst = voorvallen(start, h, van < start ? start : van, tot);
  return lijst.at(-1) ?? null;
}

export function herhalingLabel(h: Herhaling): string {
  const n = h.interval;
  switch (h.soort) {
    case "geen":
      return "Eenmalig";
    case "dagelijks":
      return n === 1 ? "Elke dag" : `Elke ${n} dagen`;
    case "wekelijks": {
      const dagen = h.dagen.length ? " op " + [...h.dagen].sort().map((d) => WEEKDAG_KORT[d - 1]).join(", ") : "";
      return (n === 1 ? "Elke week" : `Elke ${n} weken`) + dagen;
    }
    case "maandelijks":
      return n === 1 ? "Elke maand" : n === 3 ? "Elk kwartaal" : n === 6 ? "Elk half jaar" : `Elke ${n} maanden`;
    case "jaarlijks":
      return n === 1 ? "Elk jaar" : `Elke ${n} jaar`;
    case "doorlopend":
      return n === 1 ? "Doorlopend (±1 keer per week)" : `Doorlopend (±${n} keer per week)`;
  }
}

/** Hoe vaak per week dit gemiddeld gebeurt (voor schattingen). */
export function perWeek(h: Herhaling): number {
  const n = Math.max(1, h.interval);
  switch (h.soort) {
    case "geen":
      return 0;
    case "dagelijks":
      return 7 / n;
    case "wekelijks":
      return Math.max(1, h.dagen.length) / n;
    case "maandelijks":
      return 12 / 52 / n;
    case "jaarlijks":
      return 1 / 52 / n;
    case "doorlopend":
      return h.interval;
  }
}
