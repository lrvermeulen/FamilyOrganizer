# Gezinsplanner

## Wat dit project is
Een webapp (Next.js, op Vercel) voor twee ouders met twee kinderen om het gezin te organiseren: vaste en losse taken, één gezinsagenda die meeloopt met Google Agenda en Apple Agenda, boodschappen en menu, en inzicht in de verdeling van de mentale last als basis voor het gesprek daarover. Uitleg: `README.md`, installatie: `SETUP.md`.

**Het Weekbord is het centrum** (de digitale tegenhanger van een weekbord in de keuken). Alles komt daar samen: binnen via de inbox, gekoppelde agenda's (ook Social Schools) en schoolvakanties; naar buiten via pushmeldingen, agenda-abonnementen en de keukenstand. Nieuwe functies horen in dat geheel te passen: komt het op het bord, in de inbox of in een melding?

De app is in het Nederlands: teksten, code (namen van functies en variabelen), commits en documentatie.

## Uitgangspunten
- **Eigenaar en uitvoerder gescheiden.** Elke taak heeft een eigenaar (wie het in het hoofd heeft) en een uitvoerder. Houd die twee overal gescheiden. De rekenregels staan in één pure functie (`src/lib/inzicht.ts`) en in `README.md`; pas ze samen aan.
- **Eerlijk over de cijfers.** Het is een eigen schatting om het gesprek te voeden, geen meting. Zeg dat in de app als je nieuwe cijfers toont.
- **Neutraal.** De app oordeelt niet over wie te veel of te weinig doet. Geen scores, ranglijsten of verwijten; wel vragen en overzicht.
- **Inschattingen blijven verborgen** tot beide ouders hebben ingevuld (`inschattingenVanRonde`).
- **Geschiedenis klopt na overdragen.** Een voltooiing bewaart de eigenaar, het denkwerk en de duur van dat moment.
- **Mentale last = denkwerk, emotioneel werk en uitvoeren.** Een taak heeft een werksoort (denkwerk of emotioneel). Doorlopende verantwoordelijkheden (herhaling "doorlopend") hebben geen momenten maar tellen wel mee.
- **Kaartjesronde:** antwoorden per taak (`percepties`) blijven verborgen tot beide ouders klaar zijn (een inschatting hebben opgeslagen). Toon nooit de antwoorden van de ander eerder.
- **Zonder AI.** De invoerregel en inbox (`src/lib/invoer.ts`) werken met vaste regels; tekst uit screenshots wordt in de browser gelezen (tesseract.js). Voeg geen AI toe zonder dat de gebruiker erom vraagt, en dan alleen als optie die standaard uit staat.
- **Letters in de agenda:** het gezin gebruikt letters vooraan in agenda-titels ("S judo" = Stijn, T = Tobias, L = Laurens, R = Roos). `herkenLeden` in `src/lib/leden.ts` herkent die en namen, voor gekoppelde agenda's (ook een gezinsagenda met `lid: null`) en de invoerregel.
- **Brengen en halen** horen bij afspraken, ook uit gekoppelde agenda's (`externRegelingen`, gekoppeld via `regelSleutel`).
- **Agenda via iCal.** De app schrijft feeds (`/api/feed/<sleutel>/<gezin|lid-id>.ics`) en leest gekoppelde agenda's via hun iCal-adres. Geen Google- of Apple-login nodig.
- **Privacy.** Er gaat niets naar een AI. Pushmeldingen gaan versleuteld via de pushdienst van Apple of Google; verder geen andere partijen. Geheime iCal-adressen gaan nooit volledig naar de browser (`publiek()` in `src/lib/api.ts`). De demo gebruikt een eigen sleutel in de opslag en raakt nooit echte gegevens.

## Techniek
- Alle wijzigingen lopen via `pasToe(staat, actie)` in `src/lib/acties.ts` (pure functie, met zod gecontroleerd). Een nieuwe functie = een nieuwe actie daar, plus een test.
- De hele gezinsstaat is één JSON-document met een versienummer. `voerUit` in `src/lib/dienst.ts` schrijft met vergelijk-en-zet en probeert opnieuw bij een botsing.
- Opslag: Upstash Redis online, `.data/` lokaal.
- Zonder `GEZIN_WACHTWOORD` draait de app als demo met een voorbeeldgezin.
- Meldingen: `src/lib/meldingen.ts` (pure functie: wat moet er nu weg) en `src/lib/push.ts` (Web Push; VAPID-sleutels uit de omgeving of zelf gemaakt in de opslag). `/api/klok` wordt elke 5 minuten aangeroepen door een planner met `CRON_SECRET`.
- Geheime sleutels in adressen: `feedSleutel` (agenda-abonnementen), `keukenSleutel` (keukenstand), `inboxSleutel` (Opdracht op de iPhone).

## Ontwikkelen
`npm test`, `npm run typecheck`, `npm run dev`. Draai na wijzigingen de tests en de typecheck, en klik voor schermwijzigingen de app door.

## Ideeën voor later
- **Picnic:** de boodschappenlijst met één knop in het Picnic-mandje. Er is geen officiële koppeling; alleen een onofficiële (eigen risico, kan stoppen, mogelijk tegen de voorwaarden). Gebruiker koos: eerst zonder, later beslissen.
- Google Agenda direct beschrijven via de API (sneller dan het abonnement, dat Google maar een paar keer per dag ververst)
- Taken voor de kinderen zelf, met een eenvoudige kinderweergave op de keukentablet
- Een maandelijkse herinnering voor het gesprek
- Delen met oppas of opa en oma (een eigen alleen-bekijken-link per persoon)
