import { NextResponse } from "next/server";
import { SESSIE_COOKIE } from "@/lib/sessie";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSIE_COOKIE);
  return res;
}
