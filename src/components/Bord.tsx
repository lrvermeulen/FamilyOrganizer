"use client";

import { useEffect, useMemo, useState } from "react";
import { betreft, ritRollen, type AgendaItem } from "@/lib/agenda";
import { alleItems, bordDag, brengHaalNodig, ritOpen, weekstart, weekVoorWeekstart } from "@/lib/bord";
import { dag, kortLabel, langLabel, maandagVan, plusDagen, vandaag as vandaagDatum, WEEKDAG_KORT, WEEKDAG_LANG } from "@/lib/datum";
import { openVoorvallen, uitvoerderVanKeer, type Voorval } from "@/lib/taken";
import type { Staat, Taak } from "@/lib/types";
import { vakantieOp } from "@/lib/vakanties";
import { Agenda } from "./Agenda";
import { useGezin } from "./context";
import { TaakFormulier } from "./Formulieren";
import { MaaltijdBlad } from "./Lijsten";
import { useExtern } from "./useExtern";
import { AanDeSlag } from "./AanDeSlag";
import { ItemRegel, TaakRegel, VoorvalBlad, VraagKnop } from "./Regels";
import { Blad, Bolletje, Keuzes } from "./ui";

function naam(staat: Staat, id: string | null | undefined) {
  return staat.leden.find((l) => l.id === id)?.naam;
}

