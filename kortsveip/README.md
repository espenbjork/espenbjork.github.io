# Kortsveip

Del kredittkortregninga med samboeren ved å sveipe hver utgift til deg, henne
eller felles, som på Tinder. Ender med et oppgjør på hvem som skylder hvem.

🔗 https://espenbjork.github.io/kortsveip/

Ren HTML, CSS og JS. Ingen rammeverk, ingen byggesteg, ingen server. **All
kontodata blir liggende i nettleseren** (`localStorage`), og det finnes ikke
noe sted å sende den.

## Slik henger den sammen

`app.js` er delt i sju navngitte bolker:

| Bolk | Hva den gjør |
| --- | --- |
| 1. Konfig | Sveipeterskler, kategori-ikoner, lagernøkler |
| 2. Innlesing | Tall, datoer og de tre parsestrategiene |
| 3. Tilstand | `S`-objektet, lagring og skjermbytte |
| 4. Import | Forhåndsvisning, kolonnevalg, filtrering |
| 5. Sveiping | Kortstokken, pekerdraget, angre |
| 6. Oppgjør | Regnestykket, lista, CSV og kopiering |
| 7. Koblinger | Alle `addEventListener`, og oppstart |

### Innlesing

Kortsveip prøver tre strategier og beholder den som finner flest utgifter:

1. **Tabell**, CSV/TSV. Gjetter skilletegn (`;` `\t` `,` `|`), leser
   overskriftsrad hvis den finnes, ellers gjettes kolonnene ut fra innholdet.
   Takler både «Beløp» og DNBs «Ut fra konto»/«Inn på konto».
2. **Linjer**, én transaksjon per linje limt fra nettbanken.
3. **Blokker**, loddrett lim der dato, tekst og beløp står på hver sin linje.

Beløp tolkes både norsk og engelsk: `1 234,56`, `1.234,56`, `438.20`,
`(120,00)`, `120,00-`, `kr 1 234`. Er de fleste beløpene negative, snus
fortegnet, så utgifter alltid er positive tall videre i appen. Filer som ikke
er UTF-8 leses om igjen som windows-1252, for norske bankeksporter er ofte
latin-1.

### Hvem skylder hvem

```
andel  = egne utgifter + halvparten av felles
oppgjør = andelen til den som ikke la ut
```

På felles kort deles differansen mellom andelene på to i stedet, så begge
ender likt.

### Minnet

Butikknavn kokes ned til en kjedenøkkel («REMA 1000 TORSHOV» → `rema`), som
brukes to steder: til å tilby «de 4 andre fra REMA også?» midt i sveipingen,
og til å huske valget til neste regning. Minnet ligger i sin egen
`localStorage`-nøkkel og overlever «Ny regning».

## Taster

| Tast | Handling |
| --- | --- |
| → | til person 1 |
| ← | til person 2 |
| ↑ | felles |
| ↓ | hopp over, kortet legges bakerst |
| `Z` | angre |
