"use client";

import { useCallback, useEffect, useState } from "react";
import { Bord } from "./Bord";
import { GezinProvider, useGezin, type Gegevens } from "./context";
import { AfspraakFormulier, TaakFormulier } from "./Formulieren";
import { Gezin } from "./Gezin";
import { Inbox } from "./Inbox";
import { Invoerregel } from "./Invoer";
import { Inzicht } from "./Inzicht";
import { Lijsten } from "./Lijsten";
import { KiesWie, Login } from "./Login";
import { Start } from "./Start";
import { Blad } from "./ui";

const TABS = [
  { id: "bord", naam: "Bord", ico: "▦" },
  { id: "inbox", naam: "Inbox", ico: "⇣" },
  { id: "lijsten", naam: "Lijsten", ico: "☑︎" },
  { id: "inzicht", naam: "Inzicht", ico: "◐" },
  { id: "gezin", naam: "Gezin", ico: "⌂" },
];
/** Oude adressen (#vandaag, #agenda, #taken) blijven werken. */
const OUD: Record<string, string> = { vandaag: "bord", agenda: "bord", taken: "lijsten", boodschappen: "lijsten" };

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
  const [tab, zetTab] = useState(() => {
    if (typeof window === "undefined") return "bord";
    const h = location.hash.slice(1);
    return TABS.some((t) => t.id === h) ? h : (OUD[h] ?? "bord");
  });
  const [blad, zetBlad] = useState<null | { soort: "snel" } | { soort: "taak" } | { soort: "afspraak"; id?: string; datum?: string; origineel?: string }>(null);
  const { ik } = useGezin();
  const inbox =
    staat.opgemerkt.filter((o) => !o.afgehandeld).length + staat.verzoeken.filter((v) => v.aan === ik && v.status === "open").length;

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
        {tab === "bord" && (
          <Bord
            naarTab={naarTab}
            nieuweAfspraak={(datum) => zetBlad({ soort: "afspraak", datum })}
            bewerkAfspraak={(id, origineel) => zetBlad({ soort: "afspraak", id, origineel })}
          />
        )}
        {tab === "inbox" && <Inbox />}
        {tab === "lijsten" && <Lijsten />}
        {tab === "inzicht" && <Inzicht naarTaken={() => naarTab("taken")} />}
        {tab === "gezin" && <Gezin />}
      </main>

      <button className="plus" aria-label="Snel toevoegen" onClick={() => zetBlad({ soort: "snel" })}>
        +
      </button>

      <div className="tabs">
        <nav aria-label="Onderdelen">
          {TABS.map((t) => (
            <button key={t.id} aria-current={tab === t.id ? "page" : undefined} onClick={() => naarTab(t.id)}>
              <span className="ico" aria-hidden>
                {t.ico}
                {t.id === "inbox" && inbox > 0 && <i className="teller">{inbox}</i>}
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

      {blad?.soort === "snel" && (
        <Blad titel="Snel toevoegen" sluit={() => zetBlad(null)}>
          <Invoerregel compact klaar={() => zetBlad(null)} />
          <div className="rij" style={{ marginTop: 6 }}>
            <span className="stil klein">Of uitgebreid:</span>
            <button className="knop klein" onClick={() => zetBlad({ soort: "afspraak" })}>
              Afspraak
            </button>
            <button className="knop klein" onClick={() => zetBlad({ soort: "taak" })}>
              Taak
            </button>
          </div>
        </Blad>
      )}
      {blad?.soort === "taak" && <TaakFormulier sluit={() => zetBlad(null)} />}
      {blad?.soort === "afspraak" && <AfspraakFormulier afspraak={afspraak} datum={blad.datum} origineel={blad.origineel} sluit={() => zetBlad(null)} />}
    </>
  );
}