/** Het weekraster: een kolom per gezinslid plus eten, een rij per dag. Ook voor de keukenstand (zonder knoppen). */
export function BordRaster({
  staat,
  items,
  maandag,
  vandaag,
  groot,
  klikItem,
  klikEten,
  klikTaak,
}: {
  staat: Staat;
  items: AgendaItem[];
  maandag: string;
  vandaag: string;
  groot?: boolean;
  klikItem?: (i: AgendaItem) => void;
  klikEten?: (datum: string) => void;
  klikTaak?: (v: Voorval) => void;
}) {
  const kolommen = `${groot ? 92 : 62}px repeat(${staat.leden.length}, minmax(${groot ? 130 : 108}px, 1fr)) minmax(${groot ? 130 : 108}px, 1fr)`;
  const dagen = Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i));
  return (
    <div className={`raster-schuif ${groot ? "groot" : ""}`}>
      <div className="raster" style={{ gridTemplateColumns: kolommen }}>
        <div className="raster-kop" />
        {staat.leden.map((l) => (
          <div className="raster-kop" key={l.id} style={{ borderBottomColor: l.kleur }}>
            <span className="bol klein" style={{ background: l.kleur }}>
              {l.naam.slice(0, 1).toUpperCase()}
            </span>{" "}
            {l.naam}
          </div>
        ))}
        <div className="raster-kop">🍽 Eten</div>
        {dagen.map((d, i) => {
          const b = bordDag(staat, items, d, vandaag);
          const isVandaag = d === vandaag;
          return (
            <div key={d} className={`raster-rij ${isVandaag ? "vandaag" : ""} ${d < vandaag ? "voorbij" : ""}`} style={{ display: "contents" }}>
              <div className="raster-dag">
                <b>{WEEKDAG_KORT[i]}</b> {dag(d).day}
                {b.vakantie && <div className="label">{b.vakantie.naam.replace("vakantie", "")}</div>}
              </div>
              {staat.leden.map((l) => (
                <div className="raster-cel" key={l.id}>
                  {b.perLid[l.id].map((it) => {
                    const inhoud = (
                      <>
                        <span className="tijd">{it.heleDag || !it.begin ? "" : it.begin}</span> {it.titel}
                        {brengHaalNodig(it, staat) && (
                          <span className="rit">
                            {ritRollen(it).includes("brengt") && (it.brengt ? `↗ ${naam(staat, it.brengt)} ` : "↗ ? ")}
                            {ritRollen(it).includes("haalt") && (it.haalt ? `↙ ${naam(staat, it.haalt)}` : "↙ ?")}
                          </span>
                        )}
                        {b.botsingen.has(it.sleutel) && <span className="label fout">tegelijk</span>}
                      </>
                    );
                    return klikItem ? (
                      <button key={it.sleutel} className={`raster-item ${it.soort}`} onClick={() => klikItem(it)}>
                        {inhoud}
                      </button>
                    ) : (
                      <div key={it.sleutel} className={`raster-item ${it.soort}`}>
                        {inhoud}
                      </div>
                    );
                  })}
                  {(b.takenPerLid[l.id] ?? []).map((v) =>
                    klikTaak ? (
                      <button key={`${v.taak.id}-${v.datum}`} className="raster-item taak" onClick={() => klikTaak(v)}>
                        ☐ {v.taak.titel}
                      </button>
                    ) : (
                      <div key={`${v.taak.id}-${v.datum}`} className="raster-item taak">
                        ☐ {v.taak.titel}
                      </div>
                    ),
                  )}
                </div>
              ))}
              <div className="raster-cel eten">
                {klikEten ? (
                  <button className="raster-item" onClick={() => klikEten(d)}>
                    {b.maaltijd?.wat || <span className="stil">+</span>}
                    {b.maaltijd?.kok && <span className="rit">{naam(staat, b.maaltijd.kok)} kookt</span>}
                  </button>
                ) : (
                  b.maaltijd?.wat && (
                    <div className="raster-item">
                      {b.maaltijd.wat}
                      {b.maaltijd.kok && <span className="rit">{naam(staat, b.maaltijd.kok)} kookt</span>}
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Kiezen wie brengt en wie haalt. */
function RitBlad({ item, sluit }: { item: AgendaItem; sluit: () => void }) {
  const { staat, doe, bezig } = useGezin();
  const [brengt, zetBrengt] = useState<string | null>(item.brengt ?? null);
  const [haalt, zetHaalt] = useState<string | null>(item.haalt ?? null);
  const afspraak = item.soort === "afspraak" ? staat.afspraken.find((a) => a.id === item.refId) : undefined;
  const opties = [
    ...staat.leden.filter((l) => l.rol === "ouder").map((l) => ({ waarde: l.id as string | null, label: l.naam })),
    { waarde: null, label: "Nog niemand / iemand anders" },
  ];
  const opslaan = async () => {
    const ok = afspraak
      ? await doe({ type: "afspraak.opslaan", afspraak: { ...afspraak, brengt, haalt } })
      : await doe({ type: "extern.regelen", sleutel: item.regelSleutel ?? item.sleutel, datum: item.datum, titel: item.titel, leden: item.leden, brengt, haalt });
    if (ok) sluit();
  };
  return (
    <Blad titel={`${item.titel} · ${kortLabel(item.datum)}`} sluit={sluit}>
      <p className="stil klein">
        {item.begin}
        {item.eind ? `–${item.eind}` : ""} · {item.leden.map((l) => naam(staat, l)).join(", ")}
        {item.bron ? ` · uit ${item.bron}` : ""}
      </p>
      {ritRollen(item).includes("brengt") && (
        <>
          <div className="veld-label" style={{ marginTop: 10 }}>
            Wie brengt?
          </div>
          <Keuzes
            label="Brengt"
            waarde={brengt}
            kies={(nieuw) => {
              // Wie brengt, haalt ook (als halen bij deze afspraak hoort), tenzij er al iemand anders haalt.
              if (ritRollen(item).includes("haalt") && (!haalt || haalt === brengt)) zetHaalt(nieuw);
              zetBrengt(nieuw);
            }}
            opties={opties}
          />
        </>
      )}
      {ritRollen(item).includes("haalt") && (
        <>
          <div className="veld-label" style={{ marginTop: 12 }}>
            Wie haalt?
          </div>
          <Keuzes label="Haalt" waarde={haalt} kies={zetHaalt} opties={opties} />
        </>
      )}
      {afspraak && afspraak.herhaling.soort !== "geen" && (
        <p className="stil klein" style={{ marginTop: 10 }}>
          Dit geldt voor elke keer van deze afspraak.
        </p>
      )}
      <div className="blad-voet">
        <span />
        <button className="knop hoofd" disabled={bezig} onClick={opslaan}>
          Opslaan
        </button>
      </div>
      <div className="stapel" style={{ marginTop: 14 }}>
        <div className="veld-label">Of vraag het de ander</div>
        <div className="rij">
          {(["brengen", "halen"] as const).filter((rol) => ritRollen(item).includes(rol === "brengen" ? "brengt" : "haalt")).map((rol) => (
            <VraagKnop
              key={rol}
              label={(n) => `Vraag ${n} te ${rol}`}
              klaar={sluit}
              maak={(aan, bericht) => ({
                type: "verzoek.sturen",
                aan,
                soort: rol,
                titel: item.titel,
                datum: item.datum,
                tijd: rol === "brengen" ? item.begin : (item.eind ?? item.begin),
                afspraakId: afspraak?.id,
                regelSleutel: afspraak ? undefined : (item.regelSleutel ?? item.sleutel),
                leden: item.leden,
                bericht,
              })}
            />
          ))}
        </div>
      </div>
    </Blad>
  );
}

function RitRegel({ item, open }: { item: AgendaItem; open: () => void }) {
  const { staat } = useGezin();
  if (!brengHaalNodig(item, staat)) return null;
  return (
    <button className="ritregel" onClick={open}>
      {ritRollen(item).includes("brengt") && <span className={item.brengt ? "" : "open"}>Brengt: {naam(staat, item.brengt) ?? "?"}</span>}
      {ritRollen(item).includes("haalt") && <span className={item.haalt ? "" : "open"}>Haalt: {naam(staat, item.haalt) ?? "?"}</span>}
    </button>
  );
}

function DagWeergave({
  datum,
  items,
  openItem,
  openRit,
  openEten,
  openTaak,
  alleenVan,
}: {
  datum: string;
  items: AgendaItem[];
  openItem: (i: AgendaItem) => void;
  openRit: (i: AgendaItem) => void;
  openEten: (d: string) => void;
  openTaak: (v: Voorval) => void;
  /** Alleen wat met deze ouder te maken heeft (plus wat nog niemand doet). */
  alleenVan: string | null;
}) {
  const { staat, lid } = useGezin();
  const vandaag = vandaagDatum();
  const volledig = bordDag(staat, items, datum, vandaag);
  const mijnItem = (i: AgendaItem) =>
    !alleenVan || betreft(i, alleenVan) || ritOpen(i, staat);
  const mijnTaak = (v: Voorval) => !alleenVan || uitvoerderVanKeer(staat, v) === alleenVan || !v.taak.eigenaar;
  const b = {
    ...volledig,
    perLid: Object.fromEntries(Object.entries(volledig.perLid).map(([k, lijst]) => [k, lijst.filter(mijnItem)])),
    taken: volledig.taken.filter(mijnTaak),
  };
  const routines = openVoorvallen(staat, vandaag, datum > vandaag ? datum : vandaag).filter(
    (v) => v.taak.herhaling.soort === "dagelijks" && v.datum === datum && mijnTaak(v),
  );
  const metIets = staat.leden.filter((l) => b.perLid[l.id].length > 0);
  const heleGezin = items.filter((i) => i.datum === datum && i.soort !== "taak" && i.leden.length === 0);

  return (
    <>
      {b.vakantie && <div className="uitleg">🏖 {b.vakantie.naam}</div>}

      <button className="kaart eten-kaart" onClick={() => openEten(datum)}>
        <span className="stil klein">🍽 Eten</span>
        <span className="titel">{b.maaltijd?.wat || <span className="stil">Nog niets gepland, tik om te kiezen</span>}</span>
        {b.maaltijd?.kok && <span className="stil klein">{lid(b.maaltijd.kok)?.naam} kookt</span>}
      </button>

      <div className="kaart">
        <h3>Wie moet waarheen</h3>
        {metIets.length === 0 && heleGezin.length === 0 && <p className="stil">Niets in de agenda.</p>}
        {metIets.map((l) => (
          <div key={l.id} style={{ marginTop: 10 }}>
            <div className="rij" style={{ marginBottom: 4 }}>
              <Bolletje lid={l} klein /> <b>{l.naam}</b>
            </div>
            {b.perLid[l.id].map((i) => (
              <div key={i.sleutel}>
                <ItemRegel item={i} klik={() => openItem(i)} zonderRit={brengHaalNodig(i, staat)} />
                <RitRegel item={i} open={() => openRit(i)} />
                {b.botsingen.has(i.sleutel) && <div className="label fout" style={{ margin: "-2px 0 6px" }}>Valt samen met iets anders</div>}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="kaart">
        <div className="kaart-kop">
          <h3>Taken</h3>
          <span className="stil klein">{b.taken.length || ""}</span>
        </div>
        {b.taken.length ? (
          <ul className="lijst">
            {b.taken.map((v) => (
              <TaakRegel key={`${v.taak.id}-${v.datum}`} v={v} open={openTaak} />
            ))}
          </ul>
        ) : (
          <p className="stil">Geen taken{routines.length ? " buiten de dagelijkse routines" : ""}.</p>
        )}
        {routines.length > 0 && (
          <details>
            <summary>Dagelijkse routines ({routines.length})</summary>
            <ul className="lijst">
              {routines.map((v) => (
                <TaakRegel key={`${v.taak.id}-${v.datum}`} v={v} open={openTaak} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </>
  );
}

function WeekstartBlad({ sluit, naarTab }: { sluit: () => void; naarTab: (t: string) => void }) {
  const { staat, lid } = useGezin();
  const maandag = weekVoorWeekstart(vandaagDatum());
  const extern = useExtern(maandag, plusDagen(maandag, 6));
  const items = useMemo(() => alleItems(staat, extern.items, maandag, plusDagen(maandag, 6)), [staat, extern.items, maandag]);
  const w = weekstart(staat, items, maandag, vandaagDatum());
  const { ouders, doe, bezig } = useGezin();
  useEffect(() => {
    try {
      localStorage.setItem("weekstart-gedaan", "1");
    } catch {}
  }, []);
  const [rit, zetRit] = useState<AgendaItem | null>(null);
  const [eten, zetEten] = useState<string | null>(null);
  const klaar =
    !w.teDoen.some((v) => !v.taak.eigenaar) && !w.openRitten.length && !w.botsingen.length && !w.dagenZonderEten.length && !w.takenZonderEigenaar && !w.inbox;

  return (
    <Blad titel={`Week ${dag(maandag).weekNumber} doorlopen`} sluit={sluit}>
      <p className="stil klein">
        {kortLabel(maandag)} t/m {kortLabel(plusDagen(maandag, 6))}. Loop samen langs wat er nog open staat, dan weet iedereen waar hij aan
        toe is.
        {extern.laden ? " Gekoppelde agenda's laden…" : ""}
      </p>

      {(w.vakanties.length > 0 || w.bijzondereDagen.length > 0) && (
        <div className="kaart">
          <h3>Let op deze week</h3>
          <ul className="lijst">
            {w.vakanties.map((v) => (
              <li key={v.naam}>
                🏖 {v.naam} ({kortLabel(v.van)} t/m {kortLabel(v.tot)})
              </li>
            ))}
            {w.bijzondereDagen.map((i) => (
              <li key={i.sleutel}>
                📅 {kortLabel(i.datum)}: {i.titel} ({i.leden.map((l) => lid(l)?.naam).join(", ")}). Opvang of vervoer nodig?
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="kaart">
        <h3>Deze week af {w.teDoen.length ? <span className="label let">{w.teDoen.length}</span> : "✓"}</h3>
        {w.teDoen.length === 0 ? (
          <p className="stil klein">Geen losse taken of deadlines deze week, behalve de vaste routine.</p>
        ) : (
          <ul className="lijst">
            {w.teDoen.map((v) => (
              <li key={`${v.taak.id}-${v.origineel}`} style={{ display: "block" }}>
                <div className="titel">
                  <b>{v.taak.titel}</b>
                </div>
                <div className="meta">
                  {v.datum < vandaagDatum() ? `was ${kortLabel(v.datum)}` : `${v.taak.herhaling.soort === "geen" && v.taak.inAgenda ? "uiterlijk " : ""}${kortLabel(v.datum)}`}
                  {v.taak.eigenaar ? ` · ${lid(v.taak.eigenaar)?.naam}` : ""}
                </div>
                {!v.taak.eigenaar && (
                  <div className="rij" style={{ marginTop: 6 }}>
                    <span className="stil klein">Wie pakt het op?</span>
                    {ouders.map((o) => (
                      <button
                        key={o.id}
                        className="chip"
                        disabled={bezig}
                        onClick={() => doe({ type: "taak.overdragen", taakId: v.taak.id, naar: o.id, heelPakket: true })}
                      >
                        {o.naam}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="kaart">
        <h3>Brengen en halen {w.openRitten.length ? <span className="label let">{w.openRitten.length} open</span> : "✓"}</h3>
        {w.openRitten.length === 0 ? (
          <p className="stil klein">Bij alles is duidelijk wie brengt en haalt.</p>
        ) : (
          w.openRitten.map((i) => (
            <div key={i.sleutel}>
              <div className="klein" style={{ marginTop: 8 }}>
                <b>{kortLabel(i.datum)}</b> {i.begin} {i.titel} ({i.leden.map((l) => lid(l)?.naam).join(", ")})
              </div>
              <RitRegel item={i} open={() => zetRit(i)} />
            </div>
          ))
        )}
      </div>

      {w.botsingen.length > 0 && (
        <div className="kaart">
          <h3>
            Tegelijk <span className="label fout">{w.botsingen.length}</span>
          </h3>
          {w.botsingen.map((i) => (
            <div key={i.sleutel} className="klein" style={{ marginTop: 6 }}>
              <b>{kortLabel(i.datum)}</b> {i.begin}–{i.eind} {i.titel} ({[...i.leden, i.brengt, i.haalt].map((l) => lid(l)?.naam).filter(Boolean).join(", ")})
            </div>
          ))}
        </div>
      )}

      <div className="kaart">
        <h3>Eten {w.dagenZonderEten.length ? <span className="label let">{w.dagenZonderEten.length} dagen open</span> : "✓"}</h3>
        <div className="keuzes" style={{ marginTop: 6 }}>
          {Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i)).map((d, i) => {
            const m = staat.maaltijden.find((x) => x.datum === d);
            return (
              <button key={d} className={`chip ${m?.wat ? "" : "leeg"}`} onClick={() => zetEten(d)}>
                {WEEKDAG_KORT[i]}: {m?.wat || "?"}
              </button>
            );
          })}
        </div>
      </div>

      <div className="kaart">
        <h3>Verder</h3>
        <ul className="lijst">
          <li>
            <span className="hoofdtekst">
              {w.takenZonderEigenaar ? `${w.takenZonderEigenaar} taken hebben nog geen eigenaar` : "Alle taken hebben een eigenaar ✓"}
            </span>
            {w.takenZonderEigenaar > 0 && (
              <button className="knop klein" onClick={() => (sluit(), naarTab("lijsten"))}>
                Verdelen
              </button>
            )}
          </li>
          <li>
            <span className="hoofdtekst">{w.inbox ? `${w.inbox} dingen in de inbox` : "De inbox is leeg ✓"}</span>
            {w.inbox > 0 && (
              <button className="knop klein" onClick={() => (sluit(), naarTab("inbox"))}>
                Inbox
              </button>
            )}
          </li>
        </ul>
      </div>
      {klaar && <div className="uitleg">Alles staat klaar voor de week. 🎉</div>}

      {rit && <RitBlad item={rit} sluit={() => zetRit(null)} />}
      {eten && <MaaltijdBlad datum={eten} sluit={() => zetEten(null)} />}
    </Blad>
  );
}

export function Bord({ naarTab, bewerkAfspraak, nieuweAfspraak }: { naarTab: (t: string) => void; bewerkAfspraak: (id: string) => void; nieuweAfspraak: (datum: string) => void }) {
  const { staat, ikLid } = useGezin();
  const vandaag = vandaagDatum();
  const [stand, zetStand] = useState<"dag" | "week" | "lijst">("dag");
  const [datum, zetDatum] = useState(vandaag);
  const [maandag, zetMaandag] = useState(maandagVan(vandaag));
  const [rit, zetRit] = useState<AgendaItem | null>(null);
  const [eten, zetEten] = useState<string | null>(null);
  const [voorval, zetVoorval] = useState<Voorval | null>(null);
  const [bewerk, zetBewerk] = useState<Taak | null>(null);
  const [weekstartOpen, zetWeekstart] = useState(false);
  const { ik } = useGezin();
  const [alleenIk, zetAlleenIk] = useState(false);
  useEffect(() => {
    try {
      zetAlleenIk(localStorage.getItem("bord-alleen-ik") === "1");
    } catch {}
  }, []);
  const kiesAlleenIk = (x: boolean) => {
    zetAlleenIk(x);
    try {
      localStorage.setItem("bord-alleen-ik", x ? "1" : "0");
    } catch {}
  };

  useEffect(() => {
    // Op een groot scherm (tablet, laptop) begint het bord met de hele week.
    if (window.matchMedia("(min-width: 900px)").matches) zetStand("week");
  }, []);
  useEffect(() => zetMaandag(maandagVan(datum)), [datum]);

  const zondag = plusDagen(maandag, 6);
  const extern = useExtern(maandag, zondag);
  const items = useMemo(() => alleItems(staat, extern.items, maandag, zondag), [staat, extern.items, maandag, zondag]);
  const weekdag = dag(vandaag).weekday;

  const openItem = (i: AgendaItem) => {
    if (i.soort === "afspraak") bewerkAfspraak(i.refId);
    else if (brengHaalNodig(i, staat)) zetRit(i);
  };

  return (
    <>
      <div className="kop">
        <div>
          <h1>Hoi {ikLid?.naam}</h1>
          <div className="sub">
            {langLabel(vandaag)}
            {vakantieOp(staat.regio, vandaag) ? ` · ${vakantieOp(staat.regio, vandaag)!.naam}` : ""}
          </div>
        </div>
        <button className={`knop klein ${weekdag >= 5 ? "hoofd" : ""}`} onClick={() => zetWeekstart(true)}>
          Week doorlopen
        </button>
      </div>

      <AanDeSlag naarTab={naarTab} weekstart={() => zetWeekstart(true)} />

      <div className="rij tussen" style={{ marginBottom: 12 }}>
        <Keuzes
          label="Weergave"
          waarde={stand}
          kies={zetStand}
          opties={[
            { waarde: "dag", label: "Dag" },
            { waarde: "week", label: "Week" },
            { waarde: "lijst", label: "Agenda" },
          ]}
        />
      </div>

      {extern.fouten.map((f) => (
        <div className="waarschuwing" key={f.agenda}>
          De agenda &quot;{f.agenda}&quot; kon niet worden geladen: {f.fout}.
        </div>
      ))}

      {stand === "dag" && (
        <>
          <div className="dagkiezer" role="tablist" aria-label="Dag">
            {Array.from({ length: 7 }, (_, i) => plusDagen(maandag, i)).map((d, i) => (
              <button
                key={d}
                role="tab"
                aria-selected={d === datum}
                className={`${d === datum ? "aan" : ""} ${d === vandaag ? "nu" : ""}`}
                onClick={() => zetDatum(d)}
              >
                <span>{WEEKDAG_KORT[i]}</span>
                <b>{dag(d).day}</b>
              </button>
            ))}
          </div>
          <div className="rij tussen" style={{ margin: "6px 0 12px" }}>
            <button className="knop klein stil" onClick={() => zetDatum(plusDagen(datum, -7))}>
              ‹ vorige week
            </button>
            <b>{datum === vandaag ? "Vandaag" : WEEKDAG_LANG[dag(datum).weekday - 1]}</b>
            <button className="knop klein stil" onClick={() => zetDatum(plusDagen(datum, 7))}>
              volgende week ›
            </button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <Keuzes
              label="Wat laten zien"
              waarde={alleenIk}
              kies={kiesAlleenIk}
              opties={[
                { waarde: false, label: "Hele gezin" },
                { waarde: true, label: "Mijn dag" },
              ]}
            />
          </div>
          <DagWeergave
            datum={datum}
            items={items}
            openItem={openItem}
            openRit={zetRit}
            openEten={zetEten}
            openTaak={zetVoorval}
            alleenVan={alleenIk ? ik : null}
          />
          <button className="knop vol" onClick={() => nieuweAfspraak(datum)}>
            + Afspraak op {kortLabel(datum)}
          </button>
        </>
      )}

      {stand === "week" && (
        <>
          <div className="rij tussen" style={{ marginBottom: 10 }}>
            <b>
              Week {dag(maandag).weekNumber} · {kortLabel(maandag)} t/m {kortLabel(zondag)}
            </b>
            <div className="rij">
              <button className="knop klein" onClick={() => zetDatum(plusDagen(datum, -7))} aria-label="Vorige week">
                ‹
              </button>
              {maandag !== maandagVan(vandaag) && (
                <button className="knop klein" onClick={() => zetDatum(vandaag)}>
                  Nu
                </button>
              )}
              <button className="knop klein" onClick={() => zetDatum(plusDagen(datum, 7))} aria-label="Volgende week">
                ›
              </button>
            </div>
          </div>
          <BordRaster
            staat={staat}
            items={items}
            maandag={maandag}
            vandaag={vandaag}
            klikItem={openItem}
            klikEten={zetEten}
            klikTaak={zetVoorval}
          />
          <p className="stil klein">↗ brengt · ↙ haalt. Dagelijkse routines staan bij Lijsten → Taken.</p>
        </>
      )}

      {stand === "lijst" && <Agenda naarTab={naarTab} nieuweAfspraak={nieuweAfspraak} bewerkAfspraak={bewerkAfspraak} kop={false} />}

      {rit && <RitBlad item={rit} sluit={() => zetRit(null)} />}
      {eten && <MaaltijdBlad datum={eten} sluit={() => zetEten(null)} />}
      {voorval && (
        <VoorvalBlad
          v={voorval}
          sluit={() => zetVoorval(null)}
          bewerk={(t) => {
            zetVoorval(null);
            zetBewerk(t);
          }}
        />
      )}
      {bewerk && <TaakFormulier taak={bewerk} sluit={() => zetBewerk(null)} />}
      {weekstartOpen && <WeekstartBlad sluit={() => zetWeekstart(false)} naarTab={naarTab} />}
    </>
  );
}

