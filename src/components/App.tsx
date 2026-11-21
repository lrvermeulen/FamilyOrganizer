"use client";

import { useCallback, useEffect, useState } from "react";
import { Agenda } from "./Agenda";
import { GezinProvider, useGezin, type Gegevens } from "./context";
import { AfspraakFormulier, OpgemerktFormulier, TaakFormulier } from "./Formulieren";
import { Gezin } from "./Gezin";
import { Inzicht } from "./Inzicht";
import { KiesWie, Login } from "./Login";
import { Start } from "./Start";
import { Taken } from "./Taken";
import { Vandaag } from "./Vandaag";

const TABS = [
  { id: "vandaag", naam: "Vandaag", ico: "☀︎" },
  { id: "agenda", naam: "Agenda", ico: "▦" },
  { id: "taken", naam: "Taken", ico: "☑︎" },
  { id: "inzicht", naam: "Inzicht", ico: "◐" },
  { id: "gezin", naam: "Gezin", ico: "⌂" },
];

type Toestand = { soort: "laden" } | { soort: "login" } | { soort: "fout"; bericht: string } | { soort: "klaar"; gegevens: Gegevens };

export function App() {
  const [toestand, zet] = useState<Toestand>({ soort: "laden" });

  const laad = useCallback(async () => {
    try {
      const res = await fetch("/api/staat", { cache: "no-store" });
      if (res.status === 401) return zet({ soort: "login" });
      const data = await res.json();
      if (!res.ok) return zet({ soort: "fout", bericht: data.fout ?? `Fout ${res.status}` });
      zet({ soort: "klaar", gegevens: data as Gegevens });
    } catch {
      zet({ soort: "fout", bericht: "De app is niet bereikbaar. Heb je internet?" });
    }
  }, []);

  useEffect(() => {
    void laad();
    // Bij terugkomen in de app: verversen, zodat je ziet wat de ander deed.
    const zichtbaar = () => document.visibilityState === "visible" && void laad();
    document.addEventListener("visibilitychange", zichtbaar);
    return () => document.removeEventListener("visibilitychange", zichtbaar);
  }, [laad]);

  if (toestand.soort === "laden") return <div className="midden stil">Laden…</div>;
  if (toestand.soort === "login") return <Login klaar={laad} />;
  if (toestand.soort === "fout")
    return (
      <div className="midden">
        <div className="kaart">
          <h2>Er ging iets mis</h2>
          <p>{toestand.bericht}</p>
          <button className="knop" onClick={laad}>
            Opnieuw proberen
          </button>
        </div>
      </div>
    );

  const g = toestand.gegevens;
  if (g.staat.leden.length === 0) return <Start klaar={laad} />;
  const ouders = g.staat.leden.filter((l) => l.rol === "ouder");
  if (!g.ik) return <KiesWie ouders={ouders} klaar={laad} />;

  return (
    <GezinProvider gegevens={g} zet={(gegevens) => zet({ soort: "klaar", gegevens })} herlaad={laad}>
      <Schil />
    </GezinProvider>
  );
}

function Schil() {
  const { staat, modus, melding, meld } = useGezin();
  const [tab, zetTab] = useState(() => (typeof window !== "undefined" && TABS.some((t) => `#${t.id}` === location.hash) ? location.hash.slice(1) : "vandaag"));
  const [plus, zetPlus] = useState(false);
  const [blad, zetBlad] = useState<null | { soort: "taak" } | { soort: "opgemerkt" } | { soort: "afspraak"; id?: string; datum?: string }>(null);

  const naarTab = (t: string) => {
    zetTab(t);
    history.replaceState(null, "", `#${t}`);
    window.scrollTo({ top: 0 });
  };
  useEffect(() => {
    if (!melding) return;
    const t = setTimeout(() => meld(null), 6000);
    return () => clearTimeout(t);
  }, [melding, meld]);

  const afspraak = blad?.soort === "afspraak" && blad.id ? staat.afspraken.find((a) => a.id === blad.id) : undefined;

  return (
    <>
      {modus === "demo" && <div className="demo-balk">Demo met een voorbeeldgezin. Wijzigingen zijn alleen om te proberen.</div>}
      <main className="wrap">
        {tab === "vandaag" && <Vandaag naarTab={naarTab} bewerkAfspraak={(id) => zetBlad({ soort: "afspraak", id })} />}
        {tab === "agenda" && (
          <Agenda
            naarTab={naarTab}
            nieuweAfspraak={(datum) => zetBlad({ soort: "afspraak", datum })}
            bewerkAfspraak={(id) => zetBlad({ soort: "afspraak", id })}
          />
        )}
        {tab === "taken" && <Taken />}
        {tab === "inzicht" && <Inzicht naarTaken={() => naarTab("taken")} />}
        {tab === "gezin" && <Gezin />}
      </main>

      {plus && (
        <div className="plus-menu">
          <button className="knop" onClick={() => (zetPlus(false), zetBlad({ soort: "opgemerkt" }))}>
            💭 Opgemerkt
          </button>
          <button className="knop" onClick={() => (zetPlus(false), zetBlad({ soort: "taak" }))}>
            ☑︎ Taak
          </button>
          <button className="knop" onClick={() => (zetPlus(false), zetBlad({ soort: "afspraak" }))}>
            ▦ Afspraak
          </button>
        </div>
      )}
      <button className="plus" aria-label={plus ? "Sluiten" : "Toevoegen"} aria-expanded={plus} onClick={() => zetPlus(!plus)}>
        {plus ? "×" : "+"}
      </button>

      <div className="tabs">
        <nav aria-label="Onderdelen">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => naarTab(t.id)}>
              <span className="ico" aria-hidden>
                {t.ico}
              </span>
              {t.naam}
            </button>
          ))}
        </nav>
      </div>

      {melding && (
        <div className="melding" role="alert">
          <span>{melding}</span>
          <button className="knop stil klein" onClick={() => meld(null)} aria-label="Sluiten">
            ✕
          </button>
        </div>
      )}

      {blad?.soort === "taak" && <TaakFormulier sluit={() => zetBlad(null)} />}
      {blad?.soort === "opgemerkt" && <OpgemerktFormulier sluit={() => zetBlad(null)} />}
      {blad?.soort === "afspraak" && <AfspraakFormulier afspraak={afspraak} datum={blad.datum} sluit={() => zetBlad(null)} />}
    </>
  );
}
