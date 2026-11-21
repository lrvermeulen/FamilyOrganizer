import type { AgendaItem } from "./agenda";
import { haalIcs, leesIcs } from "./ics/lezen";
import type { Staat } from "./types";

/** De afspraken uit alle gekoppelde agenda's voor [van, tot], live opgehaald. Fouten per agenda apart. */
export async function haalExtern(staat: Staat, van: string, tot: string): Promise<{ items: AgendaItem[]; fouten: { agenda: string; fout: string }[] }> {
  const fouten: { agenda: string; fout: string }[] = [];
  const lijsten = await Promise.all(
    staat.agendas.map(async (a): Promise<AgendaItem[]> => {
      try {
        return leesIcs(await haalIcs(a.url), a, van, tot, staat.leden);
      } catch (e) {
        fouten.push({ agenda: a.naam, fout: e instanceof Error ? e.message : "Onbekende fout" });
        return [];
      }
    }),
  );
  return { items: lijsten.flat(), fouten };
}
