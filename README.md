# Gezinsplanner

Een app voor twee ouders om het gezin samen te organiseren: vaste en losse taken, één agenda voor iedereen die meeloopt met Google Agenda en Apple Agenda, en inzicht in hoe de **mentale last** verdeeld is, als basis voor het gesprek daarover.

Installeren en online zetten: zie [SETUP.md](SETUP.md).

## Onderdelen

| Tabblad | Wat je er doet |
|---|---|
| **Vandaag** | Agenda van vandaag en morgen, taken die vandaag aan de beurt zijn of zijn blijven liggen, en de lijst "Opgemerkt". Afvinken met één tik; tik op een taak om te kiezen wie het deed, hoe lang het duurde, of om hem over te slaan. |
| **Agenda** | Weekoverzicht van het hele gezin: afspraken uit de app, ingeplande taken en de gekoppelde agenda's (Google, Apple, school, club). Filteren per gezinslid. De app waarschuwt als iemand twee dingen tegelijk heeft. |
| **Taken** | Alle taken per soort. Met **Verdelen** lopen jullie samen de taken langs en kiezen per taak wie hem *in het hoofd heeft* en wie hem *uitvoert*. Starttaken voor een gezin met jonge kinderen staan klaar. |
| **Inzicht** | Hoe het denkwerk en het uitvoeren verdeeld zijn, hoe jullie dat zelf inschatten, en hulp bij het gesprek. |
| **Gezin** | Gezinsleden, agenda's koppelen, agenda-abonnementen voor Google en Apple, wie je bent. |

Met de **+**-knop leg je overal snel een taak, afspraak of iets "Opgemerkt" vast.

## Mentale last: hoe de app rekent

Elke taak heeft een **eigenaar** (wie het in het hoofd heeft: eraan denken, plannen, bewaken) en eventueel een andere **uitvoerder**. Die twee zijn in de praktijk vaak verschillend verdeeld, en dat verschil is precies waar het gesprek over gaat.

- **Denkwerk** (onzichtbaar): elke keer dat een taak aan de beurt is, krijgt de eigenaar 1, 2 of 3 punten (licht, gemiddeld, zwaar). Ook als iemand anders hem uitvoert, of als hij blijft liggen. Een afspraak regelen (brengen, halen, erbij zijn) is 1 punt. Iets vastleggen bij "Opgemerkt" of een losse taak aanmaken ook: opmerken dat iets moet gebeuren is ook werk.
- **Uitvoeren** (zichtbaar): de minuten van afgevinkte taken voor wie het deed, plus de duur van afspraken die iemand regelt.
- **Zo verdeelt de takenlijst het werk**: los van wat er is afgevinkt, rekent de app uit hoe de huidige taakverdeling het werk per week verdeelt. Dat werkt meteen na het verdelen, zonder geschiedenis.

Bij het afvinken legt de app vast wie op dat moment eigenaar was, zodat het overdragen van een taak de geschiedenis niet verandert.

**Het gesprek.** Bij Inzicht vult ieder eerst los van de ander in hoe groot het eigen aandeel is. Pas als jullie allebei hebben ingevuld, zie je elkaars inschatting naast wat de app telt. Daarna volgen vragen om het gesprek te openen, en leg je de afspraken vast. Een nieuw gesprek start een nieuwe ronde inschattingen. Een taak overdragen gaat bij voorkeur in zijn geheel: eraan denken, plannen én uitvoeren.

Dit is een eigen schatting om het gesprek te voeden, geen wetenschappelijke meting. Wat niet in de app staat, telt niet mee.

## Agenda: koppelen met Google en Apple

De app gebruikt iCal, de standaard die Google Agenda en Apple Agenda allebei begrijpen. Er is geen Google- of Apple-login nodig.

- **Van de app naar jullie agenda's.** Bij Gezin staan agenda-abonnementen: één voor het hele gezin en één per gezinslid. Met een tik voeg je ze toe aan Apple Agenda of Google Agenda. Afspraken en ingeplande taken uit de app verschijnen dan in jullie eigen agenda-app. Apple ververst zo vaak als je instelt (bijvoorbeeld elke 5 minuten), Google ververst zelf, meestal een paar keer per dag.
- **Van jullie agenda's naar de app.** Koppel per persoon een agenda via het (geheime) iCal-adres: van Google Agenda, een iCloud-agenda, de school of de sportclub. De app leest ze live en verandert er niets in. Kies "Alleen bezet" voor bijvoorbeeld een werkagenda.

## Privacy

- Alles staat in jullie eigen opslag (Upstash, gekoppeld aan jullie eigen Vercel-project). Er gaat niets naar een AI of naar andere partijen.
- De app is beveiligd met een gezinswachtwoord. De agenda-abonnementen werken met een geheime code in het adres; die kun je bij Gezin vernieuwen.
- Geheime iCal-adressen van jullie agenda's worden opgeslagen om ze te kunnen lezen, maar de app laat ze daarna niet meer volledig zien.

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
| `src/lib/herhaling.ts` | Herhalingen uitschrijven (dagelijks, wekelijks op dagen, maandelijks, jaarlijks) |
| `src/lib/taken.ts` | Welke taken openstaan |
| `src/lib/inzicht.ts` | De berekening van de mentale last |
| `src/lib/agenda.ts`, `src/lib/ics/` | Agenda-items, iCal schrijven (feeds) en lezen (gekoppelde agenda's) |
| `src/lib/opslag.ts`, `src/lib/dienst.ts` | Opslag met versiecontrole, zodat twee ouders elkaars wijzigingen niet overschrijven |
| `src/app/api/` | API-routes |
| `src/components/` | De schermen |
