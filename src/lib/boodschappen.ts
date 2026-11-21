/** Afdelingen in de volgorde waarin je ze in een gewone supermarkt tegenkomt. */
export const AFDELINGEN = [
  "Groente en fruit",
  "Brood",
  "Vlees en vis",
  "Zuivel en eieren",
  "Kaas en vleeswaren",
  "Pasta, rijst en wereld",
  "Ontbijt en beleg",
  "Soepen, sauzen en kruiden",
  "Snoep en koek",
  "Dranken",
  "Diepvries",
  "Baby en kind",
  "Drogist",
  "Huishouden",
  "Overig",
] as const;
export type Afdeling = (typeof AFDELINGEN)[number];

const WOORDEN: [Afdeling, string[]][] = [
  ["Groente en fruit", ["appel", "peer", "peren", "banaan", "bananen", "druiven", "aardbeien", "sinaasappel", "mandarijn", "druif", "aardbei", "framboos", "blauwe bes", "bessen", "kiwi", "mango", "ananas", "meloen", "citroen", "limoen", "avocado", "tomaat", "tomaten", "komkommer", "paprika", "sla", "spinazie", "andijvie", "boerenkool", "broccoli", "bloemkool", "wortel", "winterpeen", "ui", "uien", "knoflook", "prei", "courgette", "aubergine", "champignon", "paddenstoel", "aardappel", "krieler", "zoete aardappel", "bonen", "sperzie", "erwt", "mais", "radijs", "gember", "kruiden vers", "peterselie", "basilicum", "koriander", "rucola", "spruit", "pompoen", "biet", "venkel", "selderij", "fruit", "groente"]],
  ["Brood", ["brood", "bolletje", "broodje", "croissant", "stokbrood", "wrap", "tortilla", "pita", "krentenbol", "beschuit", "cracker", "knäckebröd"]],
  ["Vlees en vis", ["kip", "kipfilet", "gehakt", "rundvlees", "biefstuk", "varken", "speklap", "spek", "worst", "braadworst", "hamburger", "schnitzel", "vis", "zalm", "kabeljauw", "tonijn vers", "garnaal", "shoarma", "vlees", "vegaburger", "tofu", "tempeh"]],
  ["Zuivel en eieren", ["melk", "karnemelk", "yoghurt", "kwark", "vla", "boter", "roomboter", "room", "slagroom", "crème fraîche", "creme fraiche", "eieren", "ei", "zuivel", "toetje", "pudding", "margarine"]],
  ["Kaas en vleeswaren", ["kaas", "geraspte kaas", "mozzarella", "feta", "parmezaan", "ham", "salami", "kipfilet beleg", "rookvlees", "filet americain", "smeerkaas"]],
  ["Pasta, rijst en wereld", ["pasta", "spaghetti", "macaroni", "penne", "lasagne", "rijst", "noedels", "mie", "couscous", "taco", "nasi", "bami", "kokosmelk", "sojasaus", "curry", "bulgur", "quinoa"]],
  ["Ontbijt en beleg", ["hagelslag", "pindakaas", "jam", "honing", "chocopasta", "nutella", "muesli", "cornflakes", "havermout", "ontbijtkoek", "granola", "appelstroop"]],
  ["Soepen, sauzen en kruiden", ["soep", "saus", "ketchup", "mayonaise", "mayo", "mosterd", "olie", "olijfolie", "azijn", "zout", "peper", "kruiden", "bouillon", "tomatenpuree", "passata", "pesto", "bloem", "suiker", "bakpoeder", "gist", "blik", "pot"]],
  ["Snoep en koek", ["koek", "koekjes", "biscuit", "chocolade", "snoep", "drop", "chips", "nootjes", "noten", "popcorn", "rozijnen", "liga", "sultana", "evergreen"]],
  ["Dranken", ["koffie", "thee", "sap", "appelsap", "jus", "limonade", "siroop", "ranja", "water", "spa", "frisdrank", "cola", "bier", "wijn", "drinkpakje"]],
  ["Diepvries", ["diepvries", "ijs", "ijsjes", "patat", "friet", "pizza", "spinazie diepvries", "doperwten", "vissticks", "bladerdeeg"]],
  ["Baby en kind", ["luier", "luiers", "billendoekjes", "babyvoeding", "fruithapje", "knijpfruit", "flesvoeding", "speen"]],
  ["Drogist", ["tandpasta", "tandenborstel", "shampoo", "douchegel", "zeep", "deodorant", "scheer", "pleister", "paracetamol", "zonnebrand", "maandverband", "tampons", "wattenstaafjes", "crème", "creme", "luizenshampoo"]],
  ["Huishouden", ["wc-papier", "wc papier", "toiletpapier", "keukenpapier", "tissues", "afwasmiddel", "vaatwastablet", "vaatwas", "wasmiddel", "wasverzachter", "schoonmaak", "allesreiniger", "vuilniszak", "afvalzak", "aluminiumfolie", "folie", "bakpapier", "boterhamzakje", "batterij", "lampje", "spons"]],
];

/** Raad de afdeling bij een boodschap. Valt terug op "Overig". */
export function afdelingVan(naam: string): Afdeling {
  const n = naam.toLowerCase().replace(/^\d+\s*(x|st|stuks|kg|g|gram|l|liter|pak|pakken|zak|zakken)?\s+/, "");
  let beste: { afdeling: Afdeling; lengte: number } | null = null;
  for (const [afdeling, woorden] of WOORDEN) {
    for (const w of woorden) {
      // Hele woorden of het begin van een samenstelling (bijvoorbeeld "melk" in "volle melk", "kip" in "kipdijen").
      const re = new RegExp(`(^|[^a-zà-ÿ])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      if (re.test(n) && (!beste || w.length > beste.lengte)) beste = { afdeling, lengte: w.length };
    }
  }
  return beste?.afdeling ?? "Overig";
}

/** Splits een ingetypte of geplakte lijst ("melk, kaas en 2 appels") in losse boodschappen. */
export function splitsBoodschappen(tekst: string): string[] {
  return tekst
    .split(/\n|,|;|\ben\b|•|·/i)
    .map((s) => s.replace(/^[-*–\s]+/, "").replace(/^\[ ?\]\s*/, "").trim())
    .filter((s) => s.length > 0 && s.length <= 80);
}
