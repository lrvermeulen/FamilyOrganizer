"use client";

import { useEffect, useState } from "react";
import type { AgendaItem } from "@/lib/agenda";
import { useGezin } from "./context";

/** Haalt de afspraken uit de gekoppelde agenda's (Google, Apple) op voor [van, tot]. */
export function useExtern(van: string, tot: string) {
  const { staat } = useGezin();
  const [data, zet] = useState<{ items: AgendaItem[]; fouten: { agenda: string; fout: string }[]; laden: boolean }>({
    items: [],
    fouten: [],
    laden: false,
  });
  // Opnieuw laden als de lijst met agenda's verandert.
  const agendaSleutel = staat.agendas.map((a) => `${a.id}:${a.alleenBezet}:${a.lid}`).join(",");

  useEffect(() => {
    if (!agendaSleutel) {
      zet({ items: [], fouten: [], laden: false });
      return;
    }
    let weg = false;
    zet((d) => ({ ...d, laden: true }));
    fetch(`/api/extern?van=${van}&tot=${tot}`)
      .then((r) => r.json())
      .then((d: { items?: AgendaItem[]; fouten?: { agenda: string; fout: string }[] }) => {
        if (!weg) zet({ items: d.items ?? [], fouten: d.fouten ?? [], laden: false });
      })
      .catch(() => !weg && zet({ items: [], fouten: [{ agenda: "alle", fout: "Niet bereikbaar" }], laden: false }));
    return () => {
      weg = true;
    };
  }, [van, tot, agendaSleutel]);

  return data;
}
