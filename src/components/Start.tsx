"use client";

import { useState } from "react";
import { vandaag } from "@/lib/datum";
import { geboortejaarUit } from "@/lib/leden";
import { eersteKeer, SJABLONEN } from "@/lib/sjablonen";
import { CATEGORIEEN, KLEUREN, type Categorie } from "@/lib/types";
import { post } from "./context";

interface Rij {
  id: string;
  naam: string;
  rol: "ouder" | "kind";
  /** Zoals ingevuld: een leeftijd (7) of een geboortejaar (2019). */
  leeftijd?: string;
}

const nieuwId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/** Eerste keer: het gezin en de starttaken instellen. */
export function Start({ klaar }: { klaar: () => void }) {
  const [stap, zetStap] = useState(1);
  const [gezinsnaam, zetGezinsnaam] = useState("");
  const [leden, zetLeden] = useState<Rij[]>([
    { id: nieuwId(), naam: "", rol: "ouder" },
    { id: nieuwId(), naam: "", rol: "ouder" },
    { id: nieuwId(), naam: "", rol: "kind" },
    { id: nieuwId(), naam: "", rol: "kind" },
  ]);
  const [ik, zetIk] = useState<string>(leden[0].id);
  const [taken, zetTaken] = useState<Set<string>>(() => new Set(SJABLONEN.filter((s) => s.standaard).map((s) => s.titel)));
  const [fout, zetFout] = useState<string | null>(null);
  const [bezig, zetBezig] = useState(false);

  const ingevuld = leden.filter((l) => l.naam.trim());
  const ouders = ingevuld.filter((l) => l.rol === "ouder");
  const wijzig = (id: string, x: Partial<Rij>) => zetLeden((ls) => ls.map((l) => (l.id === id ? { ...l, ...x } : l)));

  const opslaan = async () => {
    zetBezig(true);
    zetFout(null);
    try {
      const start = vandaag();
      await post("/api/actie", {
        ik,
        actie: {
          type: "gezin.instellen",
          gezinsnaam,
          leden: ingevuld.map((l, i) => ({ id: l.id, naam: l.naam.trim(), rol: l.rol, geboortejaar: geboortejaarUit(l.leeftijd, new Date().getFullYear()), kleur: KLEUREN[i % KLEUREN.length] })),
          taken: SJABLONEN.filter((s) => taken.has(s.titel)).map((s, i) => ({
            titel: s.titel,
            categorie: s.categorie,
            notitie: s.denkwerkUitleg ?? "",
            start: eersteKeer(s.herhaling, start, i),
            werksoort: s.werksoort ?? "denkwerk",
            herhaling: s.herhaling,
            duurMin: s.duurMin,
            denkwerk: s.denkwerk,
            eigenaar: null,
          })),
        },
      });
      klaar();
    } catch (e) {
      zetFout(e instanceof Error ? e.message : "Er ging iets mis");
    } finally {
      zetBezig(false);
    }
  };

  return (
    <div className="wrap" style={{ paddingBottom: 40 }}>
      <div className="kop">
        <div>
          <h1>Welkom</h1>
          <div className="sub">Stap {stap} van 2</div>
        </div>
      </div>

      {stap === 1 && (
        <div className="kaart">
          <h2>Jullie gezin</h2>
          <label className="veld" style={{ marginTop: 10 }}>
            <span>Naam van het gezin (voor de agenda)</span>
            <input type="text" maxLength={60} placeholder="Gezin Jansen" value={gezinsnaam} onChange={(e) => zetGezinsnaam(e.target.value)} />
          </label>
          {leden.map((l) => (
            <div className="rij" key={l.id} style={{ marginBottom: 8, flexWrap: "nowrap" }}>
              <select value={l.rol} onChange={(e) => wijzig(l.id, { rol: e.target.value as Rij["rol"] })} style={{ width: 100, flex: "none" }} aria-label="Rol">
                <option value="ouder">Ouder</option>
                <option value="kind">Kind</option>
              </select>
              <input type="text" maxLength={40} placeholder="Naam" value={l.naam} onChange={(e) => wijzig(l.id, { naam: e.target.value })} style={{ flex: 1, minWidth: 0 }} />
              {l.rol === "kind" && (
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Leeftijd"
                  aria-label="Leeftijd"
                  min={0}
                  max={2100}
                  value={l.leeftijd ?? ""}
                  onChange={(e) => wijzig(l.id, { leeftijd: e.target.value })}
                  style={{ width: 96, flex: "none" }}
                />
              )}
            </div>
          ))}
          <button className="knop klein" onClick={() => zetLeden((ls) => [...ls, { id: nieuwId(), naam: "", rol: "kind" }])}>
            + Gezinslid
          </button>
          {ouders.length > 0 && (
            <div className="veld" style={{ marginTop: 16 }}>
              <span className="veld-label">Wie ben jij?</span>
              <div className="keuzes">
                {ouders.map((o) => (
                  <button key={o.id} type="button" className={`chip ${ik === o.id ? "aan" : ""}`} aria-pressed={ik === o.id} onClick={() => zetIk(o.id)}>
                    {o.naam}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="blad-voet">
            <span className="stil klein">Later aan te passen bij Gezin.</span>
            <button className="knop hoofd" disabled={!ouders.length || !ouders.some((o) => o.id === ik)} onClick={() => zetStap(2)}>
              Volgende
            </button>
          </div>
        </div>
      )}

      {stap === 2 && (
        <div className="kaart">
          <h2>Wat speelt er bij jullie?</h2>
          <p className="stil klein">
            Vink de taken aan die bij jullie gezin horen. Je hoeft nu nog niet te kiezen wie wat doet: dat verdelen jullie straks samen bij
            Taken → Verdelen.
          </p>
          {(Object.keys(CATEGORIEEN) as Categorie[]).map((c) => {
            const lijst = SJABLONEN.filter((s) => s.categorie === c);
            if (!lijst.length) return null;
            return (
              <div key={c}>
                <h3 style={{ margin: "12px 0 2px" }}>{CATEGORIEEN[c]}</h3>
                {lijst.map((s) => (
                  <label className="vink" key={s.titel}>
                    <input
                      type="checkbox"
                      checked={taken.has(s.titel)}
                      onChange={(e) =>
                        zetTaken((t) => {
                          const n = new Set(t);
                          if (e.target.checked) n.add(s.titel);
                          else n.delete(s.titel);
                          return n;
                        })
                      }
                    />
                    <span>{s.titel}</span>
                  </label>
                ))}
              </div>
            );
          })}
          {fout && <div className="waarschuwing">{fout}</div>}
          <div className="blad-voet">
            <button className="knop" onClick={() => zetStap(1)}>
              Terug
            </button>
            <button className="knop hoofd" disabled={bezig} onClick={opslaan}>
              Klaar ({taken.size} taken)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
