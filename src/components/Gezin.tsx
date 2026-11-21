"use client";

import { useState } from "react";
import { KLEUREN, REGIOS, type ExterneAgenda, type Lid, type Regio } from "@/lib/types";
import { post, useGezin } from "./context";
import { Blad, Bolletje, Keuzes } from "./ui";

function LidBlad({ lid, sluit }: { lid?: Lid; sluit: () => void }) {
  const { doe, bezig, staat, ik } = useGezin();
  const [l, zet] = useState<Partial<Lid>>(
    lid ?? { naam: "", rol: "kind", kleur: KLEUREN[staat.leden.length % KLEUREN.length] },
  );
  return (
    <Blad titel={lid ? `${lid.naam} bewerken` : "Gezinslid toevoegen"} sluit={sluit}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await doe({ type: "lid.opslaan", lid: { id: lid?.id, naam: l.naam ?? "", rol: l.rol ?? "kind", kleur: l.kleur, geboortejaar: l.geboortejaar } })) sluit();
        }}
      >
        <label className="veld">
          <span>Naam</span>
          <input type="text" required maxLength={40} value={l.naam ?? ""} onChange={(e) => zet({ ...l, naam: e.target.value })} autoFocus={!lid} />
        </label>
        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Rol</span>
          <Keuzes
            label="Rol"
            waarde={l.rol ?? "kind"}
            kies={(rol) => zet({ ...l, rol })}
            opties={[
              { waarde: "ouder", label: "Ouder" },
              { waarde: "kind", label: "Kind" },
            ]}
          />
        </div>
        {l.rol === "kind" && (
          <label className="veld">
            <span>Geboortejaar (optioneel)</span>
            <input
              type="number"
              min={1990}
              max={2100}
              value={l.geboortejaar ?? ""}
              onChange={(e) => zet({ ...l, geboortejaar: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
        )}
        <div className="veld" style={{ marginBottom: 12 }}>
          <span className="veld-label">Kleur</span>
          <div className="keuzes">
            {KLEUREN.map((k) => (
              <button
                type="button"
                key={k}
                aria-label={`Kleur ${k}`}
                aria-pressed={l.kleur === k}
                onClick={() => zet({ ...l, kleur: k })}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: k,
                  border: l.kleur === k ? "3px solid var(--tekst)" : "3px solid transparent",
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
        <div className="blad-voet">
          {lid && lid.id !== ik ? (
            <button
              type="button"
              className="knop gevaar"
              disabled={bezig}
              onClick={async () => confirm(`${lid.naam} verwijderen?`) && (await doe({ type: "lid.verwijderen", id: lid.id })) && sluit()}
            >
              Verwijderen
            </button>
          ) : (
            <span />
          )}
          <button className="knop hoofd" disabled={bezig}>
            Opslaan
          </button>
        </div>
      </form>
    </Blad>
  );
}

function Kopieer({ tekst }: { tekst: string }) {
  const [klaar, zet] = useState(false);
  return (
    <button
      className="knop klein"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(tekst);
          zet(true);
          setTimeout(() => zet(false), 1500);
        } catch {
          prompt("Kopieer dit adres", tekst);
        }
      }}
    >
      {klaar ? "Gekopieerd ✓" : "Kopieer adres"}
    </button>
  );
}

function Vakanties() {
  const { staat, doe, bezig } = useGezin();
  return (
    <div className="kaart">
      <h2>Schoolvakanties</h2>
      <p className="stil klein">
        In welke regio zit de school? Dan staan de vakanties op het bord en in de agenda-abonnementen (bron: Rijksoverheid). Studiedagen
        verschillen per school: die komen via de Social Schools-agenda of de inbox binnen.
      </p>
      <Keuzes
        label="Regio"
        waarde={staat.regio}
        kies={(regio) => !bezig && doe({ type: "regio.instellen", regio })}
        opties={[...(Object.keys(REGIOS) as Regio[]).map((r) => ({ waarde: r as Regio | null, label: REGIOS[r] })), { waarde: null, label: "Niet tonen" }]}
      />
      <p className="stil klein" style={{ marginTop: 6 }}>
        Weet je de regio niet? Zoek je gemeente op bij rijksoverheid.nl (&quot;schoolvakanties per regio&quot;).
      </p>
    </div>
  );
}

function KeukenLink() {
  const { staat, basis, doe, bezig } = useGezin();
  const adres = `${basis}/keuken/${staat.keukenSleutel}`;
  return (
    <div className="kaart">
      <h2>Keukenstand</h2>
      <p className="stil klein">
        Het weekbord groot op een tablet in de keuken, voor het hele gezin, ook de kinderen. Alleen om te bekijken; het ververst zichzelf.
        Open dit adres op de tablet en zet het op het beginscherm. Zet de tablet in de instellingen op &quot;scherm niet automatisch
        vergrendelen&quot; zolang hij aan de lader hangt.
      </p>
      <code className="adres">{adres}</code>
      <div className="rij">
        <Kopieer tekst={adres} />
        <a className="knop klein" href={adres} target="_blank" rel="noreferrer">
          Bekijken
        </a>
        <button
          className="knop klein gevaar"
          disabled={bezig}
          onClick={() => confirm("Nieuwe link maken? De oude werkt dan niet meer.") && doe({ type: "sleutel.vernieuwen", welke: "keuken" })}
        >
          Nieuwe link
        </button>
      </div>
      <p className="stil klein">
        Wie de link heeft, ziet het weekbord (afspraken, eten, boodschappen), maar niet de inzichten of de adressen van jullie agenda&apos;s.
      </p>
    </div>
  );
}

function Feeds() {
  const { staat, basis, doe, bezig, modus } = useGezin();
  const feeds = [{ naam: "Hele gezin", bestand: "gezin" }, ...staat.leden.map((l) => ({ naam: l.naam, bestand: l.id }))];
  const lokaal = /localhost|127\.0\.0\.1/.test(basis);
  return (
    <div className="kaart">
      <h2>Gezinsagenda in Google en Apple</h2>
      <p className="stil klein">
        Abonneer je op een agenda uit de app, dan staan de afspraken en ingeplande taken in jullie eigen agenda-app. Nieuwe en gewijzigde
        afspraken komen er vanzelf in. Apple Agenda ververst zo vaak als je instelt (bijvoorbeeld elke 5 minuten of elk uur); Google
        Agenda ververst zelf, meestal een paar keer per dag.
      </p>
      {lokaal && <div className="waarschuwing">Je draait de app lokaal. Abonneren werkt pas als de app online staat.</div>}
      {modus === "demo" && <div className="waarschuwing">In de demo zijn dit voorbeeldadressen.</div>}
      {feeds.map((f) => {
        const pad = `/api/feed/${staat.feedSleutel}/${f.bestand}.ics`;
        const https = `${basis}${pad}`;
        const webcal = https.replace(/^https?:\/\//, "webcal://");
        return (
          <div key={f.bestand} style={{ borderTop: "1px solid var(--rand)", padding: "10px 0" }}>
            <b>{f.naam}</b>
            <div className="rij" style={{ marginTop: 6 }}>
              <a className="knop klein" href={webcal}>
                Apple Agenda
              </a>
              <a className="knop klein" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcal)}`} target="_blank" rel="noreferrer">
                Google Agenda
              </a>
              <Kopieer tekst={https} />
            </div>
          </div>
        );
      })}
      <details>
        <summary>Lukt het niet met de knoppen?</summary>
        <p className="klein">
          <b>iPhone:</b> Instellingen → Agenda → Accounts → Voeg account toe → Andere → Voeg agenda-abonnement toe, en plak het adres.
          <br />
          <b>Mac:</b> Agenda → Archief → Nieuw agenda-abonnement.
          <br />
          <b>Google Agenda (op de computer):</b> naast &quot;Andere agenda&apos;s&quot; op + → Via URL, en plak het adres. Daarna staat hij
          ook op je telefoon.
        </p>
      </details>
      <details>
        <summary>Adressen vernieuwen</summary>
        <p className="klein">
          De adressen bevatten een geheime code. Heb je een adres per ongeluk gedeeld? Maak dan nieuwe adressen. De oude werken dan niet
          meer, en je moet je opnieuw abonneren.
        </p>
        <button
          className="knop klein gevaar"
          disabled={bezig}
          onClick={() => confirm("Nieuwe adressen maken? De oude abonnementen stoppen dan.") && doe({ type: "feed.vernieuwen" })}
        >
          Nieuwe adressen maken
        </button>
      </details>
    </div>
  );
}

function AgendaBlad({ agenda, sluit }: { agenda?: ExterneAgenda; sluit: () => void }) {
  const { staat, doe, bezig, ik } = useGezin();
  const [a, zet] = useState({
    naam: agenda?.naam ?? "",
    url: "",
    lid: agenda?.lid ?? ik ?? staat.leden[0].id,
    alleenBezet: agenda?.alleenBezet ?? false,
  });
  return (
    <Blad titel={agenda ? "Agenda bewerken" : "Agenda koppelen"} sluit={sluit}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await doe({ type: "agenda.opslaan", agenda: { ...a, id: agenda?.id } })) sluit();
        }}
      >
        <label className="veld">
          <span>Naam</span>
          <input type="text" required maxLength={60} placeholder="Werk, Sport, School" value={a.naam} onChange={(e) => zet({ ...a, naam: e.target.value })} />
        </label>
        <label className="veld">
          <span>iCal-adres{agenda ? " (leeg laten om het huidige te houden)" : ""}</span>
          <input
            type="url"
            required={!agenda}
            placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
            value={a.url}
            onChange={(e) => zet({ ...a, url: e.target.value })}
          />
        </label>
        <details>
          <summary>Waar vind ik dat adres?</summary>
          <p className="klein">
            <b>Google Agenda:</b> open Google Agenda op de computer → instellingen (tandwiel) → kies links de agenda → &quot;Agenda
            integreren&quot; → kopieer het <b>geheime adres in iCal-indeling</b>.
          </p>
          <p className="klein">
            <b>Apple (iCloud):</b> open de Agenda-app → tik bij de agenda op ⓘ → zet <b>Openbare agenda</b> aan → Deel link. Let op: wie die
            link heeft, kan de agenda zien. Deel hem dus alleen met de app.
          </p>
          <p className="klein">
            <b>Social Schools:</b> open de agenda in Social Schools. In de webapp: rechtsboven <b>Abonneren</b> en kopieer de link. In de
            app: <b>Opties</b> → <b>Abonneer</b>. Kies hieronder bij &quot;Van wie&quot; het kind. Let op: Social Schools geeft wijzigingen
            soms pas na een dag door.
          </p>
          <p className="klein">
            <b>Sportclub of andere school:</b> veel clubs en scholen bieden een iCal- of webcal-link aan. Die werkt ook.
          </p>
        </details>
        <label className="veld" style={{ marginTop: 10 }}>
          <span>Van wie is deze agenda?</span>
          <select value={a.lid} onChange={(e) => zet({ ...a, lid: e.target.value })}>
            {staat.leden.map((l) => (
              <option key={l.id} value={l.id}>
                {l.naam}
              </option>
            ))}
          </select>
        </label>
        <label className="vink">
          <input type="checkbox" checked={a.alleenBezet} onChange={(e) => zet({ ...a, alleenBezet: e.target.checked })} />
          <span>
            Alleen &quot;Bezet&quot; tonen
            <span className="stil klein" style={{ display: "block" }}>
              Handig voor een werkagenda: je ziet wanneer iemand bezet is, maar niet waarvoor.
            </span>
          </span>
        </label>
        <div className="blad-voet">
          {agenda ? (
            <button
              type="button"
              className="knop gevaar"
              disabled={bezig}
              onClick={async () => confirm(`"${agenda.naam}" ontkoppelen?`) && (await doe({ type: "agenda.verwijderen", id: agenda.id })) && sluit()}
            >
              Ontkoppelen
            </button>
          ) : (
            <span />
          )}
          <button className="knop hoofd" disabled={bezig}>
            Opslaan
          </button>
        </div>
      </form>
    </Blad>
  );
}

export function Gezin() {
  const { staat, ouders, lid, ik, modus, opslag, doe, bezig, herlaad, meld } = useGezin();
  const [bewerkLid, zetBewerkLid] = useState<Lid | null | "nieuw">(null);
  const [bewerkAgenda, zetBewerkAgenda] = useState<ExterneAgenda | null | "nieuw">(null);
  const [naam, zetNaam] = useState(staat.gezinsnaam);

  return (
    <>
      <div className="kop">
        <h1>Gezin</h1>
      </div>

      <div className="kaart">
        <label className="veld">
          <span>Naam van het gezin</span>
          <div className="rij">
            <input type="text" maxLength={60} value={naam} onChange={(e) => zetNaam(e.target.value)} style={{ flex: 1 }} />
            {naam !== staat.gezinsnaam && (
              <button className="knop klein" disabled={bezig} onClick={() => doe({ type: "gezin.naam", gezinsnaam: naam })}>
                Opslaan
              </button>
            )}
          </div>
        </label>
        <ul className="lijst">
          {staat.leden.map((l) => (
            <li key={l.id}>
              <Bolletje lid={l} />
              <button className="regel" onClick={() => zetBewerkLid(l)}>
                <div className="titel">
                  {l.naam} {l.id === ik && <span className="label">jij</span>}
                </div>
                <div className="meta">
                  {l.rol === "ouder" ? "Ouder" : "Kind"}
                  {l.geboortejaar ? ` · ${new Date().getFullYear() - l.geboortejaar} jaar` : ""}
                </div>
              </button>
            </li>
          ))}
        </ul>
        <button className="knop klein" onClick={() => zetBewerkLid("nieuw")}>
          + Gezinslid
        </button>
      </div>

      <div className="kaart">
        <h2>Agenda&apos;s van buiten</h2>
        <p className="stil klein">
          Koppel jullie eigen agenda&apos;s (Google, Apple, school, sportclub). De app leest ze alleen; hij verandert er niets in.
        </p>
        {staat.agendas.length > 0 && (
          <ul className="lijst">
            {staat.agendas.map((a) => (
              <li key={a.id}>
                <Bolletje lid={lid(a.lid)} klein />
                <button className="regel" onClick={() => zetBewerkAgenda(a)}>
                  <div className="titel">{a.naam}</div>
                  <div className="meta">
                    {a.url} {a.alleenBezet ? "· alleen bezet" : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button className="knop klein" onClick={() => zetBewerkAgenda("nieuw")}>
          + Agenda koppelen
        </button>
      </div>

      <Vakanties />

      <KeukenLink />

      <Feeds />

      <div className="kaart">
        <h2>Jij</h2>
        <p className="klein">Wie gebruikt de app nu? Afvinken en opmerken komt op naam van deze persoon.</p>
        <Keuzes
          label="Wie ben jij"
          waarde={ik}
          kies={async (id) => {
            try {
              await post("/api/kies", { lid: id });
              await herlaad();
            } catch (e) {
              meld(e instanceof Error ? e.message : "Wisselen lukte niet");
            }
          }}
          opties={ouders.map((o) => ({ waarde: o.id as string | null, label: o.naam }))}
        />
        {modus === "gezin" && (
          <button
            className="knop klein stil"
            style={{ marginTop: 10 }}
            onClick={async () => {
              await post("/api/uitloggen", {});
              await herlaad();
            }}
          >
            Uitloggen
          </button>
        )}
        <p className="stil klein" style={{ marginTop: 10 }}>
          {modus === "demo"
            ? "Demo: er is nog geen wachtwoord ingesteld. Zie SETUP.md om de app voor jullie gezin aan te zetten."
            : opslag === "upstash"
              ? "Gegevens staan veilig opgeslagen (Upstash)."
              : opslag === "tijdelijk"
                ? "Let op: de opslag is tijdelijk. Koppel Upstash (zie SETUP.md), anders raak je gegevens kwijt."
                : "Gegevens staan in de map .data op deze computer."}
        </p>
      </div>

      {bewerkLid && <LidBlad lid={bewerkLid === "nieuw" ? undefined : bewerkLid} sluit={() => zetBewerkLid(null)} />}
      {bewerkAgenda && <AgendaBlad agenda={bewerkAgenda === "nieuw" ? undefined : bewerkAgenda} sluit={() => zetBewerkAgenda(null)} />}
    </>
  );
}
