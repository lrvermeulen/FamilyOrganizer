"use client";

import { useState } from "react";
import type { AgendaItem } from "@/lib/agenda";
import type { Actie } from "@/lib/acties";
import { kortLabel, langLabel, plusDagen, urenLabel, vandaag as vandaagDatum } from "@/lib/datum";
import { herhalingLabel } from "@/lib/herhaling";
import { uitvoerderVan, uitvoerderVanKeer, type Voorval } from "@/lib/taken";
import type { Taak } from "@/lib/types";
import { useGezin } from "./context";
import { Blad, Bolletje, DenkwerkStippen, Keuzes } from "./ui";

/** Bouwstenen voor regels in lijsten: een taak, een agenda-item, en wat je met één keer van een taak kunt doen. */

export function TaakRegel({ v, open }: { v: Voorval; open: (v: Voorval) => void }) {
  const { staat, lid, doe, bezig, ik } = useGezin();
  const t = v.taak;
  const gedaan = v.voltooiing?.status === "gedaan";
  const vandaag = vandaagDatum();
  const uitvoerder = uitvoerderVanKeer(staat, v);
  const verzet = v.datum !== v.origineel;
  return (
    <li className={gedaan ? "gedaan" : ""}>
      <button
        className={`vinkknop ${gedaan ? "aan" : ""}`}
        aria-label={gedaan ? `${t.titel}: niet gedaan` : `${t.titel}: gedaan`}
        disabled={bezig}
        onClick={() =>
          doe(
            gedaan
              ? { type: "taak.ongedaan", taakId: t.id, datum: v.origineel }
              : { type: "taak.afvinken", taakId: t.id, datum: v.origineel, gedaanDoor: ik ?? undefined },
          )
        }
      >
        {gedaan ? "✓" : ""}
      </button>
      <button className="regel" onClick={() => open(v)}>
        <div className="titel">
          {t.titel} {v.datum < vandaag && !gedaan && <span className="label let">{kortLabel(v.datum)}</span>}
          {verzet && <span className="label">verzet van {kortLabel(v.origineel)}</span>}
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

/** Een vraag aan de andere ouder stellen, met een optioneel berichtje. */
export function VraagKnop({
  label,
  maak,
  klaar,
}: {
  label: (naam: string) => string;
  maak: (aan: string, bericht: string) => Actie;
  klaar?: () => void;
}) {
  const { ouders, ik, doe, bezig, staat } = useGezin();
  const [open, zetOpen] = useState(false);
  const [bericht, zetBericht] = useState("");
  const [verstuurd, zetVerstuurd] = useState(false);
  const ander = ouders.find((o) => o.id !== ik);
  if (!ander) return null;
  if (verstuurd) return <p className="klein">✓ Gevraagd aan {ander.naam}. Je krijgt bericht als {ander.naam} antwoordt.</p>;
  if (!open)
    return (
      <button className="knop klein" type="button" onClick={() => zetOpen(true)}>
        {label(ander.naam)}
      </button>
    );
  return (
    <div className="kaart" style={{ marginTop: 8 }}>
      <label className="veld">
        <span>Berichtje erbij (optioneel)</span>
        <input type="text" maxLength={300} value={bericht} onChange={(e) => zetBericht(e.target.value)} placeholder="Ik heb dan een afspraak" />
      </label>
      <div className="rij">
        <button
          className="knop hoofd klein"
          disabled={bezig}
          onClick={async () => {
            if (await doe(maak(ander.id, bericht))) {
              zetVerstuurd(true);
              klaar?.();
            }
          }}
        >
          Vraag het {ander.naam}
        </button>
        <button className="knop stil klein" onClick={() => zetOpen(false)}>
          Annuleren
        </button>
      </div>
      {!staat.meldingen.some((m) => m.lid === ander.id) && (
        <p className="stil klein">{ander.naam} ziet de vraag in de inbox, of krijgt een melding als die aanstaat.</p>
      )}
    </div>
  );
}

/** Wat je met één keer van een taak kunt doen. */
export function VoorvalBlad({ v, sluit, bewerk }: { v: Voorval; sluit: () => void; bewerk: (t: Taak) => void }) {
  const { staat, lid, doe, bezig, ouders, ik } = useGezin();
  const t = v.taak;
  const deUitvoerder = uitvoerderVanKeer(staat, v);
  const [door, zetDoor] = useState<string>(v.voltooiing?.gedaanDoor ?? deUitvoerder ?? ik ?? ouders[0]?.id);
  const [duur, zetDuur] = useState(v.voltooiing?.duurMin ?? t.duurMin);
  const [andereDag, zetAndereDag] = useState(plusDagen(v.datum < vandaagDatum() ? vandaagDatum() : v.datum, 1));
  const vandaag = vandaagDatum();
  const verzet = (naar: string) => doe({ type: "taak.verzetten", taakId: t.id, origineel: v.origineel, naar }).then((ok) => ok && sluit());
  const vraag = (voortaan: boolean) => (aan: string, bericht: string): Actie => ({
    type: "verzoek.sturen",
    aan,
    soort: "taak",
    titel: t.titel,
    datum: v.datum,
    tijd: t.tijd,
    taakId: t.id,
    origineel: v.origineel,
    voortaan,
    bericht,
  });
  return (
    <Blad titel={t.titel} sluit={sluit}>
      <p className="stil">
        {langLabel(v.datum)}
        {v.datum !== v.origineel ? ` (verzet van ${kortLabel(v.origineel)})` : ""} · {herhalingLabel(t.herhaling)}
      </p>
      <p>
        <b>In het hoofd van:</b> {lid(t.eigenaar)?.naam ?? "nog niemand (niet verdeeld)"}
        <br />
        <b>{deUitvoerder !== uitvoerderVan(t) ? "Doet het deze keer:" : "Voert meestal uit:"}</b> {lid(deUitvoerder)?.naam ?? "nog niemand"}
      </p>
      {t.notitie && <p className="stil">{t.notitie}</p>}
      {!v.voltooiing && (
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
            onClick={async () => (await doe({ type: "taak.afvinken", taakId: t.id, datum: v.origineel, gedaanDoor: door, duurMin: duur })) && sluit()}
          >
            ✓ Gedaan
          </button>
        </div>
      )}
      {!v.voltooiing && (
        <div className="kaart">
          <div className="veld-label">Lukt het niet?</div>
          <div className="rij">
            <button className="knop klein" disabled={bezig} onClick={() => verzet(plusDagen(v.datum < vandaag ? vandaag : v.datum, 1))}>
              Naar morgen
            </button>
            <input
              type="date"
              value={andereDag}
              min={vandaag}
              onChange={(e) => zetAndereDag(e.target.value)}
              style={{ width: "auto" }}
              aria-label="Andere dag"
            />
            <button className="knop klein" disabled={bezig || !andereDag} onClick={() => verzet(andereDag)}>
              Verzetten
            </button>
          </div>
          <div className="rij" style={{ marginTop: 10 }}>
            <VraagKnop label={(n) => `Vraag ${n}: deze keer`} maak={vraag(false)} />
            <VraagKnop label={(n) => `Vraag ${n}: voortaan`} maak={vraag(true)} />
          </div>
          <p className="stil klein" style={{ marginTop: 6 }}>
            &quot;Voortaan&quot; betekent de hele taak: eraan denken, plannen én uitvoeren.
          </p>
        </div>
      )}
      <div className="blad-voet">
        <button className="knop" onClick={() => bewerk(t)}>
          Taak bewerken
        </button>
        {v.voltooiing ? (
          <button className="knop" disabled={bezig} onClick={async () => (await doe({ type: "taak.ongedaan", taakId: t.id, datum: v.origineel })) && sluit()}>
            Terugzetten naar open
          </button>
        ) : (
          <button className="knop" disabled={bezig} onClick={async () => (await doe({ type: "taak.overslaan", taakId: t.id, datum: v.origineel })) && sluit()}>
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
