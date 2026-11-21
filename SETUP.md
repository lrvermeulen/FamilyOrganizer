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

**Schoolvakanties:** kies bij Gezin → Schoolvakanties de regio van de school.

**Jullie eigen agenda's in de app** (tabblad Gezin → "Agenda's van buiten" → **Agenda koppelen**):
- *Social Schools:* open de agenda in Social Schools. In de webapp: rechtsboven **Abonneren** en kopieer de link; in de app: **Opties** → **Abonneer**. Kies bij "Van wie" het kind. Social Schools geeft wijzigingen soms pas na een dag door.
- *Google Agenda:* op de computer → instellingen (tandwiel) → kies de agenda → "Agenda integreren" → kopieer het **geheime adres in iCal-indeling**.
- *Apple (iCloud):* in de Agenda-app → ⓘ bij de agenda → **Openbare agenda** aan → Deel link. Wie die link heeft, kan de agenda zien; deel hem alleen met de app.
- *School of sportclub:* gebruik hun iCal- of webcal-link.

## Stap 6. Meldingen: de klok (voor briefing en herinneringen)

De ochtendbriefing en herinneringen hebben iets nodig dat de app elke 5 minuten een tik geeft. De gratis versie van Vercel kan dat maar één keer per dag, daarom gebruik je de gratis planner van Upstash (QStash), in hetzelfde account als je opslag.

1. Bedenk een geheim van minstens 20 tekens. Zet het in Vercel bij **Settings** → **Environment Variables** als `CRON_SECRET` en klik op **Redeploy**.
2. Ga naar [console.upstash.com](https://console.upstash.com) (log in met hetzelfde account als bij stap 2) → **QStash** → **Schedules** → **Create Schedule**.
3. Vul in:
   - **Destination:** `https://<jouw-app>.vercel.app/api/klok`
   - **Cron:** `*/5 * * * *` (elke 5 minuten)
   - **Header:** `Authorization` met de waarde `Bearer <jouw CRON_SECRET>`
4. Opslaan. Dat is 288 tikken per dag, ruim binnen het gratis plan.

Alternatief: [cron-job.org](https://cron-job.org) (gratis), met hetzelfde adres en dezelfde header.

Zet daarna op elke telefoon bij **Gezin → Meldingen** de meldingen aan en kies wat je wilt krijgen. Op de iPhone werkt dat alleen als de app op het beginscherm staat. De melding als de ander iets afvinkt werkt ook zonder klok.

## Stap 7. De keukentablet

Bij **Gezin → Keukenstand** staat een link. Open die op de tablet in de keuken en zet hem op het beginscherm. Het weekbord ververst zichzelf. Zet in de instellingen van de tablet het automatisch vergrendelen uit zolang hij aan de lader hangt.

## Stap 8. Berichten en screenshots naar de inbox

- **Altijd:** kopieer een bericht en tik in de Inbox op **Plak bericht**, of kies **Screenshot**.
- **Android:** staat de app op het beginscherm, dan staat hij ook in het deelmenu (bericht ingedrukt houden in WhatsApp → Delen).
- **iPhone:** maak één keer een Opdracht (Shortcut). De stappen en jouw persoonlijke adres staan in de app onder **Inbox → Vanuit WhatsApp of een screenshot naar de inbox**.

## Eerste keer samen

1. Ga samen naar **Lijsten → Taken → Verdelen** en kies per taak wie hem in het hoofd heeft en wie hem uitvoert. Bovenaan zie je meteen hoe de takenlijst het werk verdeelt.
2. Kies op zondag **Bord → Week doorlopen**: wie brengt en haalt, wat jullie eten, wat er botst.
3. Vink een paar weken af wat je doet, en zet in de inbox wat je opvalt of binnenkomt.
4. Doe daarna bij **Inzicht** ieder apart de kaartjesronde, en neem samen de verschillen en de vragen door.

## Wat kost het?

| Onderdeel | Kosten |
|---|---|
| Vercel (Hobby-plan) | gratis |
| Upstash (opslag) | gratis, ruim binnen de limiet |
| Agenda-koppelingen (iCal) | gratis, geen Google- of Apple-account voor de app nodig |
| Upstash QStash (de klok voor meldingen) | gratis, 288 van de 1000 gratis berichten per dag |
| Pushmeldingen, tekst lezen uit screenshots | gratis, zonder AI |
