"use client";

import { useMemo, useState } from "react";
import { dag, kortLabel, plusDagen, urenLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { berekenInzicht, GESPREKSVRAGEN, inschattingenVanRonde, type Inzicht as InzichtData } from "@/lib/inzicht";
import type { Lid } from "@/lib/types";
import { useGezin } from "./context";
import { Bolletje, Keuzes, Verdeling } from "./ui";

const PERIODES = [
  { waarde: 14, label: "2 weken" },
  { waarde: 28, label: "4 weken" },
  { waarde: 91, label: "3 maanden" },
];

function pct(x: number) {
  return `${Math.round(x * 100)}%`;
}

function Inschatten({ klaar }: { klaar: () => void }) {
  const { doe, bezig, ouders, ik } = useGezin();
  const [denk, zetDenk] = useState(50);
  const [doen, zetDoen] = useState(50);
  const ander = ouders.find((o) => o.id !== ik);
  return (
    <div className="kaart">
      <h2>Eerst: hoe zie jij het?</h2>
      <p className="stil klein">
        Vul dit in vóór je de cijfers ziet, en los van elkaar. {ander ? `${ander.naam} ziet jouw antwoord` : "De ander ziet je antwoord"}{" "}
        pas als jullie allebei hebben ingevuld. Het verschil tussen hoe je het ervaart en wat de app telt, is vaak het beste begin van het
        gesprek.
      </p>
      <label className="veld" style={{ marginTop: 12 }}>
        <span>
          Welk deel van het <b>denkwerk</b> (eraan denken, plannen, afstemmen, bewaken) doe jij? <b>{denk}%</b>
        </span>
        <input type="range" min={0} max={100} step={5} value={denk} onChange={(e) => zetDenk(Number(e.target.value))} />
      </label>
      <label className="veld">
        <span>
          Welk deel van het <b>uitvoeren</b> doe jij? <b>{doen}%</b>
        </span>
        <input type="range" min={0} max={100} step={5} value={doen} onChange={(e) => zetDoen(Number(e.target.value))} />
      </label>
      <div className="blad-voet">
        <button className="knop stil" onClick={klaar}>
          Sla over
        </button>
        <button
          className="knop hoofd"
          disabled={bezig}
          onClick={async () => (await doe({ type: "inschatting.opslaan", denkwerk: denk, uitvoeren: doen })) && klaar()}
        >
          Opslaan en cijfers bekijken
        </button>
      </div>
    </div>
  );
}

function Vergelijking({ inzicht }: { inzicht: InzichtData }) {
  const { staat, ik } = useGezin();
  const { allemaal, per } = inschattingenVanRonde(staat);
  const ingevuld = per.filter((p) => p.denkwerk !== null);
  if (!ingevuld.length) return null;
  if (!allemaal) {
    const wachtOp = per.filter((p) => p.denkwerk === null).map((p) => p.lid.naam);
    const ikKlaar = per.find((p) => p.lid.id === ik)?.denkwerk !== null;
    return (
      <div className="kaart">
        <h3>Jullie inschatting</h3>
        <p className="stil">
          {ikKlaar ? `Je inschatting staat klaar. Nog wachten op ${wachtOp.join(" en ")}.` : `${ingevuld.map((p) => p.lid.naam).join(" en ")} heeft al ingevuld. Vul jij ook in, dan zie je elkaars inschatting.`}
        </p>
      </div>
    );
  }
  const gemeten = (lid: Lid) => inzicht.ouders.find((o) => o.lid.id === lid.id);
  const somDenk = per.reduce((s, p) => s + (p.denkwerk ?? 0), 0);
  return (
    <div className="kaart">
      <h3>Hoe jullie het zien, naast wat de app telt</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem", marginTop: 6 }}>
        <thead>
          <tr className="stil klein" style={{ textAlign: "left" }}>
            <th style={{ fontWeight: 500, padding: "4px 0" }}></th>
            <th style={{ fontWeight: 500 }}>Denkwerk</th>
            <th style={{ fontWeight: 500 }}>Uitvoeren</th>
          </tr>
        </thead>
        <tbody>
          {per.map((p) => {
            const g = gemeten(p.lid);
            return (
              <tr key={p.lid.id} style={{ borderTop: "1px solid var(--rand)" }}>
                <td style={{ padding: "8px 0" }}>
                  <span className="rij">
                    <Bolletje lid={p.lid} klein /> {p.lid.naam}
                  </span>
                </td>
                <td>
                  zelf: <b>{p.denkwerk}%</b>
                  <br />
                  <span className="stil">app: {g ? pct(g.aandeelDenkwerk) : "–"}</span>
                </td>
                <td>
                  zelf: <b>{p.uitvoeren}%</b>
                  <br />
                  <span className="stil">app: {g ? pct(g.aandeelUitvoeren) : "–"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="stil klein" style={{ marginTop: 8 }}>
        Samen komen jullie bij het denkwerk op {somDenk}%.{" "}
        {somDenk > 105
          ? "Meer dan 100% is heel gewoon: ieder ziet vooral het eigen werk, en het werk van de ander minder."
          : somDenk < 95
            ? "Minder dan 100%: misschien ligt er werk dat niemand als het zijne ziet."
            : "Jullie beelden sluiten goed op elkaar aan."}
      </p>
    </div>
  );
}

function WeekTrend({ inzicht }: { inzicht: InzichtData }) {
  const max = Math.max(1, ...inzicht.weken.map((w) => Object.values(w.denkwerk).reduce((s, x) => s + x, 0)));
  if (inzicht.weken.length < 2) return null;
  return (
    <div className="kaart">
      <h3>Denkwerk per week</h3>
      <div className="weekbalken" role="img" aria-label="Denkwerkpunten per week per ouder">
        {inzicht.weken.map((w) => {
          const tot = Object.values(w.denkwerk).reduce((s, x) => s + x, 0);
          return (
            <div key={w.maandag} className="weekbalk" style={{ height: `${(tot / max) * 100}%` }} title={`Week van ${kortLabel(w.maandag)}: ${Math.round(tot)} punten`}>
              {inzicht.ouders.map((o) => (
                <i key={o.lid.id} style={{ height: tot ? `${(w.denkwerk[o.lid.id] / tot) * 100}%` : 0, background: o.lid.kleur }} />
              ))}
            </div>
          );
        })}
      </div>
      <div className="weeklabels">
        {inzicht.weken.map((w) => (
          <span key={w.maandag}>wk {dag(w.maandag).weekNumber}</span>
        ))}
      </div>
    </div>
  );
}

export function Inzicht({ naarTaken }: { naarTaken: () => void }) {
  const { staat, ouders, ik, doe, bezig } = useGezin();
  const [dagen, zetDagen] = useState(28);
  const [overgeslagen, zetOvergeslagen] = useState(false);
  const [afspraken, zetAfspraken] = useState("");
  const vandaag = vandaagDatum();
  const van = plusDagen(vandaag, -(dagen - 1));
  const inzicht = useMemo(() => berekenInzicht(staat, van, vandaag, vandaag), [staat, van, vandaag]);
  const mijnInschatting = staat.inschattingen.find((i) => i.door === ik && i.ronde === staat.ronde);

  if (ouders.length < 2) {
    return (
      <>
        <div className="kop">
          <h1>Inzicht</h1>
        </div>
        <div className="uitleg">Voeg bij Gezin een tweede ouder toe om de verdeling te kunnen vergelijken.</div>
      </>
    );
  }

  if (!mijnInschatting && !overgeslagen) {
    return (
      <>
        <div className="kop">
          <h1>Inzicht</h1>
        </div>
        <Inschatten klaar={() => zetOvergeslagen(true)} />
      </>
    );
  }

  const zonder = inzicht.zonderEigenaar;
  const ander = (id: string) => ouders.find((o) => o.id !== id);

  return (
    <>
      <div className="kop">
        <div>
          <h1>Inzicht</h1>
          <div className="sub">
            {kortLabel(van)} t/m {kortLabel(vandaag)}
          </div>
        </div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <Keuzes label="Periode" waarde={dagen} kies={zetDagen} opties={PERIODES} />
      </div>

      <div className="uitleg">
        <b>Mentale last</b> is het werk dat je niet ziet: eraan denken, vooruitplannen, afstemmen en bewaken dat het gebeurt. Het
        uitvoeren is het zichtbare deel. De app telt die twee apart, want ze zijn vaak heel anders verdeeld.
        <details>
          <summary>Hoe rekent de app?</summary>
          <p className="klein">
            <b>Denkwerk:</b> elke keer dat een taak aan de beurt is, krijgt de eigenaar 1, 2 of 3 punten (licht, gemiddeld, zwaar). Ook als
            iemand anders hem uitvoert, of als hij is blijven liggen. Een afspraak regelen is 1 punt, en iets vastleggen bij &quot;Opgemerkt&quot; of een
            losse taak aanmaken ook.
          </p>
          <p className="klein">
            <b>Uitvoeren:</b> de minuten van afgevinkte taken voor wie het deed, plus de duur van afspraken die je regelt.
          </p>
          <p className="klein">
            Dit is een eigen schatting om het gesprek te voeden, geen meting. Wat niet in de app staat, telt niet mee.
          </p>
        </details>
      </div>

      {!inzicht.genoegGegevens && (
        <div className="waarschuwing">
          Er is nog weinig afgevinkt in deze periode, dus de cijfers zeggen nog niet veel. Kijk ook naar &quot;Zo verdeelt jullie
          takenlijst het werk&quot; hieronder.
        </div>
      )}

      <div className="kaart">
        <h3>Denkwerk</h3>
        <Verdeling
          delen={[...inzicht.ouders.map((o) => ({ lid: o.lid, waarde: o.denkwerk })), ...(zonder.punten ? [{ waarde: zonder.punten }] : [])]}
          eenheid={(w) => `${Math.round(w)} pt`}
        />
        <div className="tegels" style={{ marginTop: 12 }}>
          {inzicht.ouders.map((o) => (
            <div className="tegel klein" key={o.lid.id}>
              <div className="rij" style={{ marginBottom: 4 }}>
                <Bolletje lid={o.lid} klein /> <b>{o.lid.naam}</b>
              </div>
              eigen taken: {o.uitEigenaarschap} pt
              <br />
              afspraken regelen: {o.uitRegelen} pt
              <br />
              opgemerkt: {o.uitOpmerken} pt
            </div>
          ))}
        </div>
        {zonder.taken.length > 0 && (
          <p className="klein" style={{ marginTop: 10 }}>
            <span className="label let">{zonder.taken.length} taken zonder eigenaar</span> Het denkwerk daarvan ligt nu bij niemand, of
            ongemerkt bij een van jullie.{" "}
            <button className="knop klein" onClick={naarTaken}>
              Samen verdelen
            </button>
          </p>
        )}
      </div>

      <div className="kaart">
        <h3>Uitvoeren</h3>
        <Verdeling delen={inzicht.ouders.map((o) => ({ lid: o.lid, waarde: o.uitvoerMin }))} eenheid={urenLabel} />
        <div className="tegels" style={{ marginTop: 12 }}>
          {inzicht.ouders.map((o) => (
            <div className="tegel klein" key={o.lid.id}>
              <div className="rij" style={{ marginBottom: 4 }}>
                <Bolletje lid={o.lid} klein /> <b>{o.lid.naam}</b>
              </div>
              {o.takenGedaan} keer iets afgevinkt
              <br />
              {o.overgenomen} keer een taak van {ander(o.lid.id)?.naam ?? "de ander"} gedaan
              <br />
              {o.blijvenLiggen} keer een eigen taak blijven liggen
            </div>
          ))}
        </div>
        {inzicht.kinderenMin > 0 && <p className="stil klein">De kinderen deden samen {urenLabel(inzicht.kinderenMin)}.</p>}
      </div>

      <Vergelijking inzicht={inzicht} />

      <div className="kaart">
        <h3>Zo verdeelt jullie takenlijst het werk</h3>
        <p className="stil klein">Gemiddeld per week, volgens wie nu eigenaar en uitvoerder is (los van wat er is afgevinkt).</p>
        <div className="veld-label" style={{ marginTop: 8 }}>
          Denkwerk
        </div>
        <Verdeling
          delen={[...ouders.map((o) => ({ lid: o, waarde: inzicht.structureel[o.id]?.denkwerk ?? 0 })), { waarde: inzicht.structureel[""].denkwerk }]}
          eenheid={(w) => `${Math.round(w)} pt/week`}
        />
        <div className="veld-label" style={{ marginTop: 12 }}>
          Uitvoeren
        </div>
        <Verdeling
          delen={[
            ...staat.leden
              .map((l) => ({ lid: l, waarde: inzicht.structureel[l.id]?.uitvoerMin ?? 0 }))
              .filter((d) => d.lid.rol === "ouder" || d.waarde > 0),
            { waarde: inzicht.structureel[""].uitvoerMin },
          ]}
          eenheid={(w) => `${urenLabel(w)}/week`}
        />
      </div>

      {inzicht.categorieen.length > 0 && (
        <div className="kaart">
          <h3>Denkwerk per soort taak</h3>
          {inzicht.categorieen.map((c) => (
            <div key={c.categorie} style={{ marginTop: 10 }}>
              <div className="klein" style={{ marginBottom: 3 }}>
                {c.naam}
              </div>
              <Verdeling delen={[...ouders.map((o) => ({ lid: o, waarde: c.punten[o.id] ?? 0 })), { waarde: c.punten[""] ?? 0 }]} />
            </div>
          ))}
        </div>
      )}

      <WeekTrend inzicht={inzicht} />

      <div className="kaart">
        <h3>Wat het meeste denkwerk vroeg</h3>
        <p className="stil klein">Wil je iets overdragen? Draag dan de hele taak over: eraan denken, plannen én uitvoeren.</p>
        {inzicht.ouders.map((o) => {
          const lijst = inzicht.zwaarste[o.lid.id] ?? [];
          const naar = ander(o.lid.id);
          return (
            <div key={o.lid.id} style={{ marginTop: 10 }}>
              <div className="rij">
                <Bolletje lid={o.lid} klein /> <b>{o.lid.naam}</b>
              </div>
              {lijst.length ? (
                <ul className="lijst">
                  {lijst.map((b) => (
                    <li key={b.taak.id}>
                      <div className="hoofdtekst">
                        <div className="titel">{b.taak.titel}</div>
                        <div className="meta">{b.punten} punten in deze periode</div>
                      </div>
                      {naar && !b.taak.gearchiveerd && b.taak.eigenaar === o.lid.id && (
                        <button
                          className="knop klein"
                          disabled={bezig}
                          onClick={() =>
                            confirm(`"${b.taak.titel}" helemaal overdragen aan ${naar.naam}?`) &&
                            doe({ type: "taak.overdragen", taakId: b.taak.id, naar: naar.id, heelPakket: true })
                          }
                        >
                          Naar {naar.naam}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="stil klein">Nog niets.</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="kaart">
        <h2>Het gesprek</h2>
        <p className="stil klein">
          Neem er samen rustig de tijd voor, bijvoorbeeld eens per maand. Het doel is niet om te scoren, maar om elkaar te begrijpen en
          afspraken te maken die voor jullie allebei werken.
        </p>
        <ol style={{ paddingLeft: 20, margin: "8px 0" }}>
          {GESPREKSVRAGEN.map((v) => (
            <li key={v} style={{ marginBottom: 4 }}>
              {v}
            </li>
          ))}
        </ol>
        <label className="veld" style={{ marginTop: 12 }}>
          <span>Wat spreken jullie af?</span>
          <textarea
            value={afspraken}
            maxLength={4000}
            onChange={(e) => zetAfspraken(e.target.value)}
            placeholder="Bram neemt het weekmenu en de boodschappenlijst helemaal over. Over een maand kijken we hoe het gaat."
          />
        </label>
        <button
          className="knop hoofd"
          disabled={bezig || !afspraken.trim()}
          onClick={async () => {
            if (await doe({ type: "gesprek.opslaan", datum: vandaag, afspraken })) {
              zetAfspraken("");
              zetOvergeslagen(false);
            }
          }}
        >
          Afspraken vastleggen
        </button>
        <p className="stil klein">Daarna begint een nieuwe ronde: jullie kunnen dan opnieuw inschatten voor het volgende gesprek.</p>
        {staat.gesprekken.length > 0 && (
          <>
            <h3 style={{ marginTop: 14 }}>Eerdere afspraken</h3>
            <ul className="lijst">
              {[...staat.gesprekken].reverse().map((g) => (
                <li key={g.id} style={{ display: "block" }}>
                  <div className="meta">{kortLabel(g.datum)}</div>
                  <div style={{ whiteSpace: "pre-wrap" }}>{g.afspraken}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
