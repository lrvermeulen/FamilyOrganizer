# Gezinsplanner

Een app voor twee ouders om het gezin samen te organiseren. Alles komt samen op één digitaal **Weekbord**: afspraken van iedereen (ook uit Google, Apple, school en sportclub), wie brengt en haalt, wat jullie eten, taken en boodschappen. Daarnaast geeft de app inzicht in hoe de **mentale last** verdeeld is, als basis voor het gesprek daarover.

Installeren en online zetten: zie [SETUP.md](SETUP.md).

## Hoe het in elkaar zit

```
  Binnen                       Centrum                        Naar buiten
  ─────────────────            ──────────────────             ──────────────────────
  Typen of plakken   ┐                                    ┌   Ochtendbriefing (push)
  Screenshot         │                                    │   Herinneringen (push)
  Delen (Android)    ├─► Inbox ─►  Weekbord  ─────────────┤   Seintje bij afvinken
  Opdracht (iPhone)  │            (dag, week, keuken)     │   Agenda-abonnementen
  Google / Apple     │               ▲                    │   (Google en Apple)
  Social Schools     ┘               │                    └   Keukentablet
  Schoolvakanties ───────────────────┘
                         Lijsten: taken, boodschappen, menu
                         Inzicht: denkwerk, emotioneel werk, uitvoeren
```

| Tabblad | Wat je er doet |
|---|---|
| **Bord** | Het centrum. **Dag**: eten, wie moet waarheen (met brengen en halen), taken van de dag. **Week**: een kolom per gezinslid plus eten, net als een weekbord in de keuken. **Agenda**: alles als lijst, te filteren per gezinslid. Met **Week doorlopen** lopen jullie (bijvoorbeeld op zondag) samen langs wat nog open staat. |
| **Inbox** | Alles wat binnenkomt: een bericht dat je plakt, een screenshot, iets wat je deelt vanuit WhatsApp, of wat je opviel. De app doet een voorstel (afspraak, taak of boodschappen); jij bevestigt. |
| **Lijsten** | **Taken** (met **Verdelen**: samen per taak kiezen wie hem in het hoofd heeft en wie hem uitvoert), **Boodschappen** per afdeling en het **Menu** per dag. |
| **Inzicht** | Hoe denkwerk, emotioneel werk en uitvoeren verdeeld zijn, de kaartjesronde, en hulp bij het gesprek. |
| **Gezin** | Gezinsleden, meldingen, schoolvakanties, de keukenstand, agenda's koppelen en agenda-abonnementen. |

**Samen regelen**
- **De ander iets vragen:** bij brengen of halen ("Vraag Roos te halen") en bij een taak ("deze keer" of "voortaan", dan gaat de hele taak over). De ander krijgt een melding en antwoordt in de inbox met Ja of Nee; bij Ja past de app het zelf aan.
- **Verzetten:** lukt een taak vandaag niet, zet hem dan naar morgen of een andere dag. Afvinken blijft bij de oorspronkelijke keer horen.
- **Mijn dag:** op het bord zie je het hele gezin, of alleen wat bij jou hoort (plus wat nog niemand doet).
- **Aan de slag:** bovenaan het bord de eerste stappen voor elke ouder: samen verdelen, agenda's koppelen, groep van de kinderen, meldingen, week doorlopen.
- **Groep op school:** vul bij een kind de groep in, dan komt "groep 4" in een schoolbrief vanzelf bij het goede kind.

**School vastleggen:** plak in de inbox bijvoorbeeld "S&T school ma vr 8:30-15:00 brengt Roos haalt Roos" of "S&T school elke do 8:30-15:00 BSO tot 17:30 brengt Roos haalt Lau". Dat wordt één afspraak per dag bij de kinderen, met een brenger en een haler. School vervalt vanzelf in schoolvakanties en op studiedagen (uit de app of uit Social Schools), met de ritten erbij. In de agenda van wie brengt of haalt komen alleen de korte ritmomenten ("Stijn en Tobias brengen (School)" om 8:30, "Stijn en Tobias halen (School en BSO, tussen 15:00 en 17:30)"), niet het hele schoolblok. Vaste dagen: "ma vr", "elke wo", "ma t/m vr".

Met de **+**-knop typ je overal snel iets in, zoals "tandarts Nine do 14:00" of "melk, kaas en appels op de lijst".

## Zonder AI

De invoerregel en de inbox gebruiken vaste regels, geen AI: ze herkennen datums ("vrijdag", "28 november", "volgende week dinsdag"), tijden ("14:00", "half drie", "van 15:30 tot 16:15"), namen van gezinsleden, deadlines ("uiterlijk", "inleveren") en boodschappen. Een geplakte brief met meerdere datums geeft meerdere voorstellen. Tekst uit een screenshot wordt op de telefoon zelf gelezen (Tesseract; de Nederlandse taal wordt de eerste keer gedownload). Er gaat niets naar een AI.

## Mentale last: hoe de app rekent

Elke taak heeft een **eigenaar** (wie het in het hoofd heeft: eraan denken, plannen, bewaken) en eventueel een andere **uitvoerder**. Het onzichtbare deel is **denkwerk** (bedenken, plannen, onthouden, bewaken) of **emotioneel werk** (aandacht en zorg, merken hoe het met iemand gaat).

