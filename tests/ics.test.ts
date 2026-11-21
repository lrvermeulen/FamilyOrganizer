import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { pasToe, type Context } from "@/lib/acties";
import { leesIcs } from "@/lib/ics/lezen";
import { ontsnap, schrijfFeed, vouw } from "@/lib/ics/schrijven";
import { legeStaat, type ExterneAgenda } from "@/lib/types";

const ctx: Context = { door: "a", nu: "2026-11-21T10:00:00.000+01:00", nieuwId: () => Math.random().toString(36).slice(2), nieuweSleutel: () => "s" };

const agenda: ExterneAgenda = { id: "g1", naam: "Werk", url: "https://x/y.ics", lid: "a", alleenBezet: false };

const GOOGLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
X-WR-CALNAME:Werk
BEGIN:VTIMEZONE
TZID:Europe/Amsterdam
BEGIN:STANDARD
TZOFFSETFROM:+0200
TZOFFSETTO:+0100
TZNAME:CET
DTSTART:19701025T030000
RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU
END:STANDARD
BEGIN:DAYLIGHT
TZOFFSETFROM:+0100
TZOFFSETTO:+0200
TZNAME:CEST
DTSTART:19700329T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU
END:DAYLIGHT
END:VTIMEZONE
BEGIN:VEVENT
DTSTART;TZID=Europe/Amsterdam:20261102T090000
DTEND;TZID=Europe/Amsterdam:20261102T093000
RRULE:FREQ=WEEKLY;BYDAY=MO
EXDATE;TZID=Europe/Amsterdam:20261116T090000
UID:standup@google.com
SUMMARY:Standup
END:VEVENT
BEGIN:VEVENT
DTSTART;TZID=Europe/Amsterdam:20261130T110000
DTEND;TZID=Europe/Amsterdam:20261130T113000
RECURRENCE-ID;TZID=Europe/Amsterdam:20261130T090000
UID:standup@google.com
SUMMARY:Standup (verschoven)
END:VEVENT
BEGIN:VEVENT
DTSTART:20261124T130000Z
DTEND:20261124T140000Z
UID:lunch@google.com
SUMMARY:Lunch\\, met klant
LOCATION:Utrecht
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261126
DTEND;VALUE=DATE:20261128
UID:weg@google.com
SUMMARY:Op reis
END:VEVENT
END:VCALENDAR`;

describe("iCal lezen", () => {
  const items = leesIcs(GOOGLE, agenda, "2026-11-09", "2026-11-30");
  const regels = items.map((i) => `${i.datum} ${i.heleDag ? "hele dag" : `${i.begin}-${i.eind}`} ${i.titel}`).sort();

  it("schrijft herhalingen uit, slaat uitzonderingen over en rekent in de goede tijdzone", () => {
    expect(regels).toEqual([
      "2026-11-09 09:00-09:30 Standup",
      "2026-11-23 09:00-09:30 Standup",
      "2026-11-24 14:00-15:00 Lunch, met klant",
      "2026-11-26 hele dag Op reis",
      "2026-11-27 hele dag Op reis",
      "2026-11-30 11:00-11:30 Standup (verschoven)",
    ]);
  });

  it("alleen bezet verbergt titels en locaties", () => {
    const bezet = leesIcs(GOOGLE, { ...agenda, alleenBezet: true }, "2026-11-24", "2026-11-24");
    expect(bezet).toHaveLength(1);
    expect(bezet[0]).toMatchObject({ titel: "Bezet", locatie: undefined, leden: ["a"] });
  });
});

describe("iCal schrijven", () => {
  it("ontsnapt en vouwt volgens de regels", () => {
    expect(ontsnap("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
    const lang = "SUMMARY:" + "é".repeat(60);
    const gevouwen = vouw(lang);
    for (const r of gevouwen.split("\r\n")) expect(Buffer.byteLength(r)).toBeLessThanOrEqual(75);
    expect(gevouwen.replace(/\r\n /g, "")).toBe(lang);
  });

  it("een feed die we zelf weer kunnen lezen", () => {
    let s = pasToe(
      legeStaat(),
      {
        type: "gezin.instellen",
        gezinsnaam: "De Test",
        leden: [
          { id: "a", naam: "A", rol: "ouder" },
          { id: "k", naam: "Kim", rol: "kind" },
        ],
      },
      ctx,
    );
    s = pasToe(
      s,
      {
        type: "afspraak.opslaan",
        afspraak: { titel: "Zwemles", datum: "2026-11-25", begin: "15:30", eind: "16:15", leden: ["k"], regelaar: "a", herhaling: { soort: "wekelijks", interval: 1, dagen: [] } },
      },
      ctx,
    );
    const tekst = schrijfFeed(s, {
      van: "2026-11-23",
      tot: "2026-12-06",
      nu: DateTime.fromISO("2026-11-21T10:00:00Z"),
      domein: "gezin.test",
    });
    expect(tekst).toContain("X-WR-CALNAME:De Test");
    expect(tekst).toContain("DTSTART:20261125T143000Z");
    expect(tekst).toContain("SUMMARY:Zwemles (Kim)");
    const terug = leesIcs(tekst, { ...agenda, lid: "k" }, "2026-11-23", "2026-12-06");
    expect(terug.map((i) => `${i.datum} ${i.begin}`)).toEqual(["2026-11-25 15:30", "2026-12-02 15:30"]);
    const alleenA = schrijfFeed(s, { lid: "a", van: "2026-11-23", tot: "2026-12-06", nu: DateTime.now(), domein: "x" });
    expect(alleenA).toContain("SUMMARY:Zwemles\r\n");
  });
});
