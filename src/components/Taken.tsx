"use client";

import { useMemo, useState } from "react";
import { urenLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { herhalingLabel, perWeek } from "@/lib/herhaling";
import { structureleVerdeling } from "@/lib/inzicht";
import { SJABLONEN } from "@/lib/sjablonen";
import { uitvoerderVan } from "@/lib/taken";
import { CATEGORIEEN, type Categorie, type Taak } from "@/lib/types";
import { useGezin } from "./context";
import { TaakFormulier } from "./Formulieren";
import { Blad, Bolletje, DenkwerkStippen, Keuzes, Verdeling } from "./ui";

export function StartTakenBlad({ sluit }: { sluit: () => void }) {
  const { staat, doe, bezig } = useGezin();
  const bestaand = new Set(staat.taken.filter((t) => !t.gearchiveerd).map((t) => t.titel.toLowerCase()));
  const beschikbaar = SJABLONEN.filter((s) => !bestaand.has(s.titel.toLowerCase()));
  const [gekozen, zet] = useState<Set<string>>(() => new Set(beschikbaar.filter((s) => s.standaard).map((s) => s.titel)));
  const toevoegen = async () => {
    const vandaag = vandaagDatum();
    const taken = beschikbaar
      .filter((x) => gekozen.has(x.titel))
      .map((s) => ({
        titel: s.titel,
        categorie: s.categorie,
        notitie: s.denkwerkUitleg ?? "",
        start: vandaag,
        herhaling: s.herhaling,
        duurMin: s.duurMin,
        denkwerk: s.denkwerk,
        eigenaar: null,
      }));
    if (await doe({ type: "taken.toevoegen", taken })) sluit();
  };
  return (
    <Blad titel="Starttaken toevoegen" sluit={sluit}>
      <p className="stil klein">
        Vink aan wat bij jullie speelt. Herhaling, duur en denkwerk kun je daarna per taak aanpassen. Wie wat doet, verdelen jullie
        daarna samen.
      </p>
      {beschikbaar.length === 0 && <p>Alle starttaken staan er al in.</p>}
      {(Object.keys(CATEGORIEEN) as Categorie[]).map((c) => {
        const lijst = beschikbaar.filter((s) => s.categorie === c);
        if (!lijst.length) return null;
        return (
          <div key={c} style={{ marginBottom: 10 }}>
            <h3 style={{ margin: "8px 0 2px" }}>{CATEGORIEEN[c]}</h3>
            {lijst.map((s) => (
              <label className="vink" key={s.titel}>
                <input
                  type="checkbox"
                  checked={gekozen.has(s.titel)}
                  onChange={(e) =>
                    zet((g) => {
                      const n = new Set(g);
                      if (e.target.checked) n.add(s.titel);
                      else n.delete(s.titel);
                      return n;
                    })
                  }
                />
                <span>
                  {s.titel}
                  <span className="stil klein" style={{ display: "block" }}>
                    {herhalingLabel(s.herhaling)} · {urenLabel(s.duurMin)} · <DenkwerkStippen n={s.denkwerk} />
                  </span>
                </span>
              </label>
            ))}
          </div>
        );
      })}
      <div className="blad-voet">
        <span className="stil klein">{gekozen.size} gekozen</span>
        <button className="knop hoofd" disabled={bezig || gekozen.size === 0} onClick={toevoegen}>
          Toevoegen
        </button>
      </div>
    </Blad>
  );
}

function Verdelen() {
  const { staat, ouders, lid, doe, bezig } = useGezin();
  const [alleenOpen, zetAlleenOpen] = useState(true);
  const taken = staat.taken
    .filter((t) => !t.gearchiveerd && t.herhaling.soort !== "geen")
    .filter((t) => !alleenOpen || !t.eigenaar)
    .sort((a, b) => b.denkwerk * perWeek(b.herhaling) - a.denkwerk * perWeek(a.herhaling));
  const v = structureleVerdeling(staat);
  const zonder = staat.taken.filter((t) => !t.gearchiveerd && !t.eigenaar).length;

  const zet = (t: Taak, eigenaar: string | null, uitvoerder: string | null) =>
    doe({ type: "taak.opslaan", taak: { ...t, eigenaar, uitvoerder: uitvoerder === eigenaar ? null : uitvoerder } });

  return (
    <>
      <div className="uitleg">
        <b>Samen verdelen.</b> Kies per taak wie hem <b>in het hoofd heeft</b>: eraan denken, plannen en bewaken dat het gebeurt. Dat
        is de eigenaar. Wie het uitvoert mag iemand anders zijn. Tip: draag liever een hele taak over dan alleen het uitvoeren, anders
        blijft het denkwerk liggen waar het lag.
      </div>
      <div className="kaart">
        <h3>Zo verdeelt jullie takenlijst het werk (gemiddeld per week)</h3>
        <div className="veld-label" style={{ marginTop: 8 }}>
          Denkwerk
        </div>
        <Verdeling
          delen={[...ouders.map((o) => ({ lid: o, waarde: v[o.id]?.denkwerk ?? 0 })), { waarde: v[""].denkwerk }]}
          eenheid={(w) => `${Math.round(w)} pt`}
        />
        <div className="veld-label" style={{ marginTop: 12 }}>
          Uitvoeren
        </div>
        <Verdeling
          delen={[
            ...staat.leden.map((l) => ({ lid: l, waarde: v[l.id]?.uitvoerMin ?? 0 })).filter((d) => d.lid.rol === "ouder" || d.waarde > 0),
            { waarde: v[""].uitvoerMin },
          ]}
          eenheid={(w) => urenLabel(w)}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <Keuzes
          label="Welke taken"
          waarde={alleenOpen}
          kies={zetAlleenOpen}
          opties={[
            { waarde: true, label: `Nog niet verdeeld (${zonder})` },
            { waarde: false, label: "Alle vaste taken" },
          ]}
        />
      </div>
      {taken.length === 0 && <p className="stil">{alleenOpen ? "Alles is verdeeld. 🎉" : "Nog geen vaste taken."}</p>}
      {taken.map((t) => (
        <div className="kaart" key={t.id}>
          <div className="rij tussen">
            <div>
              <b>{t.titel}</b>
              <div className="stil klein">
                {herhalingLabel(t.herhaling)} · {urenLabel(t.duurMin)} · <DenkwerkStippen n={t.denkwerk} />
              </div>
              {t.notitie && <div className="stil klein">{t.notitie}</div>}
            </div>
          </div>
          <div className="veld-label" style={{ marginTop: 10 }}>
            In het hoofd van
          </div>
          <Keuzes
            label={`Eigenaar van ${t.titel}`}
            waarde={t.eigenaar}
            kies={(e) => !bezig && zet(t, e, t.uitvoerder)}
            opties={[...ouders.map((o) => ({ waarde: o.id as string | null, label: o.naam })), { waarde: null, label: "?" }]}
          />
          <div className="veld-label" style={{ marginTop: 10 }}>
            Voert uit
          </div>
          <Keuzes
            label={`Uitvoerder van ${t.titel}`}
            waarde={uitvoerderVan(t)}
            kies={(u) => !bezig && zet(t, t.eigenaar, u)}
            opties={staat.leden.map((l) => ({ waarde: l.id as string | null, label: l.naam }))}
          />
          {t.eigenaar && <div className="stil klein" style={{ marginTop: 6 }}>Eigenaar: {lid(t.eigenaar)?.naam}</div>}
        </div>
      ))}
    </>
  );
}

export function Taken() {
  const { staat, lid, ouders } = useGezin();
  const [stand, zetStand] = useState<"lijst" | "verdelen">("lijst");
  const [bewerk, zetBewerk] = useState<Taak | null | "nieuw">(null);
  const [start, zetStart] = useState(false);
  const [wie, zetWie] = useState<string>("");
  const [zoek, zetZoek] = useState("");

  const actief = staat.taken.filter((t) => !t.gearchiveerd);
  const zonder = actief.filter((t) => !t.eigenaar).length;
  const gefilterd = useMemo(
    () =>
      actief
        .filter((t) => !wie || (wie === "-" ? !t.eigenaar : t.eigenaar === wie || uitvoerderVan(t) === wie))
        .filter((t) => !zoek || t.titel.toLowerCase().includes(zoek.toLowerCase())),
    [actief, wie, zoek],
  );

  return (
    <>
      <div className="kop">
        <div>
          <h1>Taken</h1>
          <div className="sub">
            {actief.length} taken{zonder ? ` · ${zonder} nog niet verdeeld` : ""}
          </div>
        </div>
        <button className="knop hoofd" onClick={() => zetBewerk("nieuw")}>
          + Taak
        </button>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Keuzes
          label="Weergave"
          waarde={stand}
          kies={zetStand}
          opties={[
            { waarde: "lijst", label: "Lijst" },
            { waarde: "verdelen", label: zonder ? `Verdelen (${zonder})` : "Verdelen" },
          ]}
        />
      </div>

      {stand === "verdelen" ? (
        <Verdelen />
      ) : (
        <>
          {actief.length < 5 && (
            <div className="uitleg">
              Begin met een lijst taken die in veel gezinnen terugkomen, dan hoef je niet alles zelf te bedenken.
              <div style={{ marginTop: 8 }}>
                <button className="knop hoofd klein" onClick={() => zetStart(true)}>
                  Starttaken kiezen
                </button>
              </div>
            </div>
          )}
          <div className="rij" style={{ marginBottom: 10 }}>
            <input type="text" placeholder="Zoeken" value={zoek} onChange={(e) => zetZoek(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
            <select value={wie} onChange={(e) => zetWie(e.target.value)} style={{ width: "auto" }} aria-label="Van wie">
              <option value="">Iedereen</option>
              {ouders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.naam}
                </option>
              ))}
              <option value="-">Nog niet verdeeld</option>
            </select>
          </div>
          {(Object.keys(CATEGORIEEN) as Categorie[]).map((c) => {
            const lijst = gefilterd.filter((t) => t.categorie === c);
            if (!lijst.length) return null;
            return (
              <div className="kaart" key={c}>
                <h3>{CATEGORIEEN[c]}</h3>
                <ul className="lijst">
                  {lijst.map((t) => {
                    const u = uitvoerderVan(t);
                    return (
                      <li key={t.id}>
                        <button className="regel" onClick={() => zetBewerk(t)}>
                          <div className="titel">{t.titel}</div>
                          <div className="meta">
                            {herhalingLabel(t.herhaling)}
                            {t.duurMin ? ` · ${urenLabel(t.duurMin)}` : ""}
                            {u && u !== t.eigenaar ? ` · doet: ${lid(u)?.naam}` : ""}
                          </div>
                        </button>
                        <DenkwerkStippen n={t.denkwerk} />
                        <Bolletje lid={lid(t.eigenaar)} klein />
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {actief.length >= 5 && (
            <button className="knop vol" onClick={() => zetStart(true)}>
              Meer starttaken toevoegen
            </button>
          )}
          <p className="stil klein" style={{ marginTop: 14 }}>
            Bolletje = wie het in het hoofd heeft. Stippen = hoeveel denkwerk erin zit (licht, gemiddeld, zwaar).
          </p>
        </>
      )}

      {bewerk && <TaakFormulier taak={bewerk === "nieuw" ? undefined : bewerk} sluit={() => zetBewerk(null)} />}
      {start && <StartTakenBlad sluit={() => zetStart(false)} />}
    </>
  );
}
