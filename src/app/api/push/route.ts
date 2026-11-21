import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { fout, sessieVan } from "@/lib/api";
import { abonnementen, vapidSleutels, verwijderAbonnement, voegAbonnementToe } from "@/lib/push";

export const dynamic = "force-dynamic";

const Abonnement = z.object({
  endpoint: z.string().url().max(2000),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** De publieke sleutel en hoeveel toestellen van jou meldingen krijgen. */
export async function GET(req: NextRequest) {
  const s = sessieVan(req);
  if (!s?.lid) return fout("Log eerst in", 401);
  const { publicKey } = await vapidSleutels();
  const mijn = (await abonnementen()).filter((a) => a.lid === s.lid);
  return NextResponse.json({ publicKey, toestellen: mijn.map((a) => ({ apparaat: a.apparaat, op: a.op, endpoint: a.abonnement.endpoint })) });
}

/** Dit toestel aanmelden voor meldingen. */
export async function POST(req: NextRequest) {
  const s = sessieVan(req);
  if (!s?.lid) return fout("Log eerst in", 401);
  const body = z.object({ abonnement: Abonnement, apparaat: z.string().max(80).default("Toestel") }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fout("Ongeldig abonnement");
  await voegAbonnementToe({
    lid: s.lid,
    abonnement: { endpoint: body.data.abonnement.endpoint, keys: body.data.abonnement.keys },
    apparaat: body.data.apparaat,
    op: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

/** Dit toestel afmelden. */
export async function DELETE(req: NextRequest) {
  const s = sessieVan(req);
  if (!s?.lid) return fout("Log eerst in", 401);
  const body = z.object({ endpoint: z.string().max(2000) }).safeParse(await req.json().catch(() => null));
  if (!body.success) return fout("Ongeldige invoer");
  const eigen = (await abonnementen()).some((a) => a.lid === s.lid && a.abonnement.endpoint === body.data.endpoint);
  if (eigen) await verwijderAbonnement(body.data.endpoint);
  return NextResponse.json({ ok: true });
}
