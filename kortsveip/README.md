# Kortsveip

Del en regning ved å sveipe hver utgift i en pott. Laget for å slippe å sitte
med kredittkortregninga og en kalkulator den 20. hver måned.

🔗 https://espenbjork.github.io/kortsveip/

Ren HTML, CSS og JS. Ingen rammeverk, ingen byggesteg, ingen server, ingen
avhengigheter. **All kontodata blir liggende i nettleseren** (`localStorage`),
og det finnes ikke noe sted å sende den.

## Hva den gjør

| | |
| --- | --- |
| **Leser regninga** | Regneark (`.xlsx`), CSV, TSV eller limt inn tekst |
| **Potter du velger selv** | Personer, felles, og «utenfor» for f.eks. jobbutgifter |
| **Fire sveiperetninger** | → ← ↑ ↓, flere potter blir knapper under kortet |
| **Husker butikker** | «Rema» havnet i Felles sist, så foreslås det neste gang |
| **Tar hele kjeden** | «4 kjøp til fra Rema. Samme der?» |
| **Sammenlikner** | Har begge sveipet, legges uenighetene øverst |
| **Oppgjør** | Egne utgifter + din del av felles, og hvem som skylder hvem |

## Slik henger den sammen

`les.js` gjør en fil om til en liste utgifter. `app.js` gjør resten.

### Innlesing

Fire strategier prøves, og den som finner flest utgifter vinner:

1. **Regneark.** Xlsx er en zip med XML i. Sentralkatalogen leses for hånd,
   `sharedStrings.xml` og første ark blåses opp med `DecompressionStream`, og
   cellene plukkes ut med `DOMParser`. Ingen biblioteker.
2. **Avgrenset tabell.** Gjetter skilletegn (`;` `\t` `,` `|`), finner
   overskriftsrada, ellers gjettes kolonnene ut fra innholdet.
3. **Linjer.** Én transaksjon per linje, limt fra nettbanken.
4. **Blokker.** Loddrett lim der dato, tekst og beløp står under hverandre.

Beløp tolkes både norsk og engelsk: `1 234,56`, `1.234,56`, `438.20`,
`(120,00)`, `120,00-`. Er de fleste beløpene negative, snus fortegnet, så
utgifter alltid er positive videre. Datoer kan være tekst eller regnearkets
dagnummer. Filer som ikke er UTF-8 leses om igjen som windows-1252, for norske
bankeksporter er ofte latin-1.

Fakturaer med flere kort har en rad per korteier
(`540185******6963 | Victoria Steen`). Den fanges opp, og kortet viser hvem
kjøpet gikk på. Det er et hint, ikke en fordeling: hvem som brukte kortet er
sjelden det samme som hvem utgiften er.

### Potter

En pott har et navn, en farge og en type:

| Type | Betyr |
| --- | --- |
| `person` | Egne utgifter. Er med i delingen av felles. |
| `felles` | Deles likt mellom alle person-potter. |
| `utenfor` | Holdes helt utenfor oppgjøret, f.eks. jobbutgifter som refunderes. |

De fire første pottene får hver sin sveiperetning, i rekkefølgen → ← ↑ ↓.
Resten får knapper under kortet. Er det færre enn fire potter, blir ↓ til
«usikker», som legger kortet bakerst i bunken.

En ny pott blir `utenfor` som standard. En pott som feilaktig er `person` tar
en andel av felles uten at det synes noe sted, mens en feil `utenfor` dukker
opp som sitt eget kort i oppgjøret.

### Oppgjøret

```
andel = egne utgifter + (felles / antall personer)
```

Den siste personen får eventuelle øre til overs, så summene går nøyaktig opp i
regninga. Potter merket `utenfor` er ikke med i `felles`-delingen og vises for
seg.

### Deling

«Kopier delingslenke» pakker fordelingen i `#deling=…` bakerst i adressen.
`#`-delen sendes aldri til noen server, så lenka kan gå i en melding uten at
tallene tar veien om noen andre.

Lenka inneholder **bare** fordelingen, ikke utgiftene: pottenavn, ett tegn per
utgift, og et kort avtrykk av regninga. Begge må ha lastet inn den samme fila.
Er avtrykket et annet, sier appen fra i stedet for å blande to regninger.

Når den andres lenke leses inn:

- **Enige** → beholdes.
- **Bare den andre har tatt den** → hentes inn.
- **Uenige** → legges først i køen, og kortet viser begges valg.

## Justeringer

| Hva | Hvor |
| --- | --- |
| Sveipeterskler, antall retninger | `KONFIG` øverst i `app.js` |
| Kategori-ikoner | `KATEGORIER` i `app.js` |
| Pottfarger | `PALETT` i `app.js` |
| Kolonnegjenkjenning | `HODE` i `les.js` |

## Taster

→ ← ↑ ↓ sveiper til de fire første pottene. `Z` angrer.

## Ikke gjort ennå

- Koble en transaksjon til kvitteringen, f.eks. Rema-historikk, så du ser hva
  som faktisk lå i handlekurven. Det er ofte der «er dette felles?» avgjøres.
- Flere enn to personer er støttet i regnestykket, men oppgjørsteksten er
  skrevet for to.
