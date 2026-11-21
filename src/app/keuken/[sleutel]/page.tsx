import type { Metadata } from "next";
import { Keuken } from "@/components/Keuken";

export const metadata: Metadata = { title: "Weekbord" };

export default async function KeukenPagina({ params }: { params: Promise<{ sleutel: string }> }) {
  const { sleutel } = await params;
  return <Keuken sleutel={sleutel} />;
}
