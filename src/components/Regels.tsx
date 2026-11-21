"use client";

import { useState } from "react";
import type { AgendaItem } from "@/lib/agenda";
import { kortLabel, langLabel, urenLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { herhalingLabel } from "@/lib/herhaling";
import { uitvoerderVan, type Voorval } from "@/lib/taken";
import type { Taak } from "@/lib/types";
import { useGezin } from "./context";
import { Blad, Bolletje, DenkwerkStippen, Keuzes } from "./ui";

/** Bouwstenen voor regels in lijsten: een taak, een agenda-item, en wat je met één keer van een taak kunt doen. */

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

export function ItemRegel({ item, klik, zonderRit }: { item: AgendaItem; klik?: () => void; zonderRit?: boolean }) {
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
            !zonderRit && item.brengt ? `brengt: ${lid(item.brengt)?.naam}` : "",
            !zonderRit && item.haalt ? `haalt: ${lid(item.haalt)?.naam}` : "",
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
