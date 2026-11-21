# Gezinsplanner

## Wat dit project is
Een webapp (Next.js, op Vercel) voor twee ouders met twee kinderen om het gezin te organiseren: vaste en losse taken, één gezinsagenda die meeloopt met Google Agenda en Apple Agenda, en inzicht in de verdeling van de mentale last als basis voor het gesprek daarover. Uitleg: `README.md`, installatie: `SETUP.md`.

De app is in het Nederlands: teksten, code (namen van functies en variabelen), commits en documentatie.

## Uitgangspunten
- **Mentale last = denkwerk, apart van uitvoeren.** Elke taak heeft een eigenaar (wie het in het hoofd heeft) en een uitvoerder. Houd die twee overal gescheiden. De rekenregels staan in één pure functie (`src/lib/inzicht.ts`) en in `README.md`; pas ze samen aan.
- **Eerlijk over de cijfers.** Het is een eigen schatting om het gesprek te voeden, geen meting. Zeg dat in de app als je nieuwe cijfers toont.
- **Neutraal.** De app oordeelt niet over wie te veel of te weinig doet. Geen scores, ranglijsten of verwijten; wel vragen en overzicht.
- **Inschattingen blijven verborgen** tot beide ouders hebben ingevuld (`inschattingenVanRonde`).
- **Geschiedenis klopt na overdragen.** Een voltooiing bewaart de eigenaar, het denkwerk en de duur van dat moment.
- **Agenda via iCal.** De app schrijft feeds (`/api/feed/<sleutel>/<gezin|lid-id>.ics`) en leest gekoppelde agenda's via hun iCal-adres. Geen Google- of Apple-login nodig.
- **Privacy.** Er gaat niets naar een AI of andere partij. Geheime iCal-adressen gaan nooit volledig naar de browser (`publiek()` in `src/lib/api.ts`). De demo gebruikt een eigen sleutel in de opslag en raakt nooit echte gegevens.

## Techniek
- Alle wijzigingen lopen via `pasToe(staat, actie)` in `src/lib/acties.ts` (pure functie, met zod gecontroleerd). Een nieuwe functie = een nieuwe actie daar, plus een test.
- De hele gezinsstaat is één JSON-document met een versienummer. `voerUit` in `src/lib/dienst.ts` schrijft met vergelijk-en-zet en probeert opnieuw bij een botsing.
- Opslag: Upstash Redis online, `.data/` lokaal.
- Zonder `GEZIN_WACHTWOORD` draait de app als demo met een voorbeeldgezin.

## Ontwikkelen
`npm test`, `npm run typecheck`, `npm run dev`. Draai na wijzigingen de tests en de typecheck, en klik voor schermwijzigingen de app door.

## Ideeën voor later
- Google Agenda direct beschrijven via de API (sneller dan het abonnement, dat Google maar een paar keer per dag ververst)
- Herinneringen (pushmeldingen) voor taken die blijven liggen
- Taken voor de kinderen zelf, met een eenvoudige kinderweergave
- Een maandelijkse herinnering voor het gesprek
- Afspraken uit gekoppelde agenda's laten meetellen in de inzichten (wie brengt en haalt)
