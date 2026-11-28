"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { eindNa } from "@/lib/agenda";
import { kortLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { herhalingLabel } from "@/lib/herhaling";
import { beschrijf, leesTekst, type Voorstel } from "@/lib/invoer";
import type { Categorie } from "@/lib/types";
import { useGezin } from "./context";
import { Keuzes, LedenKeuze } from "./ui";

/** Raad een soort taak bij de tekst, voor een eerste voorstel. */
function raadCategorie(tekst: string): Categorie {
  const t = tekst.toLowerCase();
  if (/school|juf|meester|klas|groep \d|gym|studiedag|opvang|bso|ouderavond|rapport/.test(t)) return "school";
  if (/tandarts|dokter|huisarts|ziekenhuis|apotheek|fysio|consultatiebureau|ggd|vaccin/.test(t)) return "gezondheid";
  if (/verjaardag|cadeau|feest|oma|opa|kaart/.test(t)) return "sociaal";
  if (/betalen|rekening|belasting|verzekering|abonnement|factuur/.test(t)) return "financien";
  if (/eten|koken|boodschap|menu|lunch/.test(t)) return "eten";
  if (/zwem|voetbal|hockey|judo|dans|turnen|muziekles|club|training/.test(t)) return "kinderen";
  return "overig";
}

/** Tekst uit een screenshot halen, op de telefoon zelf (er gaat niets naar een server of AI). */
export async function leesAfbeelding(bestand: File, voortgang: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("nld", 1, {
    logger: (m: { status: string; progress: number }) => m.status === "recognizing text" && voortgang(m.progress),
  });
  try {
    const { data } = await worker.recognize(bestand);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

function VoorstelKaart({
  start,
  bron,
  klaar,
}: {
  start: Voorstel;
  bron: "zelf" | "plakken" | "foto" | "delen";
  klaar: () => void;
}) {
  const { staat, ik, doe, bezig, ouders } = useGezin();
  const [v, zet] = useState(start);
  useEffect(() => zet(start), [start]);
  const wijzig = (x: Partial<Voorstel>) => zet((o) => ({ ...o, ...x }));

  const toevoegen = async () => {
    const notitie = v.bron.length > v.titel.length + 10 ? v.bron.slice(0, 2000) : "";
    let ok = false;
    if (v.soort === "boodschappen") {
      ok = v.boodschappen.length > 0 && (await doe({ type: "boodschappen.toevoegen", namen: v.boodschappen }));
    } else if (v.soort === "afspraak") {
      ok = await doe({
        type: "afspraak.opslaan",
        afspraak: {
          titel: v.titel,
          datum: v.datum,
          heleDag: v.heleDag || !v.begin,
          begin: v.heleDag ? undefined : v.begin,
          // Een rit duurt kort; een gewone afspraak standaard een uur.
          eind: v.heleDag || !v.begin ? undefined : (v.eind ?? eindNa(v.begin, v.rit ? 15 : 60)),
          leden: v.leden.length ? v.leden : ik ? [ik] : [],
          regelaar: null,
          // "S&T naar school brengen": wie genoemd wordt of wie het invoert, brengt (of haalt).
          brengt: v.rit && v.rit !== "halen" ? (v.door ?? ik) : null,
          haalt: v.rit && v.rit !== "brengen" ? (v.door ?? ik) : null,
          locatie: "",
          notitie,
          herhaling: v.herhaling ?? { soort: "geen", interval: 1, dagen: [] },
        },
      });
    } else {
      ok = await doe({
        type: "taak.opslaan",
        taak: {
          titel: v.titel,
          categorie: raadCategorie(v.bron),
          notitie,
          start: v.datum,
          tijd: v.begin,
          herhaling: { soort: "geen", interval: 1, dagen: [] },
          duurMin: 15,
          denkwerk: 2,
          eigenaar: ik,
          voor: v.leden,
          inAgenda: v.uiterlijk,
        },
      });
    }
    if (ok && bron !== "zelf") {
      // Iets opmerken en vastleggen is ook werk: dat telt mee in het inzicht.
      await doe({ type: "opgemerkt.toevoegen", tekst: v.bron.slice(0, 2000), bron, afgehandeld: true });
    }
    if (ok) klaar();
  };

  return (
    <div className="kaart" style={{ marginBottom: 10 }}>
      <Keuzes
        label="Soort"
        waarde={v.soort}
        kies={(soort) => wijzig({ soort, boodschappen: soort === "boodschappen" && !v.boodschappen.length ? [v.titel] : v.boodschappen })}
        opties={[
          { waarde: "afspraak", label: "Afspraak" },
          { waarde: "taak", label: "Taak" },
          { waarde: "boodschappen", label: "Boodschappen" },
        ]}
      />
      {v.soort === "boodschappen" ? (
        <label className="veld" style={{ marginTop: 10 }}>
          <span>Op de lijst (één per regel)</span>
          <textarea
            value={v.boodschappen.join("\n")}
            onChange={(e) => wijzig({ boodschappen: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
          />
        </label>
      ) : (
        <>
          <label className="veld" style={{ marginTop: 10 }}>
            <span>Wat</span>
            <input type="text" maxLength={120} value={v.titel} onChange={(e) => wijzig({ titel: e.target.value })} />
          </label>
          <div className="twee">
            <label className="veld">
              <span>{v.soort === "taak" ? (v.uiterlijk ? "Uiterlijk" : "Wanneer") : "Datum"}</span>
              <input type="date" value={v.datum} onChange={(e) => wijzig({ datum: e.target.value, datumGevonden: true })} />
            </label>
            {v.soort === "afspraak" && !v.heleDag && (
              <label className="veld">
                <span>Tijd</span>
                <input type="time" value={v.begin ?? ""} onChange={(e) => wijzig({ begin: e.target.value || undefined })} />
              </label>
            )}
          </div>
          {v.soort === "afspraak" && (
            <label className="vink">
              <input type="checkbox" checked={v.heleDag} onChange={(e) => wijzig({ heleDag: e.target.checked })} />
              <span>Hele dag</span>
            </label>
          )}
          {v.herhaling && (
            <div className="klein" style={{ marginBottom: 8 }}>
              🔁 {herhalingLabel(v.herhaling)}, vanaf {kortLabel(v.datum)}
            </div>
          )}
          {v.rit && (
            <div style={{ marginBottom: 10 }}>
              <div className="veld-label">{v.rit === "halen" ? "Wie haalt?" : v.rit === "brengen" ? "Wie brengt?" : "Wie brengt en haalt?"}</div>
              <Keuzes
                label="Wie"
                waarde={v.door ?? ik}
                kies={(door) => wijzig({ door: door ?? undefined })}
                opties={ouders.map((o) => ({ waarde: o.id as string | null, label: o.naam }))}
              />
            </div>
          )}
          <div className="veld-label">Voor wie</div>
          <LedenKeuze
            leden={staat.leden}
            gekozen={v.leden}
            wissel={(id) => wijzig({ leden: v.leden.includes(id) ? v.leden.filter((x) => x !== id) : [...v.leden, id] })}
          />
        </>
      )}
      <div className="blad-voet">
        <button className="knop stil" onClick={klaar}>
          Niet toevoegen
        </button>
        <button className="knop hoofd" disabled={bezig || (v.soort !== "boodschappen" && !v.titel.trim())} onClick={toevoegen}>
          Toevoegen
        </button>
      </div>
    </div>
  );
}

/**
 * De invoerregel: typ, plak of fotografeer iets, en de app doet een voorstel.
 * Zonder AI: vaste regels voor datums, tijden, namen en boodschappen.
 */
export function Invoerregel({
  begintekst = "",
  beginbron = "zelf",
  klaar,
  gewist,
  compact,
}: {
  begintekst?: string;
  beginbron?: "zelf" | "plakken" | "foto" | "delen";
  /** Alles is verwerkt (toegevoegd of bewust niet toegevoegd). */
  klaar?: () => void;
  /** De tekst is gewist zonder te verwerken. */
  gewist?: () => void;
  compact?: boolean;
}) {
  const { staat, doe, bezig, meld } = useGezin();
  const [tekst, zetTekst] = useState(begintekst);
  const [bron, zetBron] = useState(beginbron);
  const [weg, zetWeg] = useState<Set<number>>(new Set());
  const [lezen, zetLezen] = useState<number | null>(null);
  const bestand = useRef<HTMLInputElement>(null);
  const vandaag = vandaagDatum();

  useEffect(() => {
    zetTekst(begintekst);
    zetBron(beginbron);
    zetWeg(new Set());
  }, [begintekst, beginbron]);

  const voorstellen = useMemo(() => leesTekst(tekst, { vandaag, leden: staat.leden }), [tekst, vandaag, staat.leden]);
  const zichtbaar = voorstellen.map((v, i) => ({ v, i })).filter(({ i }) => !weg.has(i));

  const reset = (verwerkt = true) => {
    zetTekst("");
    zetBron("zelf");
    zetWeg(new Set());
    if (verwerkt) klaar?.();
    else gewist?.();
  };

  const plak = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (!t.trim()) return meld("Er staat geen tekst op het klembord");
      zetTekst(t);
      zetBron("plakken");
      zetWeg(new Set());
    } catch {
      meld("Plakken mag niet van je browser. Houd je vinger in het veld en kies Plakken.");
    }
  };

  const foto = async (f: File | undefined) => {
    if (!f) return;
    zetLezen(0);
    try {
      const t = await leesAfbeelding(f, (p) => zetLezen(p));
      if (!t.trim()) meld("Er is geen tekst gevonden in de afbeelding");
      zetTekst(t.trim());
      zetBron("foto");
      zetWeg(new Set());
    } catch {
      meld("De tekst lezen lukte niet. Heb je internet? De eerste keer wordt de Nederlandse taal gedownload.");
    } finally {
      zetLezen(null);
      if (bestand.current) bestand.current.value = "";
    }
  };

  return (
    <div>
      <label className="veld" style={{ marginBottom: 8 }}>
        <span>{compact ? "Wat moet erin?" : "Typ, plak of fotografeer"}</span>
        <textarea
          value={tekst}
          onChange={(e) => {
            zetTekst(e.target.value);
            if (!e.target.value) zetBron("zelf");
          }}
          placeholder={"tandarts Nine do 14:00\nstudiedag vrijdag 4 december\nmelk, kaas en appels op de lijst"}
          style={{ minHeight: compact ? 70 : 90 }}
          autoFocus={compact}
        />
      </label>
      <div className="rij" style={{ marginBottom: 10 }}>
        <button className="knop klein" type="button" onClick={plak}>
          📋 Plak bericht
        </button>
        <button className="knop klein" type="button" onClick={() => bestand.current?.click()} disabled={lezen !== null}>
          🖼 Screenshot
        </button>
        <input ref={bestand} type="file" accept="image/*" hidden onChange={(e) => foto(e.target.files?.[0])} />
        {tekst && (
          <button className="knop klein stil" type="button" onClick={() => reset(false)}>
            Wissen
          </button>
        )}
      </div>
      {lezen !== null && (
        <p className="stil klein">
          Tekst lezen op je telefoon… {Math.round(lezen * 100)}%
          <br />
          De eerste keer duurt het langer: dan wordt de Nederlandse taal gedownload.
        </p>
      )}
      {tekst.trim() && (
        <>
          <p className="stil klein">
            {voorstellen.length === 1
              ? `Voorstel: ${beschrijf(voorstellen[0], staat.leden, kortLabel)}. Controleer het even.`
              : `${voorstellen.length} voorstellen gevonden. Controleer ze even.`}
          </p>
          {zichtbaar.map(({ v, i }) => (
            <VoorstelKaart
              key={`${i}-${v.bron}`}
              start={v}
              bron={bron}
              klaar={() => {
                const nieuw = new Set(weg).add(i);
                zetWeg(nieuw);
                if (nieuw.size >= voorstellen.length) reset();
              }}
            />
          ))}
          {bron === "zelf" && (
            <button
              className="knop klein stil"
              disabled={bezig}
              onClick={async () => (await doe({ type: "opgemerkt.toevoegen", tekst: tekst.trim().slice(0, 2000) })) && reset()}
            >
              Of: alleen onthouden in de inbox, later uitzoeken
            </button>
          )}
        </>
      )}
    </div>
  );
}
