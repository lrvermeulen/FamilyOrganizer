"use client";

import { useMemo, useState } from "react";
import { appItems, betreft, sorteer, type AgendaItem } from "@/lib/agenda";
import { kortLabel, langLabel, plusDagen, urenLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { herhalingLabel } from "@/lib/herhaling";
import { openVoorvallen, uitvoerderVan, type Voorval } from "@/lib/taken";
import type { Taak } from "@/lib/types";
import { useGezin } from "./context";
import { TaakFormulier } from "./Formulieren";
import { useExtern } from "./useExtern";
import { Blad, Bolletje, DenkwerkStippen, Keuzes } from "./ui";

export function TaakRegel({ v, open }: { v: Voorval; open: (v: Voorval) => void }) {
  const { lid, doe, bezig, ik } = useGezin();
  const t = v.taak;
  const gedaan = v.voltooiing?.status === "gedaan";
  const vandaag = vandaagDatum();
  const uitvoerder = uitvoerderVan(t);
  return (
    <li className={gedaan ? "gedaan" : ""}>
      <button
        className={`vinkknop ${gedaan ? "aan" : ""}`}
        aria-label={gedaan ? `${t.titel}: niet gedaan` : `${t.titel}: gedaan`}
        disabled={bezig}
        onClick={() =>
          doe(
            gedaan
              ? { type: "taak.ongedaan", taakId: t.id, datum: v.datum }
              : { type: "taak.afvinken", taakId: t.id, datum: v.datum, gedaanDoor: ik ?? undefined },
          )
        }
      >
        {gedaan ? "✓" : ""}
      </button>
      <button className="regel" onClick={() => open(v)}>
        <div className="titel">
          {t.titel} {v.datum < vandaag && !gedaan && <span className="label let">{kortLabel(v.datum)}</span>}
        </div>
        <div className="meta">
          {t.tijd ? `${t.tijd} · ` : ""}
          {t.duurMin ? `${urenLabel(t.duurMin)} · ` : ""}
          {herhalingLabel(t.herhaling)}
          {uitvoerder && uitvoerder !== t.eigenaar ? ` · doet: ${lid(uitvoerder)?.naam}` : ""}
        </div>
      </button>
      <DenkwerkStippen n={t.denkwerk} />
      <Bolletje lid={lid(t.eigenaar)} klein />
    </li>
  );
}

/** Wat je met één keer van een taak kunt doen. */
export function VoorvalBlad({ v, sluit, bewerk }: { v: Voorval; sluit: () => void; bewerk: (t: Taak) => void }) {
  const { staat, lid, doe, bezig, ouders } = useGezin();
  const t = v.taak;
  const [door, zetDoor] = useState<string>(v.voltooiing?.gedaanDoor ?? uitvoerderVan(t) ?? ouders[0]?.id);
  const [duur, zetDuur] = useState(v.voltooiing?.duurMin ?? t.duurMin);
  return (
    <Blad titel={t.titel} sluit={sluit}>
      <p className="stil">
        {langLabel(v.datum)} · {herhalingLabel(t.herhaling)}
      </p>
      <p>
        <b>In het hoofd van:</b> {lid(t.eigenaar)?.naam ?? "nog niemand (niet verdeeld)"}
        <br />
        <b>Voert meestal uit:</b> {lid(uitvoerderVan(t))?.naam ?? "nog niemand"}
      </p>
      {t.notitie && <p className="stil">{t.notitie}</p>}
      <div className="kaart" style={{ marginTop: 12 }}>
        <div className="veld-label">Gedaan door</div>
        <Keuzes label="Gedaan door" waarde={door} kies={zetDoor} opties={staat.leden.map((l) => ({ waarde: l.id, label: l.naam }))} />
        <label className="veld" style={{ marginTop: 10 }}>
          <span>Hoe lang duurde het? (minuten)</span>
          <input type="number" min={0} max={1440} step={5} value={duur} onChange={(e) => zetDuur(Math.max(0, Number(e.target.value) || 0))} />
        </label>
        <button
          className="knop hoofd vol"
          disabled={bezig}
          onClick={async () => (await doe({ type: "taak.afvinken", taakId: t.id, datum: v.datum, gedaanDoor: door, duurMin: duur })) && sluit()}
        >
          ✓ Gedaan
        </button>
      </div>
      <div className="blad-voet">
        <button className="knop" onClick={() => bewerk(t)}>
          Taak bewerken
        </button>
        {v.voltooiing ? (
          <button className="knop" disabled={bezig} onClick={async () => (await doe({ type: "taak.ongedaan", taakId: t.id, datum: v.datum })) && sluit()}>
            Terugzetten naar open
          </button>
        ) : (
          <button className="knop" disabled={bezig} onClick={async () => (await doe({ type: "taak.overslaan", taakId: t.id, datum: v.datum })) && sluit()}>
            Deze keer overslaan
          </button>
        )}
      </div>
    </Blad>
  );
}

export function ItemRegel({ item, klik }: { item: AgendaItem; klik?: () => void }) {
  const { lid } = useGezin();
  const leden = item.leden.map((l) => lid(l)).filter((l) => !!l);
  const inhoud = (
    <>
      <span className="tijd">{item.heleDag || !item.begin ? "hele dag" : item.begin}</span>
      <span className="streep" aria-hidden>
        {(leden.length ? leden : [undefined]).map((l, i) => (
          <i key={i} style={{ background: l?.kleur ?? "var(--zonder)" }} />
        ))}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="titel">{item.titel}</span>
        <span className="meta stil klein" style={{ display: "block" }}>
          {[
            leden.map((l) => l!.naam).join(", "),
            item.eind && !item.heleDag ? `tot ${item.eind}` : "",
            item.locatie,
            item.soort === "afspraak" && item.regelaar ? `regelt: ${lid(item.regelaar)?.naam}` : "",
            item.bron ? `uit ${item.bron}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </>
  );
  const klasse = `item ${item.soort} ${item.gedaan ? "gedaan" : ""}`;
  return klik ? (
    <button className={klasse} onClick={klik}>
      {inhoud}
    </button>
  ) : (
    <div className={klasse}>{inhoud}</div>
  );
}

export function Vandaag({ naarTab, bewerkAfspraak }: { naarTab: (t: string) => void; bewerkAfspraak: (id: string) => void }) {
  const { staat, ikLid, ik, lid, doe, bezig } = useGezin();
  const vandaag = vandaagDatum();
  const [alleen, zetAlleen] = useState<"ik" | "iedereen">("iedereen");
  const [gekozen, kies] = useState<Voorval | null>(null);
  const [bewerk, zetBewerk] = useState<Taak | null>(null);
  const [maakTaakVan, zetMaakTaakVan] = useState<{ id: string; tekst: string } | null>(null);
  const extern = useExtern(vandaag, plusDagen(vandaag, 1));

  const open = useMemo(() => openVoorvallen(staat, vandaag, plusDagen(vandaag, 6)), [staat, vandaag]);
  const mijn = (v: Voorval) => v.taak.eigenaar === ik || uitvoerderVan(v.taak) === ik || !v.taak.eigenaar;
  const zichtbaar = open.filter((v) => alleen === "iedereen" || mijn(v));
  const achter = zichtbaar.filter((v) => v.datum < vandaag);
  const nu = zichtbaar.filter((v) => v.datum === vandaag);
  // Komende dagen: alleen de eerstvolgende keer per taak, en niet wat vandaag al op de lijst staat.
  const alInLijst = new Set([...achter, ...nu].map((v) => v.taak.id));
  const straks = zichtbaar.filter((v) => {
    if (v.datum <= vandaag || alInLijst.has(v.taak.id)) return false;
    alInLijst.add(v.taak.id);
    return true;
  });
  const gedaanVandaag = staat.voltooiingen.filter((x) => x.status === "gedaan" && x.op.slice(0, 10) === vandaag).length;

  const agenda = sorteer([...appItems(staat, vandaag, plusDagen(vandaag, 1)), ...extern.items]).filter(
    (i) => i.soort !== "taak" && (alleen === "iedereen" || (ik && betreft(i, ik))),
  );
  const opgemerkt = staat.opgemerkt.filter((o) => !o.afgehandeld);

  const groep = (titel: string, lijst: Voorval[], leegTekst?: string) =>
    lijst.length || leegTekst ? (
      <div className="kaart">
        <div className="kaart-kop">
          <h3>{titel}</h3>
          <span className="stil klein">{lijst.length || ""}</span>
        </div>
        {lijst.length ? (
          <ul className="lijst">
            {lijst.map((v) => (
              <TaakRegel key={`${v.taak.id}-${v.datum}`} v={v} open={kies} />
            ))}
          </ul>
        ) : (
          <p className="stil">{leegTekst}</p>
        )}
      </div>
    ) : null;

  return (
    <>
      <div className="kop">
        <div>
          <h1>Hoi {ikLid?.naam}</h1>
          <div className="sub">
            {langLabel(vandaag)}
            {gedaanVandaag ? ` · vandaag ${gedaanVandaag} ${gedaanVandaag === 1 ? "taak" : "taken"} afgevinkt` : ""}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Keuzes
          label="Wat laten zien"
          waarde={alleen}
          kies={zetAlleen}
          opties={[
            { waarde: "iedereen", label: "Hele gezin" },
            { waarde: "ik", label: "Alleen van mij" },
          ]}
        />
      </div>

      <div className="kaart">
        <div className="kaart-kop">
          <h3>Agenda vandaag en morgen</h3>
          <button className="knop stil klein" onClick={() => naarTab("agenda")}>
            Hele week →
          </button>
        </div>
        {agenda.length ? (
          agenda.map((i, n) => (
            <div key={i.sleutel}>
              {(n === 0 || agenda[n - 1].datum !== i.datum) && (
                <div className="stil klein" style={{ margin: "6px 2px 4px" }}>
                  {i.datum === vandaag ? "Vandaag" : "Morgen"}
                </div>
              )}
              <ItemRegel item={i} klik={i.soort === "afspraak" ? () => bewerkAfspraak(i.refId) : undefined} />
            </div>
          ))
        ) : (
          <p className="stil">Niets in de agenda.</p>
        )}
        {extern.fouten.length > 0 && <p className="label let">Niet alle agenda&apos;s konden worden geladen</p>}
      </div>

      {opgemerkt.length > 0 && (
        <div className="kaart">
          <div className="kaart-kop">
            <h3>Opgemerkt</h3>
            <span className="stil klein">nog te regelen</span>
          </div>
          <ul className="lijst">
            {opgemerkt.map((o) => (
              <li key={o.id}>
                <Bolletje lid={lid(o.door)} klein />
                <div className="hoofdtekst">
                  <div className="titel">{o.tekst}</div>
                  <div className="meta">{kortLabel(o.op.slice(0, 10))}</div>
                </div>
                <button className="knop klein" onClick={() => zetMaakTaakVan({ id: o.id, tekst: o.tekst })}>
                  Maak taak
                </button>
                <button className="knop klein stil" disabled={bezig} onClick={() => doe({ type: "opgemerkt.afhandelen", id: o.id })} aria-label="Afgehandeld">
                  ✓
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {groep("Blijft liggen", achter)}
      {groep("Vandaag", nu, "Niets meer voor vandaag.")}
      {groep("Komende dagen", straks)}

      {staat.taken.length === 0 && (
        <div className="uitleg">
          Nog geen taken. Ga naar <button className="knop klein" onClick={() => naarTab("taken")}>Taken</button> om de starttaken toe te
          voegen.
        </div>
      )}

      {gekozen && (
        <VoorvalBlad
          v={gekozen}
          sluit={() => kies(null)}
          bewerk={(t) => {
            kies(null);
            zetBewerk(t);
          }}
        />
      )}
      {bewerk && <TaakFormulier taak={bewerk} sluit={() => zetBewerk(null)} />}
      {maakTaakVan && (
        <TaakFormulier
          voorstel={{ titel: maakTaakVan.tekst.slice(0, 120), notitie: maakTaakVan.tekst.length > 120 ? maakTaakVan.tekst : "" }}
          sluit={() => zetMaakTaakVan(null)}
          opgeslagen={(taakId) => void doe({ type: "opgemerkt.afhandelen", id: maakTaakVan.id, taakId })}
        />
      )}
    </>
  );
}
