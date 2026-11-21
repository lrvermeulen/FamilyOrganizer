"use client";

import { useState } from "react";
import { AFDELINGEN, splitsBoodschappen } from "@/lib/boodschappen";
import { dag, kortLabel, maandagVan, plusDagen, vandaag as vandaagDatum, WEEKDAG_LANG } from "@/lib/datum";
import type { Maaltijd } from "@/lib/types";
import { useGezin } from "./context";
import { Taken } from "./Taken";
import { Blad, Bolletje, Keuzes } from "./ui";

export function MaaltijdBlad({ datum, sluit }: { datum: string; sluit: () => void }) {
  const { staat, doe, bezig } = useGezin();
  const bestaand = staat.maaltijden.find((m) => m.datum === datum);
  const [m, zet] = useState<Maaltijd>(bestaand ?? { datum, wat: "", kok: null, ingredienten: [] });
  const [ingr, zetIngr] = useState((bestaand?.ingredienten ?? []).join("\n"));
  const eerder = [...new Set(staat.maaltijden.filter((x) => x.wat && x.datum !== datum).map((x) => x.wat))].slice(-12).reverse();

  const lijst = () => ingr.split("\n").map((x) => x.trim()).filter(Boolean);
  const opslaan = async (ookBoodschappen: boolean) => {
    const ingredienten = lijst();
    if (!(await doe({ type: "maaltijd.opslaan", maaltijd: { ...m, ingredienten } }))) return;
    if (ookBoodschappen && ingredienten.length) {
      if (!(await doe({ type: "boodschappen.toevoegen", namen: ingredienten, voor: datum }))) return;
    }
    sluit();
  };

  return (
    <Blad titel={`Eten op ${WEEKDAG_LANG[dag(datum).weekday - 1]} ${dag(datum).day}`} sluit={sluit}>
      <label className="veld">
        <span>Wat eten we?</span>
        <input type="text" maxLength={120} value={m.wat} autoFocus onChange={(e) => zet({ ...m, wat: e.target.value })} placeholder="Taco's" />
      </label>
      {eerder.length > 0 && !m.wat && (
        <div style={{ marginBottom: 12 }}>
          <div className="veld-label">Eerder gegeten</div>
          <div className="keuzes">
            {eerder.map((w) => (
              <button
                key={w}
                type="button"
                className="chip"
                onClick={() => {
                  const vorige = [...staat.maaltijden].reverse().find((x) => x.wat === w);
                  zet({ ...m, wat: w });
                  if (vorige?.ingredienten.length && !ingr) zetIngr(vorige.ingredienten.join("\n"));
                }}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="veld" style={{ marginBottom: 12 }}>
        <span className="veld-label">Wie kookt?</span>
        <Keuzes
          label="Kok"
          waarde={m.kok}
          kies={(kok) => zet({ ...m, kok })}
          opties={[...staat.leden.map((l) => ({ waarde: l.id as string | null, label: l.naam })), { waarde: null, label: "Nog niet bekend" }]}
        />
      </div>
      <label className="veld">
        <span>Ingrediënten (één per regel, optioneel)</span>
        <textarea value={ingr} onChange={(e) => zetIngr(e.target.value)} placeholder={"tortilla's\ngehakt\nsla"} />
      </label>
      <div className="blad-voet">
        {bestaand ? (
          <button
            className="knop gevaar"
            disabled={bezig}
            onClick={async () => (await doe({ type: "maaltijd.opslaan", maaltijd: { datum, wat: "", kok: null, ingredienten: [] } })) && sluit()}
          >
            Leegmaken
          </button>
        ) : (
          <span />
        )}
        <div className="rij">
          {lijst().length > 0 && (
            <button className="knop" disabled={bezig} onClick={() => opslaan(true)}>
              Opslaan + op de lijst
            </button>
          )}
          <button className="knop hoofd" disabled={bezig} onClick={() => opslaan(false)}>
            Opslaan
          </button>
        </div>
      </div>
    </Blad>
  );
}

function Boodschappen() {
  const { staat, lid, doe, bezig } = useGezin();
  const [nieuw, zetNieuw] = useState("");
  const open = staat.boodschappen.filter((b) => !b.gekocht);
  const gekocht = staat.boodschappen.filter((b) => b.gekocht);

  const toevoegen = async (e: React.FormEvent) => {
    e.preventDefault();
    const namen = splitsBoodschappen(nieuw);
    if (namen.length && (await doe({ type: "boodschappen.toevoegen", namen }))) zetNieuw("");
  };

  const delen = async () => {
    const tekst = AFDELINGEN.flatMap((a) => {
      const items = open.filter((b) => b.afdeling === a);
      return items.length ? [`${a}:`, ...items.map((b) => `- ${b.naam}`)] : [];
    }).join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "Boodschappen", text: tekst });
      else await navigator.clipboard.writeText(tekst);
    } catch {
      // Delen geannuleerd.
    }
  };

  return (
    <>
      <form className="kaart rij" onSubmit={toevoegen} style={{ flexWrap: "nowrap" }}>
        <input
          type="text"
          value={nieuw}
          onChange={(e) => zetNieuw(e.target.value)}
          placeholder="melk, kaas, appels"
          aria-label="Boodschap toevoegen"
          style={{ flex: 1, minWidth: 0 }}
        />
        <button className="knop hoofd" disabled={bezig || !nieuw.trim()}>
          +
        </button>
      </form>
      {open.length === 0 && <p className="stil">De lijst is leeg.</p>}
      {AFDELINGEN.map((a) => {
        const items = open.filter((b) => b.afdeling === a);
        if (!items.length) return null;
        return (
          <div className="kaart" key={a}>
            <h3>{a}</h3>
            <ul className="lijst">
              {items.map((b) => (
                <li key={b.id}>
                  <button
                    className="vinkknop"
                    aria-label={`${b.naam} gekocht`}
                    disabled={bezig}
                    onClick={() => doe({ type: "boodschap.afvinken", id: b.id, gekocht: true })}
                  />
                  <div className="hoofdtekst">
                    <div className="titel">{b.naam}</div>
                    {b.voor && <div className="meta">voor {kortLabel(b.voor)}</div>}
                  </div>
                  <Bolletje lid={lid(b.door)} klein />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {open.length > 0 && (
        <div className="rij" style={{ marginBottom: 14 }}>
          <button className="knop klein" onClick={delen}>
            Lijst delen of kopiëren
          </button>
          <span className="stil klein">Bijvoorbeeld om af te lopen in de Picnic-app.</span>
        </div>
      )}
      {gekocht.length > 0 && (
        <div className="kaart">
          <div className="kaart-kop">
            <h3>Gekocht</h3>
            <button className="knop klein" disabled={bezig} onClick={() => doe({ type: "boodschappen.opruimen" })}>
              Opruimen
            </button>
          </div>
          <ul className="lijst">
            {gekocht.map((b) => (
              <li key={b.id} className="gedaan">
                <button
                  className="vinkknop aan"
                  aria-label={`${b.naam} toch niet gekocht`}
                  disabled={bezig}
                  onClick={() => doe({ type: "boodschap.afvinken", id: b.id, gekocht: false })}
                >
                  ✓
                </button>
                <div className="hoofdtekst">
                  <div className="titel">{b.naam}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function Menu() {
  const { staat, lid } = useGezin();
  const vandaag = vandaagDatum();
  const [maandag, zetMaandag] = useState(maandagVan(vandaag));
  const [kies, zetKies] = useState<string | null>(null);
  return (
    <>
      <div className="rij tussen" style={{ marginBottom: 10 }}>
        <b>
          Week {dag(maandag).weekNumber} · {kortLabel(maandag)}
        </b>
        <div className="rij">
          <button className="knop klein" onClick={() => zetMaandag(plusDagen(maandag, -7))} aria-label="Vorige week">
            ‹
          </button>
          <button className="knop klein" onClick={() => zetMaandag(plusDagen(maandag, 7))} aria-label="Volgende week">
            ›
          </button>
        </div>
      </div>
      <div className="kaart">
        <ul className="lijst">
          {Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i)).map((d, i) => {
            const m = staat.maaltijden.find((x) => x.datum === d);
            return (
              <li key={d}>
                <button className="regel" onClick={() => zetKies(d)}>
                  <div className="meta" style={d === vandaag ? { color: "var(--accent)", fontWeight: 600 } : undefined}>
                    {WEEKDAG_LANG[i]} {dag(d).day}
                  </div>
                  <div className="titel">{m?.wat || <span className="stil">+ wat eten we?</span>}</div>
                  {m?.ingredienten.length ? <div className="meta">{m.ingredienten.join(", ")}</div> : null}
                </button>
                {m?.kok && <Bolletje lid={lid(m.kok)} klein />}
              </li>
            );
          })}
        </ul>
      </div>
      {kies && <MaaltijdBlad datum={kies} sluit={() => zetKies(null)} />}
    </>
  );
}

export function Lijsten() {
  const { staat } = useGezin();
  const [stand, zet] = useState<"taken" | "boodschappen" | "menu">(() =>
    typeof window !== "undefined" && location.hash === "#boodschappen" ? "boodschappen" : "taken",
  );
  const open = staat.boodschappen.filter((b) => !b.gekocht).length;
  return (
    <>
      <div style={{ marginBottom: 14 }}>
        <Keuzes
          label="Lijst"
          waarde={stand}
          kies={zet}
          opties={[
            { waarde: "taken", label: "Taken" },
            { waarde: "boodschappen", label: open ? `Boodschappen (${open})` : "Boodschappen" },
            { waarde: "menu", label: "Menu" },
          ]}
        />
      </div>
      {stand === "taken" && <Taken />}
      {stand === "boodschappen" && (
        <>
          <div className="kop">
            <h1>Boodschappen</h1>
          </div>
          <Boodschappen />
        </>
      )}
      {stand === "menu" && (
        <>
          <div className="kop">
            <h1>Menu</h1>
          </div>
          <Menu />
        </>
      )}
    </>
  );
}
