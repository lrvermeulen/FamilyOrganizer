"use client";

import { useState } from "react";
import type { Lid } from "@/lib/types";
import { post } from "./context";

export function Login({ klaar }: { klaar: () => void }) {
  const [wachtwoord, zet] = useState("");
  const [fout, zetFout] = useState<string | null>(null);
  const [bezig, zetBezig] = useState(false);
  return (
    <div className="midden">
      <form
        className="kaart"
        onSubmit={async (e) => {
          e.preventDefault();
          zetBezig(true);
          zetFout(null);
          try {
            await post("/api/login", { wachtwoord });
            klaar();
          } catch (e) {
            zetFout(e instanceof Error ? e.message : "Inloggen lukte niet");
          } finally {
            zetBezig(false);
          }
        }}
      >
        <h1 style={{ marginBottom: 6 }}>Gezinsplanner</h1>
        <p className="stil">Log in met het wachtwoord van jullie gezin.</p>
        <label className="veld" style={{ marginTop: 12 }}>
          <span>Wachtwoord</span>
          <input type="password" autoComplete="current-password" required autoFocus value={wachtwoord} onChange={(e) => zet(e.target.value)} />
        </label>
        {fout && <div className="waarschuwing">{fout}</div>}
        <button className="knop hoofd vol" disabled={bezig}>
          Inloggen
        </button>
      </form>
    </div>
  );
}

export function KiesWie({ ouders, klaar }: { ouders: Lid[]; klaar: () => void }) {
  const [fout, zetFout] = useState<string | null>(null);
  return (
    <div className="midden">
      <div className="kaart">
        <h1 style={{ marginBottom: 6 }}>Wie ben jij?</h1>
        <p className="stil">Wat je afvinkt en opmerkt, komt op jouw naam. Wisselen kan later bij Gezin.</p>
        <div className="stapel" style={{ marginTop: 14 }}>
          {ouders.map((o) => (
            <button
              key={o.id}
              className="knop vol"
              style={{ justifyContent: "flex-start", gap: 10 }}
              onClick={async () => {
                try {
                  await post("/api/kies", { lid: o.id });
                  klaar();
                } catch (e) {
                  zetFout(e instanceof Error ? e.message : "Dat lukte niet");
                }
              }}
            >
              <span className="bol" style={{ background: o.kleur }}>
                {o.naam.slice(0, 1).toUpperCase()}
              </span>
              {o.naam}
            </button>
          ))}
        </div>
        {fout && <div className="waarschuwing" style={{ marginTop: 10 }}>{fout}</div>}
      </div>
    </div>
  );
}
