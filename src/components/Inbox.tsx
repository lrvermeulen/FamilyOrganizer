"use client";

import { useState } from "react";
import { kortLabel } from "@/lib/datum";
import { verzoekTekst } from "@/lib/meldingen";
import { useGezin } from "./context";
import { Invoerregel } from "./Invoer";
import { Bolletje } from "./ui";

const BRON_LABEL = { zelf: "opgemerkt", plakken: "geplakt", foto: "screenshot", delen: "gedeeld" } as const;

function VanafTelefoon() {
  const { staat, basis, ik, doe, bezig } = useGezin();
  const adres = `${basis}/api/inbox/${staat.inboxSleutel}?wie=${ik ?? ""}`;
  return (
    <details className="kaart">
      <summary>
        <b>Vanuit WhatsApp of een screenshot naar de inbox</b>
      </summary>
      <p className="klein">
        <b>Altijd:</b> kopieer een bericht en tik hierboven op <b>Plak bericht</b>, of kies <b>Screenshot</b>. De tekst wordt op je
        telefoon gelezen; er gaat niets naar een AI.
      </p>
      <p className="klein">
        <b>Android:</b> zet de app op je beginscherm. Daarna staat Gezinsplanner in het deelmenu: houd een bericht in WhatsApp
        ingedrukt → Delen → Gezinsplanner.
      </p>
      <div className="klein">
        <b>iPhone:</b> maak één keer een Opdracht (Shortcut), dan staat &quot;Naar gezinsinbox&quot; in je deelmenu, ook voor screenshots:
        <ol style={{ paddingLeft: 20, margin: "6px 0" }}>
          <li>Open de app Opdrachten → + → noem hem &quot;Naar gezinsinbox&quot;.</li>
          <li>Tik op ⓘ → zet <b>Toon in deelpaneel</b> aan, en kies als invoer Tekst en Afbeeldingen.</li>
          <li>
            Voeg toe: <b>Haal tekst uit afbeelding</b> (voor screenshots; je iPhone leest de tekst zelf).
          </li>
          <li>
            Voeg toe: <b>Haal inhoud van URL op</b>, met dit adres, methode <b>POST</b>, en als tekst de uitkomst van de vorige stap:
            <code className="adres">{adres}</code>
          </li>
          <li>Voeg toe: <b>Toon melding</b> met de inhoud van de URL.</li>
        </ol>
        Elke ouder maakt zijn eigen Opdracht: het adres bevat wie je bent. Delen werkt daarna vanuit WhatsApp (bericht ingedrukt houden →
        Deel) en vanuit Foto&apos;s.
      </div>
      <p className="stil klein">
        Het adres bevat een geheime code. Per ongeluk gedeeld?{" "}
        <button
          className="knop klein gevaar"
          disabled={bezig}
          onClick={() => confirm("Nieuwe code maken? Je moet de Opdracht daarna aanpassen.") && doe({ type: "sleutel.vernieuwen", welke: "inbox" })}
        >
          Nieuwe code
        </button>
      </p>
    </details>
  );
}

function Vragen() {
  const { staat, ik, lid, doe, bezig } = useGezin();
  const aanMij = staat.verzoeken.filter((v) => v.aan === ik && v.status === "open");
  const vanMij = staat.verzoeken.filter((v) => v.van === ik && v.status === "open");
  const week = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const beantwoord = staat.verzoeken.filter((v) => v.van === ik && (v.status === "ja" || v.status === "nee") && (v.antwoordOp ?? "") > week);
  if (!aanMij.length && !vanMij.length && !beantwoord.length) return null;
  return (
    <div className="kaart">
      <h3>Vragen</h3>
      {aanMij.map((v) => (
        <div key={v.id} className="vraag">
          <div className="klein stil">{lid(v.van)?.naam} vraagt:</div>
          <div>
            <b>{verzoekTekst(staat, v, kortLabel)}</b>
          </div>
          {v.bericht && <div className="klein">&quot;{v.bericht}&quot;</div>}
          <div className="rij" style={{ marginTop: 8 }}>
            <button className="knop hoofd klein" disabled={bezig} onClick={() => doe({ type: "verzoek.beantwoorden", id: v.id, ja: true })}>
              Ja, doe ik
            </button>
            <button className="knop klein" disabled={bezig} onClick={() => doe({ type: "verzoek.beantwoorden", id: v.id, ja: false })}>
              Lukt niet
            </button>
          </div>
        </div>
      ))}
      {vanMij.map((v) => (
        <div key={v.id} className="vraag">
          <div className="klein stil">Jij vroeg {lid(v.aan)?.naam}, nog geen antwoord:</div>
          <div>{verzoekTekst(staat, v, kortLabel)}</div>
          <button className="knop stil klein" disabled={bezig} onClick={() => doe({ type: "verzoek.intrekken", id: v.id })}>
            Intrekken
          </button>
        </div>
      ))}
      {beantwoord.map((v) => (
        <div key={v.id} className="vraag klein">
          {v.status === "ja" ? "✓" : "✗"} {lid(v.aan)?.naam} {v.status === "ja" ? "doet" : "kan niet"}: {verzoekTekst(staat, v, kortLabel)}
        </div>
      ))}
    </div>
  );
}

export function Inbox() {
  const { staat, lid, doe, bezig } = useGezin();
  const [verwerk, zetVerwerk] = useState<{ id: string; tekst: string; bron: "zelf" | "plakken" | "foto" | "delen" } | null>(null);
  const open = staat.opgemerkt.filter((o) => !o.afgehandeld).sort((a, b) => b.op.localeCompare(a.op));

  return (
    <>
      <div className="kop">
        <div>
          <h1>Inbox</h1>
          <div className="sub">Alles wat binnenkomt, op één plek</div>
        </div>
      </div>

      <Vragen />

      <div className="kaart">
        <Invoerregel
          begintekst={verwerk?.tekst ?? ""}
          beginbron={verwerk?.bron ?? "zelf"}
          klaar={async () => {
            if (verwerk) await doe({ type: "opgemerkt.afhandelen", id: verwerk.id });
            zetVerwerk(null);
          }}
          gewist={() => zetVerwerk(null)}
        />
      </div>

      <div className="kaart">
        <div className="kaart-kop">
          <h3>Nog uit te zoeken</h3>
          <span className="stil klein">{open.length || ""}</span>
        </div>
        {open.length === 0 ? (
          <p className="stil">Niets meer. Alles is verwerkt.</p>
        ) : (
          <ul className="lijst">
            {open.map((o) => (
              <li key={o.id}>
                <Bolletje lid={lid(o.door)} klein />
                <div className="hoofdtekst">
                  <div className="titel" style={{ whiteSpace: "pre-wrap" }}>
                    {o.tekst.length > 180 ? o.tekst.slice(0, 180) + "…" : o.tekst}
                  </div>
                  <div className="meta">
                    {kortLabel(o.op.slice(0, 10))} · {BRON_LABEL[o.bron]}
                  </div>
                </div>
                <button
                  className="knop klein"
                  onClick={() => {
                    // Gedeelde tekst telt al als opgemerkt; bij verwerken niet nog eens.
                    zetVerwerk({ id: o.id, tekst: o.tekst, bron: "zelf" });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Verwerk
                </button>
                <button className="knop klein stil" disabled={bezig} onClick={() => doe({ type: "opgemerkt.afhandelen", id: o.id })} aria-label="Klaar">
                  ✓
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <VanafTelefoon />
    </>
  );
}
