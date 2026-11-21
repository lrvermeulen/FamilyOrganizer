# De app online zetten

Reken op ongeveer 20 minuten. Alles is gratis.

Je hebt nodig: je GitHub-account en een (gratis) Vercel-account.

## Stap 1. De app op Vercel zetten

1. Zorg dat de code op de `main`-branch staat (vraag Claude Code om een pull request en voeg die samen).
2. Ga naar [vercel.com](https://vercel.com), kies **Sign Up** en dan **Continue with GitHub**.
3. Klik op **Add New…** → **Project** en kies de repository **FamilyOrganizer**.
4. Laat de instellingen staan en klik op **Deploy**. Je krijgt een adres zoals `https://familyorganizer-abc.vercel.app`.

Open het adres: je ziet de app als **demo** met een voorbeeldgezin. Probeer gerust alles uit.

## Stap 2. Opslag koppelen (Upstash, gratis)

1. Open in Vercel je project → tabblad **Storage**.
2. **Create Database** → **Upstash for Redis** → het gratis plan.
3. Koppel de database aan het project. Vercel zet `KV_REST_API_URL` en `KV_REST_API_TOKEN` er zelf in.

Zonder deze stap is de opslag op Vercel tijdelijk en raak je gegevens kwijt.

## Stap 3. Het gezinswachtwoord instellen

1. In Vercel: **Settings** → **Environment Variables**.
2. Voeg toe:
   - `GEZIN_WACHTWOORD`: een wachtwoord dat jullie allebei kennen (lang en niet ergens anders gebruikt).
   - `SESSION_SECRET`: een willekeurige tekst van minstens 32 tekens.
3. Ga naar **Deployments**, klik bij de bovenste op **⋯** → **Redeploy**.

Open de app: je ziet nu een inlogscherm. Na het inloggen stel je het gezin in (namen, kinderen, wie jij bent) en kies je de starttaken. De demo-gegevens worden nooit met jullie echte gegevens gemengd.

## Stap 4. Op jullie telefoons

- **iPhone:** open de app in Safari → Deel → **Zet op beginscherm**.
- **Android:** open de app in Chrome → menu → **Toevoegen aan startscherm**.

Log op elke telefoon in met het gezinswachtwoord en kies wie je bent.

## Stap 5. Agenda's koppelen

**Gezinsagenda in jullie eigen agenda-app** (tabblad Gezin → "Gezinsagenda in Google en Apple"):
- Op de iPhone: tik op **Apple Agenda**. Stel daarna bij Instellingen → Agenda → Accounts → het abonnement in hoe vaak hij ververst (bijvoorbeeld elke 5 minuten).
- Met Google: tik op **Google Agenda** en bevestig. Google ververst zelf, meestal een paar keer per dag.
- Kies per persoon wat handig is: het hele gezin, of alleen je eigen afspraken en die van de kinderen.

**Jullie eigen agenda's in de app** (tabblad Gezin → "Agenda's van buiten" → **Agenda koppelen**):
- *Google Agenda:* op de computer → instellingen (tandwiel) → kies de agenda → "Agenda integreren" → kopieer het **geheime adres in iCal-indeling**.
- *Apple (iCloud):* in de Agenda-app → ⓘ bij de agenda → **Openbare agenda** aan → Deel link. Wie die link heeft, kan de agenda zien; deel hem alleen met de app.
- *School of sportclub:* gebruik hun iCal- of webcal-link.

## Eerste keer samen

1. Ga samen naar **Taken → Verdelen** en kies per taak wie hem in het hoofd heeft en wie hem uitvoert. Bovenaan zie je meteen hoe de takenlijst het werk verdeelt.
2. Vink een paar weken af wat je doet, en leg bij **Opgemerkt** vast wat je opvalt.
3. Vul daarna bij **Inzicht** ieder apart je inschatting in, en neem samen de cijfers en de vragen door.

## Wat kost het?

| Onderdeel | Kosten |
|---|---|
| Vercel (Hobby-plan) | gratis |
| Upstash (opslag) | gratis, ruim binnen de limiet |
| Agenda-koppelingen (iCal) | gratis, geen Google- of Apple-account voor de app nodig |
