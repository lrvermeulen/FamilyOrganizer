"use client";

import { useMemo, useState } from "react";
import { appItems, betreft, overlapt, sorteer, type AgendaItem } from "@/lib/agenda";
import { dag, kortLabel, maandagVan, plusDagen, vandaag as vandaagDatum, WEEKDAG_LANG } from "@/lib/datum";
import { useGezin } from "./context";
import { useExtern } from "./useExtern";
import { ItemRegel } from "./Vandaag";
import { LedenKeuze } from "./ui";

export function Agenda({
  nieuweAfspraak,
  bewerkAfspraak,
  naarTab,
}: {
  nieuweAfspraak: (datum: string) => void;
  bewerkAfspraak: (id: string) => void;
  naarTab: (t: string) => void;
}) {
  const { staat } = useGezin();
  const vandaag = vandaagDatum();
  const [maandag, zetMaandag] = useState(maandagVan(vandaag));
  const [filter, zetFilter] = useState<string[]>([]);
  const zondag = plusDagen(maandag, 6);
  const extern = useExtern(maandag, zondag);

  const items = useMemo(
    () =>
      sorteer([...appItems(staat, maandag, zondag), ...extern.items]).filter(
        (i) => !filter.length || filter.some((f) => betreft(i, f)),
      ),
    [staat, maandag, zondag, extern.items, filter],
  );

  // Botsingen: twee dingen tegelijk voor hetzelfde gezinslid (een kind, of de ouder die het regelt).
  const botsingen = useMemo(() => {
    const uit = new Set<string>();
    const wie = (i: AgendaItem) => new Set([...i.leden, ...(i.regelaar ? [i.regelaar] : [])]);
    for (let a = 0; a < items.length; a++) {
      for (let b = a + 1; b < items.length && items[b].datum === items[a].datum; b++) {
        const wa = wie(items[a]);
        if ([...wie(items[b])].some((x) => wa.has(x)) && overlapt(items[a], items[b])) {
          uit.add(items[a].sleutel);
          uit.add(items[b].sleutel);
        }
      }
    }
    return uit;
  }, [items]);

  const d0 = dag(maandag);
  return (
    <>
      <div className="kop">
        <div>
          <h1>Agenda</h1>
          <div className="sub">
            Week {d0.weekNumber} · {kortLabel(maandag)} t/m {kortLabel(zondag)}
          </div>
        </div>
        <div className="rij">
          <button className="knop klein" onClick={() => zetMaandag(plusDagen(maandag, -7))} aria-label="Vorige week">
            ‹
          </button>
          {maandag !== maandagVan(vandaag) && (
            <button className="knop klein" onClick={() => zetMaandag(maandagVan(vandaag))}>
              Nu
            </button>
          )}
          <button className="knop klein" onClick={() => zetMaandag(plusDagen(maandag, 7))} aria-label="Volgende week">
            ›
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <LedenKeuze
          leden={staat.leden}
          gekozen={filter}
          wissel={(id) => zetFilter((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))}
        />
        <div className="stil klein" style={{ marginTop: 4 }}>
          {filter.length ? "Alleen de gekozen gezinsleden" : "Tik op een naam om te filteren"}
          {extern.laden ? " · gekoppelde agenda's laden…" : ""}
        </div>
      </div>

      {extern.fouten.map((f) => (
        <div className="waarschuwing" key={f.agenda}>
          De agenda &quot;{f.agenda}&quot; kon niet worden geladen: {f.fout}.
        </div>
      ))}
      {staat.agendas.length === 0 && (
        <div className="uitleg">
          Koppel jullie Google- en Apple-agenda&apos;s, dan zie je hier alles bij elkaar.{" "}
          <button className="knop klein" onClick={() => naarTab("gezin")}>
            Agenda&apos;s koppelen
          </button>
        </div>
      )}

      {Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i)).map((datum, i) => {
        const vandeDag = items.filter((x) => x.datum === datum);
        return (
          <section className="dag" key={datum}>
            <div className={`dag-kop ${datum === vandaag ? "vandaag" : ""}`}>
              <span>
                {WEEKDAG_LANG[i]} {dag(datum).day}
                {datum === vandaag ? " · vandaag" : ""}
              </span>
              <button className="knop stil klein" onClick={() => nieuweAfspraak(datum)} aria-label={`Afspraak op ${kortLabel(datum)}`}>
                + afspraak
              </button>
            </div>
            {vandeDag.length === 0 && <div className="stil klein" style={{ margin: "0 2px 6px" }}>—</div>}
            {vandeDag.map((item) => (
              <div key={item.sleutel}>
                <ItemRegel item={item} klik={item.soort === "afspraak" ? () => bewerkAfspraak(item.refId) : undefined} />
                {botsingen.has(item.sleutel) && (
                  <div className="label fout" style={{ margin: "-2px 0 6px 62px" }}>
                    Valt samen met iets anders
                  </div>
                )}
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
