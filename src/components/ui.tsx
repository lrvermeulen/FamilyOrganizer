"use client";

import { useEffect } from "react";
import type { Lid } from "@/lib/types";

export function Bolletje({ lid, klein }: { lid?: Lid; klein?: boolean }) {
  if (!lid) return <span className={`bol leeg ${klein ? "klein" : ""}`} title="Nog niet verdeeld">?</span>;
  return (
    <span className={`bol ${klein ? "klein" : ""}`} style={{ background: lid.kleur }} title={lid.naam}>
      {lid.naam.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function Blad({ titel, sluit, children }: { titel: string; sluit: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && sluit();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, [sluit]);
  return (
    <div className="blad-achter" onClick={sluit}>
      <div className="blad" role="dialog" aria-modal="true" aria-label={titel} onClick={(e) => e.stopPropagation()}>
        <div className="blad-kop">
          <h2>{titel}</h2>
          <button className="knop stil" onClick={sluit} aria-label="Sluiten">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Keuzes<T extends string | number | boolean | null>({
  waarde,
  opties,
  kies,
  label,
}: {
  waarde: T;
  opties: { waarde: T; label: React.ReactNode; titel?: string }[];
  kies: (w: T) => void;
  label?: string;
}) {
  return (
    <div className="keuzes" role="radiogroup" aria-label={label}>
      {opties.map((o) => (
        <button
          type="button"
          key={String(o.waarde)}
          role="radio"
          aria-checked={o.waarde === waarde}
          className={`chip ${o.waarde === waarde ? "aan" : ""}`}
          title={o.titel}
          onClick={() => kies(o.waarde)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LedenKeuze({
  leden,
  gekozen,
  wissel,
}: {
  leden: Lid[];
  gekozen: string[];
  wissel: (id: string) => void;
}) {
  return (
    <div className="keuzes">
      {leden.map((l) => {
        const aan = gekozen.includes(l.id);
        return (
          <button
            type="button"
            key={l.id}
            aria-pressed={aan}
            className={`chip ${aan ? "aan" : ""}`}
            style={aan ? { background: l.kleur, borderColor: l.kleur, color: "#fff" } : undefined}
            onClick={() => wissel(l.id)}
          >
            {l.naam}
          </button>
        );
      })}
    </div>
  );
}

/** Een balk die laat zien hoe iets tussen de ouders verdeeld is. */
export function Verdeling({
  delen,
  eenheid,
}: {
  delen: { lid?: Lid; waarde: number; label?: string }[];
  eenheid?: (w: number) => string;
}) {
  const totaal = delen.reduce((s, d) => s + d.waarde, 0);
  if (!totaal) return <div className="verdeling leeg">Nog niets vastgelegd</div>;
  return (
    <div>
      <div className="verdeling" role="img" aria-label={delen.map((d) => `${d.lid?.naam ?? d.label ?? "Niet verdeeld"} ${Math.round((d.waarde / totaal) * 100)}%`).join(", ")}>
        {delen
          .filter((d) => d.waarde > 0)
          .map((d, i) => (
            <div
              key={i}
              className={`deel ${d.lid ? "" : "zonder"}`}
              style={{ width: `${(d.waarde / totaal) * 100}%`, background: d.lid?.kleur }}
            >
              {d.waarde / totaal >= 0.12 ? `${Math.round((d.waarde / totaal) * 100)}%` : ""}
            </div>
          ))}
      </div>
      <div className="legenda">
        {delen.map((d, i) => (
          <span key={i}>
            <i style={{ background: d.lid?.kleur }} className={d.lid ? "" : "zonder"} />
            {d.lid?.naam ?? d.label ?? "Niet verdeeld"}: <b>{Math.round((d.waarde / totaal) * 100)}%</b>
            {eenheid ? <span className="stil"> ({eenheid(d.waarde)})</span> : null}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DenkwerkStippen({ n }: { n: number }) {
  return (
    <span className="stippen" title={["", "Licht denkwerk", "Gemiddeld denkwerk", "Zwaar denkwerk"][n]} aria-label={`Denkwerk ${n} van 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? "vol" : ""} />
      ))}
    </span>
  );
}