- **Onzichtbaar werk** (punten): elke keer dat een taak aan de beurt is, krijgt de eigenaar 1, 2 of 3 punten (licht, gemiddeld, zwaar). Ook als iemand anders hem uitvoert, of als hij blijft liggen. Een **doorlopende verantwoordelijkheid** (zonder vaste momenten, zoals troosten) telt zo vaak per week als ingesteld. Een afspraak regelen is 1 punt denkwerk, en iets vastleggen in de inbox of een losse taak aanmaken ook.
- **Uitvoeren** (minuten): afgevinkte taken voor wie het deed, 20 minuten per keer brengen of halen (ook bij afspraken uit gekoppelde agenda's), en de duur van afspraken die iemand regelt zonder dat een ander brengt of haalt.
- **Zo verdeelt de takenlijst het werk**: los van wat er is afgevinkt, hoe de huidige taakverdeling het werk per week verdeelt. Dat werkt meteen na het verdelen.

**De kaartjesronde.** Ieder geeft op de eigen telefoon per taak aan wie het in het hoofd heeft: ik, de ander, samen, weet niet of niet relevant. Daarna één vraag over het uitvoeren. Pas als jullie allebei klaar zijn, zien jullie elkaars antwoorden: het eigen aandeel volgens ieder, naast wat de app telt, en de taken waar jullie het verschillend zien. Per taak leg je dan vast wie de eigenaar wordt. Gespreksvragen helpen, en de afspraken bewaar je. Een nieuw gesprek start een nieuwe ronde.

Dit is een eigen schatting om het gesprek te voeden, geen wetenschappelijke meting. Wat niet in de app staat, telt niet mee.

## Agenda's

De app gebruikt iCal, de standaard die Google Agenda en Apple Agenda allebei begrijpen. Er is geen Google- of Apple-login nodig.

- **Naar jullie eigen agenda:** abonnementen voor het hele gezin of per persoon (bij Gezin). Met afspraken, ingeplande taken en schoolvakanties. Apple ververst zo vaak als je instelt; Google zelf, meestal een paar keer per dag.
- **Naar de app:** koppel agenda's via hun iCal-adres: Google, iCloud, **Social Schools** (Agenda → Abonneren) of de sportclub. Brengen en halen leg je vast in de app, ook bij afspraken uit deze agenda's.
- **Gezamenlijke agenda:** koppel hem als "Het hele gezin". Afspraken komen dan bij wie in de titel staat: een naam ("Zwemles Stijn") of letters vooraan ("S judo", "S+T zwemmen", "L&R etentje"). Zonder naam of letter komen ze bij de ouders. De letter is standaard de eerste letter van de naam, en per gezinslid aan te passen. De invoerregel begrijpt dezelfde letters.
- **Ritten in je eigen agenda:** "S&T naar school brengen" in de agenda van Lau betekent: Lau brengt Stijn en Tobias. De app zet het bij de kinderen, met Lau als brenger, en vraagt niet ook nog wie haalt. In een gezinsagenda werkt "R brengt S naar zwemles" ook. Neemt de ander het in de app over, dan gaat dat voor.
- **Schoolvakanties:** per regio, uit de open data van de Rijksoverheid.

## Meldingen

Pushmeldingen per toestel (op de iPhone alleen als de app op het beginscherm staat): de **ochtendbriefing** (wie moet waarheen, wie brengt en haalt, wat jullie eten, wat jij niet moet vergeten), **herinneringen** voor afspraken waar je bij bent of brengt of haalt, 's avonds een seintje voor taken die nog openstaan, en desgewenst een melding als de ander iets afvinkt. De briefing en herinneringen hebben een planner nodig die de app elke 5 minuten een tik geeft (zie SETUP.md).

## Privacy

- Alles staat in jullie eigen opslag (Upstash, gekoppeld aan jullie eigen Vercel-project). Er gaat niets naar een AI.
- Beveiligd met een gezinswachtwoord. Agenda-abonnementen, de keukenstand en de inbox-Opdracht werken met een geheime code in het adres; die vernieuw je bij Gezin of Inbox.
- De keukenstand toont het weekbord, eten en boodschappen, maar geen inzichten, kaartjes of agenda-adressen.
- Pushmeldingen gaan via de pushdienst van Apple of Google, versleuteld.

## Ontwikkelen

```bash
npm install
npm run dev        # http://localhost:3000, zonder wachtwoord in demo-modus
npm test           # tests
npm run typecheck
```

Lokaal met wachtwoord: `GEZIN_WACHTWOORD=test npm run dev`. Gegevens staan dan in `.data/`.

### Opbouw

| Pad | Inhoud |
|---|---|
| `src/lib/types.ts` | Het datamodel (zod-schema's) |
| `src/lib/acties.ts` | Alle wijzigingen als één pure functie `pasToe(staat, actie)` |
| `src/lib/herhaling.ts`, `taken.ts` | Herhalingen uitschrijven, welke taken openstaan |
| `src/lib/bord.ts` | Het weekbord: per dag en per gezinslid, brengen en halen, botsingen, week doorlopen |
| `src/lib/invoer.ts` | De invoerregel: Nederlandse tekst naar voorstellen, zonder AI |
| `src/lib/leden.ts` | Gezinsleden herkennen in een titel: namen en letters ("S judo") |
| `src/lib/boodschappen.ts` | Afdelingen raden, lijsten splitsen |
| `src/lib/vakanties.ts` | Schoolvakanties (open data Rijksoverheid) |
| `src/lib/inzicht.ts` | De berekening van de mentale last en de kaartjesronde |
| `src/lib/meldingen.ts`, `push.ts` | Wat er wanneer gemeld wordt, en het versturen via Web Push |
| `src/lib/agenda.ts`, `ics/` | Agenda-items, iCal schrijven (feeds) en lezen (gekoppelde agenda's) |
| `src/lib/opslag.ts`, `dienst.ts` | Opslag met versiecontrole, zodat twee ouders elkaars wijzigingen niet overschrijven |
| `src/app/api/` | API-routes (o.a. `klok` voor de meldingen, `inbox` voor de Opdracht, `keuken`, `feed`) |
| `src/components/` | De schermen |
