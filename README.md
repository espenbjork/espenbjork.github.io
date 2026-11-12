# Espen Bjørk, porteføljeside

Personlig porteføljeside. Bevisst lavteknologisk: **ren HTML/CSS/JS, ingen
rammeverk og ingen byggesteg.** Det gjør den rask, lett å vedlikeholde, og
triviell å publisere, `git push`, så er den live.

🔗 **Live:** https://espenbjork.no/

---

## Slik gjør du endringer (den korte versjonen)

```bash
# 1. rediger filene (se struktur under)
# 2. se på resultatet lokalt
npm run dev            # → http://localhost:5173

# 3. publiser
git add index.html assets/
git commit -m "Oppdater X"
git push
```

Legg til filer ved navn. Samlekommandoene tar med alt som tilfeldigvis ligger
i mappa.

Push til `main` trigger automatisk deploy via GitHub Actions. Siden er som
regel oppdatert i løpet av ~1 minutt. Du trenger aldri å bygge eller laste opp
filer manuelt.

> Har du ikke Node? Da kan du forhåndsvise med Python i stedet:
> `python3 -m http.server 5173`

---

## Prosjektstruktur

```
.
├── index.html              # alt innholdet (semantisk markup)
├── kortsveip/              # videresending til felleskortet.no, holder gamle lenker i live
│   └── index.html
├── assets/
│   ├── css/styles.css       # designsystem + layout (alle tokens øverst)
│   ├── js/bakgrunn.js       # disen bak arket (WebGL, faller tilbake til CSS)
│   ├── js/main.js           # streker som tegnes ved synlighet, karusell
│   ├── js/bindersen.js      # Bindersen: blikk, blunk, bryn, lening og emotene (window.bindersen.play)
│   ├── js/clippy.js         # chatten bak Bindersen, og window.clippyChat (ask, open, api)
│   ├── js/mas.js            # Bindersen den masete: følgefiguren som spør når du har vært lenge på siden
│   ├── js/easter-eggs.js    # Konami-kode + konsoll-hilsen (config øverst)
│   ├── fonts/               # Source Serif 4 (woff2) og lisensen
│   ├── favicon.svg
│   └── og-image.png         # delingsbilde (sosiale medier)
├── .github/workflows/
│   ├── deploy.yml           # bygger ingenting, publiserer til GitHub Pages
│   └── ci.yml               # validerer HTML på hver PR/push (rådgivende)
├── .nojekyll                # be Pages servere filene som de er
├── sitemap.xml · robots.txt
└── package.json             # praktiske scripts (krever ikke install)
```

## Vanlige justeringer

| Hva | Hvor |
| --- | --- |
| Aksentfarge, skrift, farger | de tre reglene øverst i `assets/css/styles.css`, så `:root`-blokken |
| Hvor sterk disen i bakgrunnen er | `--haze-wash` og `--haze-warm` i `:root`. Mål kontrasten før du øker dem |
| Slå av/på bevegelse, notater, easter eggs | `data-motion` / `data-notes` / `data-eggs` på `<html>` i `index.html` |
| Prosjektkort (Arbeid) | `<section id="arbeid">` i `index.html` |
| Erfaring / CV | `<section id="erfaring">` i `index.html` |
| Tidene i maset (45 s, 90 s, 20 s) | konstantene øverst i `assets/js/mas.js` |
| Konami-oppførsel | `CONFIG`-blokken øverst i `assets/js/easter-eggs.js` |
| Felleskortet (appen) | eget repo: [espenbjork/felleskortet](https://github.com/espenbjork/felleskortet) |

## Bindersen den masete

Har du vært lenge på siden, dukker en ekstra Bindersen opp ved det du leser og
stiller et spørsmål. Spørsmålet skriver modellen: `mas.js` spør Worker-en
(`mode: "mas"`) med seksjonen og prosjektkortet som ligger midt i vinduet, og
ingenting annet om den besøkende. Det finnes ingen ferdige replikker i siden.
Tonen styres av `mas.md` i clippy-repoet.

Trappa, hvert trinn en gang per besøk. Tid telles bare mens fanen er synlig og
toppen av siden er rullet ut av bildet:

1. 45 s: bare bryn og øyne stikker opp over nedre kant.
2. 90 s: hun tegnes i margen (smal skjerm: nedre hjørne) og spør, med to svar.
3. 20 s uten svar: hun banker, viskes ut, tegnes nærmere pekeren og spør på nytt.
   Det skjer to ganger.
4. Tredje spørsmål uten svar: hun sovner i nedre hjørne og spør ikke mer.

Uten mus går trappa fra 2 til 4. Svarer du, går svaret til chatten
(`clippyChat.ask`) og samtalen ligger i den vanlige chathistorikken. Krysset
sender henne bort for resten av besøket (`sessionStorage`). Står en annen
Bindersen i bildet, eller er chatten i toppen åpen, er hun borte. Med redusert
bevegelse eller `data-motion="off"` gjør `mas.js` ingenting.

For å se hele trappa uten å vente: legg `?mas=rask` på adressen. Tidene deles på
femten, så det tar et halvt minutt.

## Kommandoer

```bash
npm run dev        # lokal forhåndsvisning på :5173
npm run validate   # sjekk begge HTML-sider og JavaScript-syntaks
npm test           # kjør Kortsveip-testene
npm run format     # formater alt med Prettier
```

> Merk: filene her er håndformatert, og `npm run format` vil skrive om dem.
> Kjør den bare hvis du faktisk vil ha Prettier-stilen.

Alle scriptene kjører via `npx` og laster verktøyet ved behov, ingen
`npm install` nødvendig.

---

## Hvordan publiseringen fungerer

- **Hosting:** GitHub Pages, bygget fra GitHub Actions (ikke fra en branch).
- **Trigger:** hver push til `main` (`.github/workflows/deploy.yml`).
- **Validering:** `ci.yml` validerer begge HTML-sidene, sjekker
  JavaScript-syntaks på PR-er og pusher. Den er
  rådgivende og blokkerer *ikke* deploy, så en liten advarsel stopper deg aldri
  fra å publisere, men du ser den.

### Underprosjekter

Felleskortet lå en periode som en kopi under `kortsveip/` her. Appen har sitt
eget repo, [espenbjork/felleskortet](https://github.com/espenbjork/felleskortet),
som publiserer `felleskortet.no`, og to kopier av samme app drev fra hverandre
helt til den utlagte versjonen ikke lenger leste fakturaer den andre kopien
leste fint. Nå finnes appen ett sted. `kortsveip/index.html` står igjen som en
videresending, slik at gamle lenker og delte oppgjør fortsatt virker; den tar
`#`-delen med seg videre.

Vil du legge et nytt underprosjekt her, holder det å legge en mappe med en
`index.html` i rota, så er den live. Husk `?v=dev` på CSS- og JS-lenkene, og
legg fila til i `sed`-linja i `deploy.yml` hvis den skal cache-bustes. Blir det
noe mer enn en liten demo, gi det heller sitt eget repo med en gang.

### Eget domene

Vil du bruke f.eks. `espenbjork.no`:

1. Legg en fil `CNAME` i rota med domenet som eneste innhold.
2. Sett opp DNS hos domeneleverandøren (`CNAME` → `espenbjork.github.io`, eller
   A-records mot GitHubs Pages-IP-er).
3. Skru på «Enforce HTTPS» i repoets Pages-innstillinger.

---

Bygget for hånd, med AI som medbygger.
