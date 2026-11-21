"use client";

import { useState } from "react";
import type { AfspraakInvoer, TaakInvoer } from "@/lib/acties";
import { vandaag as vandaagDatum, WEEKDAG_KORT } from "@/lib/datum";
import { herhalingLabel } from "@/lib/herhaling";
import { CATEGORIEEN, DENKWERK, type Afspraak, type Categorie, type Denkwerk, type Herhaling, type Taak } from "@/lib/types";
import { useGezin } from "./context";
import { Blad, Keuzes, LedenKeuze } from "./ui";

function HerhalingVeld({ waarde, zet }: { waarde: Herhaling; zet: (h: Herhaling) => void }) {
  const [een, meer] = {
    dagelijks: ["dag", "dagen"],
    wekelijks: ["week", "weken"],
    maandelijks: ["maand", "maanden"],
    jaarlijks: ["jaar", "jaar"],
    doorlopend: ["keer per week", "keer per week"],
    geen: ["", ""],
  }[waarde.soort];
  return (
    <div className="veld" style={{ marginBottom: 12 }}>
      <span className="veld-label">Herhaling</span>
      <Keuzes
        label="Herhaling"
        waarde={waarde.soort}
        kies={(soort) => zet({ ...waarde, soort, interval: 1, dagen: [] })}
        opties={[
          { waarde: "geen", label: "Eenmalig" },
          { waarde: "dagelijks", label: "Dagelijks" },
          { waarde: "wekelijks", label: "Wekelijks" },
          { waarde: "maandelijks", label: "Maandelijks" },
          { waarde: "jaarlijks", label: "Jaarlijks" },
        ]}
      />
      {waarde.soort !== "geen" && (
        <div style={{ marginTop: 10 }} className="stapel">
          <label className="rij">
            <span>Elke</span>
            <input
              type="number"
              min={1}
              max={52}
              value={waarde.interval}
              style={{ width: 80 }}
              onChange={(e) => zet({ ...waarde, interval: Math.max(1, Math.min(52, Number(e.target.value) || 1)) })}
            />
            <span>{waarde.interval === 1 ? een : meer}</span>
          </label>
          {waarde.soort === "wekelijks" && (
            <div className="keuzes" aria-label="Op welke dagen">
              {WEEKDAG_KORT.map((d, i) => {
                const aan = waarde.dagen.includes(i + 1);
                return (
                  <button
                    type="button"
                    key={d}
                    aria-pressed={aan}
                    className={`chip ${aan ? "aan" : ""}`}
                    onClick={() =>
                      zet({ ...waarde, dagen: aan ? waarde.dagen.filter((x) => x !== i + 1) : [...waarde.dagen, i + 1].sort() })
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}
          <label className="rij">
            <span className="stil klein">Tot en met (optioneel)</span>
            <input
              type="date"
              value={waarde.tot ?? ""}
              style={{ width: "auto", flex: 1 }}
              onChange={(e) => zet({ ...waarde, tot: e.target.value || undefined })}
            />
          </label>
          <div className="stil klein">{herhalingLabel(waarde)}</div>
        </div>
      )}
    </div>
  );
}

export function TaakFormulier({
  taak,
  voorstel,
  sluit,
  opgeslagen,
}: {
  taak?: Taak;
  voorstel?: Partial<TaakInvoer>;
  sluit: () => void;
  opgeslagen?: (id: string | undefined) => void;
}) {
  const { staat, ouders, doe, bezig, ik } = useGezin();
  const [t, zet] = useState<TaakInvoer>(() =>
    taak
      ? { ...taak }
      : {
          titel: "",
          categorie: "huishouden",
          notitie: "",
          start: vandaagDatum(),
          herhaling: { soort: "geen", interval: 1, dagen: [] },
          duurMin: 15,
          denkwerk: 2,
          eigenaar: ik,
          uitvoerder: null,
          voor: [],
          inAgenda: false,
          ...voorstel,
        },
  );
  const wijzig = (x: Partial<TaakInvoer>) => zet((o) => ({ ...o, ...x }));

  const opslaan = async (e: React.FormEvent) => {
    e.preventDefault();
    // Een nieuwe taak krijgt hier al een id, zodat we hem daarna kunnen koppelen (bijvoorbeeld aan "Opgemerkt").
    const id = t.id ?? crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    if (await doe({ type: "taak.opslaan", taak: { ...t, id } })) {
      sluit();
      opgeslagen?.(id);
    }
  };

  return (
    <Blad titel={taak ? "Taak bewerken" : "Nieuwe taak"} sluit={sluit}>
      <form onSubmit={opslaan}>
        <label className="veld">
          <span>Wat moet er gebeuren?</span>
          <input type="text" required maxLength={120} value={t.titel} onChange={(e) => wijzig({ titel: e.target.value })} autoFocus={!taak} />
        </label>
        <label className="veld">
          <span>Soort</span>
          <select value={t.categorie} onChange={(e) => wijzig({ categorie: e.target.value as Categorie })}>
            {Object.entries(CATEGORIEEN).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <div className="twee">
          <label className="veld">
            <span>{t.herhaling.soort === "geen" ? "Wanneer" : "Vanaf"}</span>
            <input type="date" required value={t.start} onChange={(e) => wijzig({ start: e.target.value })} />
          </label>
          <label className="veld">
            <span>Tijd (optioneel)</span>
            <input type="time" value={t.tijd ?? ""} onChange={(e) => wijzig({ tijd: e.target.value || undefined })} />
          </label>
        </div>
        <HerhalingVeld waarde={t.herhaling as Herhaling} zet={(herhaling) => wijzig({ herhaling })} />

        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Wie houdt het in het hoofd? (eraan denken, plannen, bewaken)</span>
          <Keuzes
            label="Eigenaar"
            waarde={t.eigenaar ?? null}
            kies={(eigenaar) => wijzig({ eigenaar })}
            opties={[...ouders.map((o) => ({ waarde: o.id as string | null, label: o.naam })), { waarde: null, label: "Nog niet verdeeld" }]}
          />
        </div>
        <label className="veld">
          <span>Wie voert het meestal uit?</span>
          <select value={t.uitvoerder ?? ""} onChange={(e) => wijzig({ uitvoerder: e.target.value || null })}>
            <option value="">Dezelfde persoon</option>
            {staat.leden.map((l) => (
              <option key={l.id} value={l.id}>
                {l.naam}
              </option>
            ))}
          </select>
        </label>

        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Hoeveel denkwerk zit erin?</span>
          <Keuzes
            label="Denkwerk"
            waarde={t.denkwerk as Denkwerk}
            kies={(denkwerk) => wijzig({ denkwerk })}
            opties={([1, 2, 3] as Denkwerk[]).map((n) => ({ waarde: n, label: DENKWERK[n].naam, titel: DENKWERK[n].uitleg }))}
          />
          <div className="stil klein" style={{ marginTop: 4 }}>
            {DENKWERK[t.denkwerk as Denkwerk].uitleg}
          </div>
        </div>
        <label className="veld">
          <span>Hoe lang duurt het uitvoeren? (minuten)</span>
          <input
            type="number"
            min={0}
            max={1440}
            step={5}
            value={t.duurMin}
            onChange={(e) => wijzig({ duurMin: Math.max(0, Math.min(1440, Number(e.target.value) || 0)) })}
          />
        </label>
        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Voor wie? (optioneel)</span>
          <LedenKeuze
            leden={staat.leden}
            gekozen={t.voor ?? []}
            wissel={(id) => wijzig({ voor: t.voor?.includes(id) ? t.voor.filter((x) => x !== id) : [...(t.voor ?? []), id] })}
          />
        </div>
        <label className="vink">
          <input type="checkbox" checked={!!t.inAgenda} onChange={(e) => wijzig({ inAgenda: e.target.checked })} />
          <span>
            Ook in de agenda zetten
            <span className="stil klein" style={{ display: "block" }}>
              Met een tijd staat hij er altijd in.
            </span>
          </span>
        </label>
        <label className="veld">
          <span>Notitie</span>
          <textarea value={t.notitie ?? ""} maxLength={2000} onChange={(e) => wijzig({ notitie: e.target.value })} />
        </label>
        <div className="blad-voet">
          {taak ? (
            <button
              type="button"
              className="knop gevaar"
              disabled={bezig}
              onClick={async () => {
                if (confirm(`"${taak.titel}" verwijderen?`) && (await doe({ type: "taak.verwijderen", id: taak.id }))) sluit();
              }}
            >
              Verwijderen
            </button>
          ) : (
            <span />
          )}
          <button className="knop hoofd" disabled={bezig}>
            Opslaan
          </button>
        </div>
      </form>
    </Blad>
  );
}

export function AfspraakFormulier({ afspraak, datum, sluit }: { afspraak?: Afspraak; datum?: string; sluit: () => void }) {
  const { staat, ouders, doe, bezig } = useGezin();
  const [a, zet] = useState<AfspraakInvoer>(() =>
    afspraak
      ? { ...afspraak }
      : {
          titel: "",
          datum: datum ?? vandaagDatum(),
          heleDag: false,
          begin: "09:00",
          eind: "10:00",
          leden: [],
          regelaar: null,
          locatie: "",
          notitie: "",
          herhaling: { soort: "geen", interval: 1, dagen: [] },
        },
  );
  const wijzig = (x: Partial<AfspraakInvoer>) => zet((o) => ({ ...o, ...x }));

  const opslaan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!a.leden.length) return alert("Kies voor wie de afspraak is");
    if (await doe({ type: "afspraak.opslaan", afspraak: { ...a, begin: a.heleDag ? undefined : a.begin, eind: a.heleDag ? undefined : a.eind } })) sluit();
  };

  return (
    <Blad titel={afspraak ? "Afspraak bewerken" : "Nieuwe afspraak"} sluit={sluit}>
      <form onSubmit={opslaan}>
        <label className="veld">
          <span>Wat</span>
          <input type="text" required maxLength={120} value={a.titel} onChange={(e) => wijzig({ titel: e.target.value })} autoFocus={!afspraak} />
        </label>
        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Voor wie</span>
          <LedenKeuze
            leden={staat.leden}
            gekozen={a.leden}
            wissel={(id) => wijzig({ leden: a.leden.includes(id) ? a.leden.filter((x) => x !== id) : [...a.leden, id] })}
          />
        </div>
        <label className="veld">
          <span>Datum</span>
          <input type="date" required value={a.datum} onChange={(e) => wijzig({ datum: e.target.value })} />
        </label>
        <label className="vink">
          <input type="checkbox" checked={!!a.heleDag} onChange={(e) => wijzig({ heleDag: e.target.checked })} />
          <span>Hele dag</span>
        </label>
        {!a.heleDag && (
          <div className="twee">
            <label className="veld">
              <span>Begin</span>
              <input type="time" required value={a.begin ?? ""} onChange={(e) => wijzig({ begin: e.target.value })} />
            </label>
            <label className="veld">
              <span>Eind</span>
              <input type="time" value={a.eind ?? ""} onChange={(e) => wijzig({ eind: e.target.value || undefined })} />
            </label>
          </div>
        )}
        <HerhalingVeld waarde={a.herhaling as Herhaling} zet={(herhaling) => wijzig({ herhaling })} />
        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Wie regelt het? (brengen, halen, erbij zijn)</span>
          <Keuzes
            label="Regelaar"
            waarde={a.regelaar ?? null}
            kies={(regelaar) => wijzig({ regelaar })}
            opties={[...ouders.map((o) => ({ waarde: o.id as string | null, label: o.naam })), { waarde: null, label: "Niemand / n.v.t." }]}
          />
        </div>
        <label className="veld">
          <span>Waar</span>
          <input type="text" maxLength={200} value={a.locatie ?? ""} onChange={(e) => wijzig({ locatie: e.target.value })} />
        </label>
        <label className="veld">
          <span>Notitie</span>
          <textarea maxLength={2000} value={a.notitie ?? ""} onChange={(e) => wijzig({ notitie: e.target.value })} />
        </label>
        <div className="blad-voet">
          {afspraak ? (
            <button
              type="button"
              className="knop gevaar"
              disabled={bezig}
              onClick={async () => {
                const extra = afspraak.herhaling.soort !== "geen" ? " Dit verwijdert alle keren." : "";
                if (confirm(`"${afspraak.titel}" verwijderen?${extra}`) && (await doe({ type: "afspraak.verwijderen", id: afspraak.id }))) sluit();
              }}
            >
              Verwijderen
            </button>
          ) : (
            <span />
          )}
          <button className="knop hoofd" disabled={bezig}>
            Opslaan
          </button>
        </div>
      </form>
    </Blad>
  );
}

export function OpgemerktFormulier({ sluit }: { sluit: () => void }) {
  const { doe, bezig } = useGezin();
  const [tekst, zet] = useState("");
  return (
    <Blad titel="Opgemerkt" sluit={sluit}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (tekst.trim() && (await doe({ type: "opgemerkt.toevoegen", tekst }))) sluit();
        }}
      >
        <p className="stil klein">
          Iets wat je ziet of bedenkt en wat geregeld moet worden. Leg het vast, dan hoef je het niet te onthouden. Het telt
          mee als denkwerk: iets opmerken is ook werk.
        </p>
        <label className="veld">
          <span>Wat schoot je te binnen?</span>
          <textarea autoFocus required maxLength={500} value={tekst} onChange={(e) => zet(e.target.value)} placeholder="De winterjassen worden te klein" />
        </label>
        <div className="blad-voet">
          <span />
          <button className="knop hoofd" disabled={bezig || !tekst.trim()}>
            Vastleggen
          </button>
        </div>
      </form>
    </Blad>
  );
}
