"use client";

import { useEffect, useState } from "react";
import { useGezin } from "./context";

function lees(sleutel: string): boolean {
  try {
    return localStorage.getItem(sleutel) === "1";
  } catch {
    return false;
  }
}

/**
 * De eerste stappen voor elke ouder, bovenaan het bord. Verdwijnt als alles gedaan is,
 * of als je hem wegklikt (per toestel).
 */
export function AanDeSlag({ naarTab, weekstart }: { naarTab: (t: string) => void; weekstart: () => void }) {
  const { staat, ik, ikLid, lid } = useGezin();
  const [weg, zetWeg] = useState(true);
  const [meldingenAan, zetMeldingenAan] = useState(false);
  const [weekGedaan, zetWeekGedaan] = useState(false);

  useEffect(() => {
    zetWeg(lees(`aan-de-slag-weg-${ik}`));
    zetWeekGedaan(lees("weekstart-gedaan"));
    zetMeldingenAan(typeof Notification !== "undefined" && Notification.permission === "granted");
  }, [ik]);

  const kinderen = staat.leden.filter((l) => l.rol === "kind");
  const zonderEigenaar = staat.taken.filter((t) => !t.gearchiveerd && !t.eigenaar).length;
  // Wie heeft de app ingesteld? Degene die de starttaken aanmaakte.
  const insteller = [...staat.taken].sort((a, b) => a.aangemaaktOp.localeCompare(b.aangemaaktOp))[0]?.aangemaaktDoor;

  const stappen = [
    {
      klaar: zonderEigenaar === 0,
      titel: "Samen de taken verdelen",
      uitleg: zonderEigenaar
        ? `${zonderEigenaar} taken hebben nog geen eigenaar. Doe dit samen: kies per taak wie hem in het hoofd heeft.`
        : "Alle taken hebben een eigenaar.",
      knop: "Verdelen",
      doe: () => naarTab("lijsten"),
    },
    {
      klaar: staat.agendas.length > 0,
      titel: "Jullie agenda's koppelen",
      uitleg: "Jullie gezamenlijke agenda (als 'hele gezin'), werkagenda's en Social Schools.",
      knop: "Koppelen",
      doe: () => naarTab("gezin"),
    },
    ...(kinderen.length
      ? [
          {
            klaar: kinderen.every((k) => k.groep),
            titel: "De groep van de kinderen invullen",
            uitleg: "Dan komt 'groep 4' in een schoolbrief vanzelf bij het goede kind.",
            knop: "Invullen",
            doe: () => naarTab("gezin"),
          },
        ]
      : []),
    {
      klaar: meldingenAan,
      titel: "Meldingen aanzetten op deze telefoon",
      uitleg: "Voor de ochtendbriefing en als de ander je iets vraagt.",
      knop: "Aanzetten",
      doe: () => naarTab("gezin"),
    },
    {
      klaar: weekGedaan,
      titel: "Samen de week doorlopen",
      uitleg: "Wie brengt en haalt, wat jullie eten, wat er deze week af moet.",
      knop: "Doorlopen",
      doe: weekstart,
    },
  ];
  const gedaan = stappen.filter((s) => s.klaar).length;
  if (weg || gedaan === stappen.length) return null;

  return (
    <div className="kaart aan-de-slag">
      <div className="kaart-kop">
        <h3>Aan de slag ({gedaan} van {stappen.length})</h3>
        <button
          className="knop stil klein"
          onClick={() => {
            try {
              localStorage.setItem(`aan-de-slag-weg-${ik}`, "1");
            } catch {}
            zetWeg(true);
          }}
        >
          Verbergen
        </button>
      </div>
      {insteller && insteller !== ik && (
        <p className="klein">
          Welkom {ikLid?.naam}! {lid(insteller)?.naam} heeft de app ingesteld. Begin samen met het verdelen van de taken: dat is de basis
          van alles.
        </p>
      )}
      <ul className="lijst">
        {stappen.map((s) => (
          <li key={s.titel}>
            <span className={`vinkknop ${s.klaar ? "aan" : ""}`} aria-hidden>
              {s.klaar ? "✓" : ""}
            </span>
            <div className="hoofdtekst">
              <div className="titel" style={s.klaar ? { color: "var(--stil)" } : undefined}>
                {s.titel}
              </div>
              {!s.klaar && <div className="meta">{s.uitleg}</div>}
            </div>
            {!s.klaar && (
              <button className="knop klein" onClick={s.doe}>
                {s.knop}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
