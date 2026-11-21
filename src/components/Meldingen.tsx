"use client";

import { useCallback, useEffect, useState } from "react";
import { MeldingInstellingSchema, type MeldingInstelling } from "@/lib/types";
import { post, useGezin } from "./context";

function sleutelBytes(base64: string): Uint8Array<ArrayBuffer> {
  const opgevuld = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const ruw = atob(opgevuld);
  const uit = new Uint8Array(new ArrayBuffer(ruw.length));
  for (let i = 0; i < ruw.length; i++) uit[i] = ruw.charCodeAt(i);
  return uit;
}

function apparaatNaam(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua)) return "iPad";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Toestel";
}

type Status = "laden" | "kan-niet" | "beginscherm" | "uit" | "aan" | "geweigerd";

export function Meldingen() {
  const { staat, ik, doe, bezig, meld } = useGezin();
  const [status, zetStatus] = useState<Status>("laden");
  const [aantal, zetAantal] = useState(0);
  const [bericht, zetBericht] = useState<string | null>(null);
  const ins: MeldingInstelling = staat.meldingen.find((m) => m.lid === ik) ?? MeldingInstellingSchema.parse({ lid: ik ?? "x" });

  const controleer = useCallback(async () => {
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    const losseApp = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return zetStatus(ios && !losseApp ? "beginscherm" : "kan-niet");
    }
    if (Notification.permission === "denied") return zetStatus("geweigerd");
    const info = await fetch("/api/push").then((r) => r.json()).catch(() => null);
    zetAantal(info?.toestellen?.length ?? 0);
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const abo = await reg?.pushManager.getSubscription();
    const bekend = abo && info?.toestellen?.some((t: { endpoint: string }) => t.endpoint === abo.endpoint);
    zetStatus(bekend ? "aan" : "uit");
  }, []);

  useEffect(() => {
    void controleer();
  }, [controleer]);

  const aanzetten = async () => {
    try {
      const toestemming = await Notification.requestPermission();
      if (toestemming !== "granted") return zetStatus(toestemming === "denied" ? "geweigerd" : "uit");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const { publicKey } = await fetch("/api/push").then((r) => r.json());
      const abo =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: sleutelBytes(publicKey) }));
      await post("/api/push", { abonnement: abo.toJSON(), apparaat: apparaatNaam() });
      await controleer();
    } catch (e) {
      meld(e instanceof Error ? `Meldingen aanzetten lukte niet: ${e.message}` : "Meldingen aanzetten lukte niet");
    }
  };

  const uitzetten = async () => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const abo = await reg?.pushManager.getSubscription();
    if (abo) {
      await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: abo.endpoint }) });
      await abo.unsubscribe();
    }
    await controleer();
  };

  const test = async () => {
    zetBericht(null);
    try {
      await post("/api/push/test", {});
      zetBericht("Verstuurd. Je krijgt hem binnen een paar seconden.");
    } catch (e) {
      zetBericht(e instanceof Error ? e.message : "Versturen lukte niet");
    }
  };

  const wijzig = (x: Partial<MeldingInstelling>) => {
    const { lid: _lid, ...rest } = { ...ins, ...x };
    void _lid;
    if (!bezig) void doe({ type: "meldingen.instellen", instelling: rest });
  };

  return (
    <div className="kaart">
      <h2>Meldingen</h2>
      <p className="stil klein">Per toestel aan te zetten. De instellingen hieronder gelden voor jou, op al je toestellen.</p>

      {status === "beginscherm" && (
        <div className="waarschuwing">
          Op de iPhone werken meldingen alleen als de app op je beginscherm staat: Safari → Deel → Zet op beginscherm. Open de app daarna
          vanaf het beginscherm en kom hier terug.
        </div>
      )}
      {status === "kan-niet" && <div className="waarschuwing">Deze browser ondersteunt geen meldingen.</div>}
      {status === "geweigerd" && (
        <div className="waarschuwing">Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon of browser voor deze app.</div>
      )}
      {status === "uit" && (
        <button className="knop hoofd" onClick={aanzetten}>
          Meldingen aanzetten op dit toestel
        </button>
      )}
      {status === "aan" && (
        <div className="rij">
          <span>✓ Dit toestel krijgt meldingen</span>
          <button className="knop klein" onClick={test}>
            Stuur een test
          </button>
          <button className="knop klein stil" onClick={uitzetten}>
            Uitzetten
          </button>
        </div>
      )}
      {aantal > 0 && <p className="stil klein">Je hebt meldingen aan op {aantal} {aantal === 1 ? "toestel" : "toestellen"}.</p>}
      {bericht && <p className="klein">{bericht}</p>}

      <div style={{ marginTop: 12 }}>
        <label className="vink">
          <input type="checkbox" checked={ins.briefing} onChange={(e) => wijzig({ briefing: e.target.checked })} />
          <span>
            Ochtendbriefing om{" "}
            <input
              type="time"
              value={ins.briefingTijd}
              onChange={(e) => e.target.value && wijzig({ briefingTijd: e.target.value })}
              style={{ width: 120, display: "inline-block" }}
              aria-label="Tijd ochtendbriefing"
            />
            <span className="stil klein" style={{ display: "block" }}>
              Wie moet waarheen, wie brengt en haalt, wat jullie eten en wat jij niet moet vergeten.
            </span>
          </span>
        </label>
        <label className="veld">
          <span>Herinnering voor afspraken waar jij bij bent of brengt of haalt</span>
          <select value={ins.herinneringMin ?? ""} onChange={(e) => wijzig({ herinneringMin: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Geen herinnering</option>
            <option value="15">15 minuten van tevoren</option>
            <option value="30">30 minuten van tevoren</option>
            <option value="60">1 uur van tevoren</option>
            <option value="120">2 uur van tevoren</option>
          </select>
        </label>
        <label className="vink">
          <input type="checkbox" checked={ins.takenAvond} onChange={(e) => wijzig({ takenAvond: e.target.checked })} />
          <span>
            &apos;s Avonds om{" "}
            <input
              type="time"
              value={ins.takenAvondTijd}
              onChange={(e) => e.target.value && wijzig({ takenAvondTijd: e.target.value })}
              style={{ width: 120, display: "inline-block" }}
              aria-label="Tijd takenherinnering"
            />{" "}
            een seintje als jouw taken van vandaag nog openstaan
          </span>
        </label>
        <label className="vink">
          <input type="checkbox" checked={ins.afgevinkt} onChange={(e) => wijzig({ afgevinkt: e.target.checked })} />
          <span>Een melding als de ander iets afvinkt</span>
        </label>
      </div>
      <p className="stil klein">
        De briefing, herinneringen en het avondseintje werken als de klok is ingesteld (zie SETUP.md, stap 6). De melding bij afvinken
        werkt altijd.
      </p>
    </div>
  );
}
