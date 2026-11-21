import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Opslag van het hele gezinsdocument als één JSON-tekst, met een versienummer.
 * 'zetAls' schrijft alleen als de versie nog klopt, zodat twee ouders die tegelijk iets
 * wijzigen elkaars werk niet overschrijven.
 */
export interface Opslag {
  lees(sleutel: string): Promise<string | null>;
  /** Schrijf alleen als de opgeslagen versie gelijk is aan 'verwacht'. Geeft false bij een botsing. */
  zetAls(sleutel: string, verwacht: number, nieuw: number, tekst: string): Promise<boolean>;
  wis(sleutel: string): Promise<void>;
  /** Gewoon opslaan, zonder versiecontrole (voor losse gegevens zoals push-abonnementen). */
  zet(sleutel: string, tekst: string): Promise<void>;
}

export class GeheugenOpslag implements Opslag {
  private data = new Map<string, { versie: number; tekst: string }>();
  async lees(k: string) {
    return this.data.get(k)?.tekst ?? null;
  }
  async zetAls(k: string, verwacht: number, nieuw: number, tekst: string) {
    if ((this.data.get(k)?.versie ?? 0) !== verwacht) return false;
    this.data.set(k, { versie: nieuw, tekst });
    return true;
  }
  async wis(k: string) {
    this.data.delete(k);
  }
  async zet(k: string, tekst: string) {
    this.data.set(k, { versie: this.data.get(k)?.versie ?? 0, tekst });
  }
}

/** Voor lokaal gebruik: een bestand in .data/ */
export class BestandOpslag implements Opslag {
  private rij: Promise<unknown> = Promise.resolve();
  constructor(private map = path.join(process.cwd(), ".data")) {}
  private pad(k: string) {
    return path.join(this.map, encodeURIComponent(k) + ".json");
  }
  async lees(k: string) {
    try {
      return await fs.readFile(this.pad(k), "utf8");
    } catch {
      return null;
    }
  }
  async zetAls(k: string, verwacht: number, nieuw: number, tekst: string) {
    const klus = this.rij.then(async () => {
      const oud = await this.lees(k);
      const versie = oud ? (JSON.parse(oud) as { versie?: number }).versie ?? 0 : 0;
      if (versie !== verwacht) return false;
      await fs.mkdir(this.map, { recursive: true });
      await fs.writeFile(this.pad(k), tekst);
      void nieuw;
      return true;
    });
    this.rij = klus.catch(() => undefined);
    return klus;
  }
  async wis(k: string) {
    await fs.rm(this.pad(k), { force: true });
  }
  async zet(k: string, tekst: string) {
    await fs.mkdir(this.map, { recursive: true });
    await fs.writeFile(this.pad(k), tekst);
  }
}

/** Online: Upstash Redis via de REST-API (gratis via de Vercel Marketplace). */
export class UpstashOpslag implements Opslag {
  constructor(
    private url: string,
    private token: string,
  ) {}
  private async cmd<T>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(args.map(String)),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Opslag gaf fout ${res.status}`);
    const body = (await res.json()) as { result: T; error?: string };
    if (body.error) throw new Error(`Opslag: ${body.error}`);
    return body.result;
  }
  async lees(k: string) {
    return this.cmd<string | null>("GET", k);
  }
  async zetAls(k: string, verwacht: number, nieuw: number, tekst: string) {
    // Vergelijk-en-zet in één stap op de server (Lua), met een apart versienummer.
    const script =
      "local v = redis.call('GET', KEYS[2]) or '0' " +
      "if v == ARGV[1] then redis.call('SET', KEYS[1], ARGV[3]) redis.call('SET', KEYS[2], ARGV[2]) return 1 end " +
      "return 0";
    const r = await this.cmd<number>("EVAL", script, 2, k, `${k}:versie`, verwacht, nieuw, tekst);
    return r === 1;
  }
  async wis(k: string) {
    await this.cmd("DEL", k, `${k}:versie`);
  }
  async zet(k: string, tekst: string) {
    await this.cmd("SET", k, tekst);
  }
}

let gedeeld: Opslag | null = null;

/** Alleen voor tests. */
export function gebruikOpslag(o: Opslag | null) {
  gedeeld = o;
}

export function soortOpslag(): "upstash" | "tijdelijk" | "bestand" {
  if (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL) return "upstash";
  return process.env.VERCEL ? "tijdelijk" : "bestand";
}

export function opslag(): Opslag {
  if (gedeeld) return gedeeld;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  gedeeld = url && token ? new UpstashOpslag(url, token) : new BestandOpslag(process.env.VERCEL ? "/tmp/gezin" : undefined);
  return gedeeld;
}
