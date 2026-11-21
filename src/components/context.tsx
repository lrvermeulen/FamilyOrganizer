"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Actie } from "@/lib/acties";
import type { Lid, Staat } from "@/lib/types";

export interface Gegevens {
  modus: "gezin" | "demo";
  opslag: "upstash" | "tijdelijk" | "bestand";
  ik: string | null;
  basis: string;
  staat: Staat;
}

interface GezinApi extends Gegevens {
  ikLid: Lid;
  ouders: Lid[];
  lid: (id: string | null | undefined) => Lid | undefined;
  doe: (actie: Actie) => Promise<boolean>;
  bezig: boolean;
  melding: string | null;
  meld: (tekst: string | null) => void;
  herlaad: () => Promise<void>;
}

const Ctx = createContext<GezinApi | null>(null);

export function useGezin(): GezinApi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGezin buiten GezinProvider");
  return c;
}

export async function post<T = unknown>(pad: string, body: unknown): Promise<T> {
  const res = await fetch(pad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { fout?: string };
  if (!res.ok) throw new Error(data.fout ?? `Fout ${res.status}`);
  return data;
}

export function GezinProvider({
  gegevens,
  zet,
  herlaad,
  children,
}: {
  gegevens: Gegevens;
  zet: (g: Gegevens) => void;
  herlaad: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [bezig, setBezig] = useState(false);
  const [melding, meld] = useState<string | null>(null);

  const doe = useCallback(
    async (actie: Actie) => {
      setBezig(true);
      try {
        const { staat } = await post<{ staat: Staat }>("/api/actie", { actie });
        zet({ ...gegevens, staat });
        return true;
      } catch (e) {
        meld(e instanceof Error ? e.message : "Er ging iets mis");
        return false;
      } finally {
        setBezig(false);
      }
    },
    [gegevens, zet],
  );

  const api = useMemo<GezinApi>(() => {
    const ouders = gegevens.staat.leden.filter((l) => l.rol === "ouder");
    const lid = (id: string | null | undefined) => gegevens.staat.leden.find((l) => l.id === id);
    return {
      ...gegevens,
      ikLid: lid(gegevens.ik) ?? ouders[0],
      ouders,
      lid,
      doe,
      bezig,
      melding,
      meld,
      herlaad,
    };
  }, [gegevens, doe, bezig, melding, herlaad]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}
