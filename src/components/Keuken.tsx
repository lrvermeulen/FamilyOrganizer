"use client";

import { useCallback, useEffect, useState } from "react";
import type { AgendaItem } from "@/lib/agenda";
import { alleItems, bordDag } from "@/lib/bord";
import { langLabel, maandagVan, plusDagen, vandaag as vandaagDatum } from "@/lib/datum";
import type { Staat } from "@/lib/types";
import { BordRaster } from "./Bord";

const VERVERS_MS = 5 * 60_000;

/** De keukenstand: het weekbord groot op een tablet, alleen om te bekijken. Ververst zichzelf. */
export function Keuken({ sleutel }: { sleutel: string }) {
  const [data, zet] = useState<{ staat: Staat; extern: AgendaItem[] } | null>(null);
  const [fout, zetFout] = useState<string | null>(null);
  const [nu, zetNu] = useState(() => new Date());

  const laad = useCallback(async () => {
    try {
      const res = await fetch(`/api/keuken/${encodeURIComponent(sleutel)}`, { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) return zetFout(d.fout ?? "Laden lukte niet");
      zet(d);
      zetFout(null);
    } catch {
      // Geen internet: het oude bord blijft staan.
    }
  }, [sleutel]);

  useEffect(() => {
    void laad();
    const a = setInterval(laad, VERVERS_MS);
    const b = setInterval(() => zetNu(new Date()), 15_000);
    // Scherm aan houden waar dat kan.
    let slot: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    nav.wakeLock?.request("screen").then((s) => (slot = s)).catch(() => undefined);
    return () => {
      clearInterval(a);
      clearInterval(b);
      void slot?.release();
    };
  }, [laad]);

  if (fout) return <div className="midden"><div className="kaart"><h2>Weekbord</h2><p>{fout}</p></div></div>;
  if (!data) return <div className="midden stil">Laden…</div>;

  const vandaag = vandaagDatum();
  const maandag = maandagVan(vandaag);
  const items = alleItems(data.staat, data.extern, maandag, plusDagen(maandag, 6));
  const b = bordDag(data.staat, items, vandaag, vandaag);
  const open = data.staat.boodschappen.filter((x) => !x.gekocht);
  const morgen = data.staat.maaltijden.find((m) => m.datum === plusDagen(vandaag, 1));

  return (
    <div className="keuken">
      <div className="keuken-kop">
        <div>
          <div className="klok">{nu.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</div>
          <div className="datum">
            {langLabel(vandaag)}
            {b.vakantie ? ` · ${b.vakantie.naam}` : ""}
          </div>
        </div>
        <div className="stil">{data.staat.gezinsnaam}</div>
      </div>
      <BordRaster staat={data.staat} items={items} maandag={maandag} vandaag={vandaag} groot />
      <div className="keuken-onder">
        <div className="kaart">
          <h3>Eten</h3>
          <p>
            Vandaag: <b>{b.maaltijd?.wat || "?"}</b>
          </p>
          {morgen?.wat && <p className="stil">Morgen: {morgen.wat}</p>}
        </div>
        <div className="kaart">
          <h3>Boodschappen ({open.length})</h3>
          <p>{open.slice(0, 14).map((x) => x.naam).join(", ") || "Niets nodig"}</p>
        </div>
      </div>
    </div>
  );
}
