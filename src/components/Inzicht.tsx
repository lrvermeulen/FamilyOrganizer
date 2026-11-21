"use client";

import { useMemo, useState } from "react";
import { dag, kortLabel, plusDagen, urenLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { herhalingLabel } from "@/lib/herhaling";
import {
  aandeelUitKaartjes,
  berekenInzicht,
  GESPREKSVRAGEN,
  inschattingenVanRonde,
  kaartjes,
  verschillen,
  type Inzicht as InzichtData,
  type OuderInzicht,
  type Vergelijking,
} from "@/lib/inzicht";
import type { Antwoord, Lid } from "@/lib/types";
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

/**
 * De kaartjesronde: ieder geeft los van de ander per taak aan wie het in het hoofd heeft.
 * Daarna één vraag over het uitvoeren. Pas als jullie allebei klaar zijn, zie je elkaars antwoorden.
 */
function Kaartjesronde({ klaar }: { klaar: () => void }) {
  const { staat, doe, bezig, ouders, ik } = useGezin();
  const ander = ouders.find((o) => o.id !== ik);
  const lijst = kaartjes(staat);
  const antwoorden = new Map(staat.percepties.filter((p) => p.door === ik && p.ronde === staat.ronde).map((p) => [p.taakId, p.antwoord]));
  const eersteOpen = lijst.findIndex((t) => !antwoorden.has(t.id));
  const [stap, zetStap] = useState(eersteOpen < 0 ? lijst.length : eersteOpen);
  const [doen, zetDoen] = useState(50);
  const [begonnen, zetBegonnen] = useState(antwoorden.size > 0);

  if (!begonnen) {
    return (
      <div className="kaart">
        <h2>Eerst: hoe zie jij het?</h2>
        <p className="stil">
          Je krijgt {lijst.length} taken te zien. Geef bij elke taak aan wie het bij jullie <b>in het hoofd heeft</b>: eraan denken,
          plannen, bewaken. Doe het los van elkaar, op je eigen telefoon. {ander ? `${ander.naam} ziet` : "De ander ziet"} jouw antwoorden
          pas als jullie allebei klaar zijn. Waar jullie het verschillend zien, begint het gesprek.
        </p>
        <p className="stil klein">Duurt een paar minuten. Je kunt tussendoor stoppen en later verder.</p>
        <div className="blad-voet">
          <button className="knop stil" onClick={klaar}>
            Sla over, toon de cijfers
          </button>
          <button className="knop hoofd" onClick={() => zetBegonnen(true)}>
            Beginnen
          </button>
        </div>
      </div>
    );
  }

  if (stap < lijst.length) {
    const t = lijst[stap];
    const huidig = antwoorden.get(t.id);
    const kies = async (antwoord: Antwoord) => {
      if (await doe({ type: "perceptie.opslaan", taakId: t.id, antwoord })) zetStap(stap + 1);
    };
    return (
      <div className="kaart kaartje">
        <div className="rij tussen stil klein">
          <span>
            {stap + 1} van {lijst.length}
          </span>
          <span>{t.werksoort === "emotioneel" ? "Emotioneel werk" : "Denkwerk"}</span>
        </div>
        <div className="voortgang">
          <i style={{ width: `${(stap / lijst.length) * 100}%` }} />
        </div>
        <h2 style={{ margin: "18px 0 4px" }}>{t.titel}</h2>
        <p className="stil klein">{herhalingLabel(t.herhaling)}</p>
        <p style={{ marginTop: 14 }}>Wie heeft dit bij jullie in het hoofd?</p>
        <div className="antwoorden">
          {(
            [
              ["ik", "Ik"],
              ["ander", ander?.naam ?? "De ander"],
              ["samen", "Samen"],
              ["weetniet", "Weet niet"],
              ["nvt", "Niet relevant"],
            ] as [Antwoord, string][]
          ).map(([a, label]) => (
            <button key={a} className={`knop ${huidig === a ? "hoofd" : ""}`} disabled={bezig} onClick={() => kies(a)}>
              {label}
            </button>
          ))}
        </div>
        <div className="blad-voet">
          <button className="knop stil" disabled={stap === 0} onClick={() => zetStap(stap - 1)}>
            ‹ Vorige
          </button>
          <button className="knop stil" onClick={klaar}>
            Later verder
          </button>
        </div>
      </div>
    );
  }

  const eigen = aandeelUitKaartjes(staat, ik ?? "");
  return (
    <div className="kaart">
      <h2>Nog één vraag</h2>
      <label className="veld" style={{ marginTop: 12 }}>
        <span>
          Welk deel van het <b>uitvoeren</b> (het zichtbare werk) doe jij, denk je? <b>{doen}%</b>
        </span>
        <input type="range" min={0} max={100} step={5} value={doen} onChange={(e) => zetDoen(Number(e.target.value))} />
      </label>
      <p className="stil klein">
        Volgens jouw kaartjes heb jij {eigen.denkwerk ?? "–"}% van het denkwerk in je hoofd
        {eigen.emotioneel !== null ? ` en ${eigen.emotioneel}% van het emotionele werk` : ""}.
      </p>
      <div className="blad-voet">
        <button className="knop stil" onClick={() => zetStap(lijst.length - 1)}>
          ‹ Terug
        </button>
        <button
          className="knop hoofd"
          disabled={bezig}
          onClick={async () =>
            (await doe({
              type: "inschatting.opslaan",
              denkwerk: eigen.denkwerk ?? 50,
              emotioneel: eigen.emotioneel ?? undefined,
              uitvoeren: doen,
            })) && klaar()
          }
        >
          Klaar, toon de cijfers
        </button>
      </div>
    </div>
  );
}

function Vergelijking({ inzicht }: { inzicht: InzichtData }) {
  const { staat, ik, ouders, doe, bezig, lid } = useGezin();
  const [alles, zetAlles] = useState(false);
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
          {ikKlaar
            ? `Jouw antwoorden staan klaar. Nog wachten op ${wachtOp.join(" en ")}.`
            : `${ingevuld.map((p) => p.lid.naam).join(" en ")} is al klaar. Doe jij de kaartjesronde ook, dan zien jullie elkaars antwoorden.`}
        </p>
      </div>
    );
  }
  const gemeten = (l: Lid) => inzicht.ouders.find((o) => o.lid.id === l.id);
  const somDenk = per.reduce((s, p) => s + (p.denkwerk ?? 0), 0);
  const { verschillen: lijst, gelijk } = verschillen(staat);
  const wie = (x: string | null) => (x === "samen" ? "samen" : (lid(x)?.naam ?? "weet niet"));
  const rijen: [string, keyof Omit<Vergelijking, "lid">, keyof OuderInzicht][] = [
    ["Denkwerk", "denkwerk", "aandeelDenkwerk"],
    ["Emotioneel", "emotioneel", "aandeelEmotioneel"],
    ["Uitvoeren", "uitvoeren", "aandeelUitvoeren"],
  ];
  return (
    <>
      <div className="kaart">
        <h3>Hoe jullie het zien, naast wat de app telt</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", marginTop: 6 }}>
          <thead>
            <tr className="stil klein" style={{ textAlign: "left" }}>
              <th style={{ fontWeight: 500, padding: "4px 0" }}></th>
              {per.map((p) => (
                <th key={p.lid.id} style={{ fontWeight: 500 }}>
                  {p.lid.naam}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.map(([label, eigen, app]) => (
              <tr key={label} style={{ borderTop: "1px solid var(--rand)" }}>
                <td style={{ padding: "8px 0" }}>{label}</td>
                {per.map((p) => {
                  const g = gemeten(p.lid);
                  const zelf = p[eigen] as number | null;
                  return (
                    <td key={p.lid.id}>
                      zelf: <b>{zelf === null ? "–" : `${zelf}%`}</b>
                      <br />
                      <span className="stil">app: {g ? pct(g[app] as number) : "–"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="stil klein" style={{ marginTop: 8 }}>
          &quot;Zelf&quot; is ieders eigen aandeel volgens de eigen kaartjes. Samen komen jullie bij het denkwerk op {somDenk}%.{" "}
          {somDenk > 105
            ? "Meer dan 100% is heel gewoon: ieder ziet vooral het eigen werk, en het werk van de ander minder."
            : somDenk < 95
              ? "Minder dan 100%: misschien ligt er werk dat niemand als het zijne ziet."
              : "Jullie beelden sluiten goed op elkaar aan."}
        </p>
      </div>

      <div className="kaart">
        <h3>Waar jullie het verschillend zien</h3>
        <p className="stil klein">
          Bij {gelijk} taken zien jullie het hetzelfde, bij {lijst.length} verschillend. Spreek per taak af wie hem in het hoofd heeft; dat
          wordt dan de eigenaar in de app.
        </p>
        {lijst.length === 0 ? (
          <p>Jullie zien het overal hetzelfde. 🎉</p>
        ) : (
          <ul className="lijst">
            {(alles ? lijst : lijst.slice(0, 8)).map((v) => (
              <li key={v.taak.id} style={{ display: "block" }}>
                <div className="titel">
                  <b>{v.taak.titel}</b>
                </div>
                <div className="meta">
                  {ouders.map((o) => `${o.naam}: ${wie(v.volgens[o.id])}`).join(" · ")} · nu in de app: {lid(v.eigenaar)?.naam ?? "niemand"}
                </div>
                <div className="rij" style={{ marginTop: 6 }}>
                  <span className="stil klein">Afgesproken:</span>
                  {ouders.map((o) => (
                    <button
                      key={o.id}
                      className={`chip ${v.eigenaar === o.id ? "aan" : ""}`}
                      disabled={bezig}
                      onClick={() => doe({ type: "taak.overdragen", taakId: v.taak.id, naar: o.id, heelPakket: false })}
                    >
                      {o.naam}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
        {!alles && lijst.length > 8 && (
          <button className="knop klein" onClick={() => zetAlles(true)}>
            Toon alle {lijst.length} (de zwaarste staan bovenaan)
          </button>
        )}
      </div>
    </>
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
        <Kaartjesronde klaar={() => zetOvergeslagen(true)} />
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
        <b>Mentale last</b> is het werk dat je niet ziet: <b>denkwerk</b> (eraan denken, vooruitplannen, afstemmen en bewaken) en{" "}
        <b>emotioneel werk</b> (aandacht en zorg, merken hoe het met iemand gaat). Het uitvoeren is het zichtbare deel. De app telt ze
        apart, want ze zijn vaak heel anders verdeeld.
        <details>
          <summary>Hoe rekent de app?</summary>
          <p className="klein">
            <b>Denkwerk:</b> elke keer dat een taak aan de beurt is, krijgt de eigenaar 1, 2 of 3 punten (licht, gemiddeld, zwaar). Ook als
            iemand anders hem uitvoert, of als hij is blijven liggen. Een afspraak regelen is 1 punt, en iets vastleggen in de inbox of een
            losse taak aanmaken ook.
          </p>
          <p className="klein">
            <b>Emotioneel werk:</b> taken die vooral om aandacht en zorg gaan (troosten, merken hoe het met de kinderen gaat, contact met
            familie). Doorlopende verantwoordelijkheden tellen zo vaak per week als ingesteld.
          </p>
          <p className="klein">
            <b>Uitvoeren:</b> de minuten van afgevinkte taken voor wie het deed, 20 minuten per keer brengen of halen, en de duur van
            afspraken die je regelt zonder dat iemand anders brengt of haalt.
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
        <h3>Emotioneel werk</h3>
        <Verdeling delen={inzicht.ouders.map((o) => ({ lid: o.lid, waarde: o.emotioneel }))} eenheid={(w) => `${Math.round(w)} pt`} />
        <p className="stil klein" style={{ marginTop: 6 }}>
          Aandacht en zorg: troosten, merken hoe het gaat, contact met school en familie. Voeg zulke verantwoordelijkheden toe als taak met
          &quot;Doorlopend&quot; en soort &quot;Emotioneel werk&quot;.
        </p>
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
              {o.ritten > 0 && (
                <>
                  <br />
                  {o.ritten} keer gebracht of gehaald
                </>
              )}
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
          Emotioneel werk
        </div>
        <Verdeling
          delen={[...ouders.map((o) => ({ lid: o, waarde: inzicht.structureel[o.id]?.emotioneel ?? 0 })), { waarde: inzicht.structureel[""].emotioneel }]}
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
          <h3>Onzichtbaar werk per soort taak</h3>
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
        <h3>Wat het meeste onzichtbare werk vroeg</h3>
        <p className="stil klein">Denkwerk en emotioneel werk samen. Wil je iets overdragen? Draag dan de hele taak over: eraan denken, plannen én uitvoeren.</p>
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
