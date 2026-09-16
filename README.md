# Espen Bjørk, porteføljeside

Personlig porteføljeside. Bevisst lavteknologisk: **ren HTML/CSS/JS, ingen
rammeverk og ingen byggesteg.** Det gjør den rask, lett å vedlikeholde, og
triviell å publisere, `git push`, så er den live.

🔗 **Live:** https://espenbjork.github.io/

---

## Slik gjør du endringer (den korte versjonen)

```bash
# 1. rediger filene (se struktur under)
# 2. se på resultatet lokalt
npm run dev            # → http://localhost:5173

# 3. publiser
git add -A
git commit -m "Oppdater X"
git push
```

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
├── kortsveip/              # liten app: del regninga ved å sveipe utgiftene
│   ├── index.html · styles.css
│   ├── les.js              # xlsx/csv/tekst → liste med utgifter
│   ├── app.js              # potter, sveiping, oppgjør, deling
│   └── favicon.svg
├── assets/
│   ├── css/styles.css       # designsystem + layout (alle tokens øverst)
│   ├── js/main.js           # reveal-on-scroll, småanimasjoner
│   ├── js/easter-eggs.js    # Konami-kode + konsoll-hilsen (config øverst)
│   ├── favicon.svg
│   └── og-image.svg         # delingsbilde (sosiale medier)
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
| Aksentfarge, skrifter, farger | `:root`-blokken øverst i `assets/css/styles.css` |
| Slå av/på bevegelse, notater, easter eggs | `data-motion` / `data-notes` / `data-eggs` på `<html>` i `index.html` |
| Prosjektkort (Arbeid) | `<section id="arbeid">` i `index.html` |
| Erfaring / CV | `<section id="erfaring">` i `index.html` |
| Konami-oppførsel | `CONFIG`-blokken øverst i `assets/js/easter-eggs.js` |
| Sveipeterskler, potter, kategori-ikoner (Kortsveip) | `KONFIG`, `PALETT` og `KATEGORIER` øverst i `kortsveip/app.js` |

## Kommandoer

```bash
npm run dev        # lokal forhåndsvisning på :5173
npm run validate   # sjekk at HTML-en er gyldig (html-validate)
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
- **Validering:** `ci.yml` kjører `html-validate` på PR-er og pusher. Den er
  rådgivende og blokkerer *ikke* deploy, så en liten advarsel stopper deg aldri
  fra å publisere, men du ser den.

### Underprosjekter

`kortsveip/` ligger i samme repo og publiseres av samme deploy, som
`espenbjork.github.io/kortsveip/`. Ingen ekstra oppsett: legg en mappe med en
`index.html` i rota, så er den live. Husk `?v=dev` på CSS- og JS-lenkene, og
legg fila til i `sed`-linja i `deploy.yml` hvis den skal cache-bustes.

### Eget domene

Vil du bruke f.eks. `espenbjork.no`:

1. Legg en fil `CNAME` i rota med domenet som eneste innhold.
2. Sett opp DNS hos domeneleverandøren (`CNAME` → `espenbjork.github.io`, eller
   A-records mot GitHubs Pages-IP-er).
3. Skru på «Enforce HTTPS» i repoets Pages-innstillinger.

---

Bygget for hånd, med AI som medbygger.
