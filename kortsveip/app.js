/* ============================================================
   KORTSVEIP
   Sveip kredittkortregninga til meg, deg eller felles.

   Ingen backend, ingen rammeverk, ingen byggesteg. All data blir
   liggende i localStorage på din egen maskin.

   Filen er delt i:
     1. KONFIG og småverktøy
     2. Innlesing  (CSV, limt inn tekst, tall- og datotolkning)
     3. Tilstand   (state + lagring)
     4. Sveiping   (kortstokken og pekerhåndtering)
     5. Oppgjør    (regnestykket, lista, eksport)
   ============================================================ */
'use strict';

/* ─── 1. KONFIG ─────────────────────────────────────────── */

const KONFIG = {
  dragTerskel: 0.32,   // andel av kortbredden du må dra sidelengs
  terskelOpp: 88,      // px opp  → felles
  terskelNed: 104,     // px ned  → hopp over
  synligeKort: 3,      // hvor mange kort som tegnes i stokken
  toastMs: 7000,       // hvor lenge «gjør det samme med resten» henger
  lagerNokkel: 'kortsveip.tilstand.v1',
  minneNokkel: 'kortsveip.minne.v1',
};

// Bøttefargene. Sveiperetningene bruker de samme nøklene.
const BOTTE_FARGE = {
  a: 'var(--a)', b: 'var(--b)', shared: 'var(--shared)', skip: 'var(--skip)',
};

// Kategori-ikon gjettes fra butikknavnet. Legg gjerne til flere ord.
const KATEGORIER = [
  { ikon: '🛒', ord: ['rema', 'kiwi', 'coop', 'meny', 'extra', 'bunnpris', 'spar', 'joker', 'matkroken', 'oda', 'obs', 'europris', 'normal', 'nille', 'matbutikk'] },
  { ikon: '🍔', ord: ['foodora', 'wolt', 'mcdonald', 'burger', 'pizza', 'sushi', 'kebab', 'restaurant', 'bistro', 'pub', 'deli', 'kantine', 'kro'] },
  { ikon: '☕', ord: ['kaffe', 'espresso', 'coffee', 'starbucks', 'baker', 'bakeri', 'samson', 'godt brod', 'united bakeries'] },
  { ikon: '⛽', ord: ['circle k', 'shell', 'esso', 'uno-x', 'best stasjon', 'drivstoff', 'bensin', 'lading', 'recharge', 'mer '] },
  { ikon: '🚆', ord: ['ruter', 'flytoget', 'entur', 'vy ', 'atb', 'skyss', 'kolumbus', 'brakar', 'bysykkel', 'togbillett'] },
  { ikon: '🚕', ord: ['taxi', 'uber', 'bolt', 'voi', 'tier', 'ryde', 'drosje'] },
  { ikon: '✈️', ord: ['norwegian', 'wideroe', 'widerøe', 'flyr', 'airbnb', 'booking.com', 'hotel', 'hotell', 'finnair', 'klm', 'lufthansa', 'scandinavian airlines'] },
  { ikon: '💊', ord: ['apotek', 'vitusapotek', 'boots', 'farmasi', 'lege', 'tannlege', 'sykehus', 'fysio'] },
  { ikon: '👕', ord: ['zalando', 'cubus', 'dressmann', 'bikbok', 'weekday', 'zara', 'nike', 'adidas', 'xxl', 'sport', 'volt', 'carlings'] },
  { ikon: '🏠', ord: ['ikea', 'jernia', 'clas ohlson', 'biltema', 'maxbo', 'byggmakker', 'monter', 'princess', 'kid ', 'jysk', 'bohus'] },
  { ikon: '📺', ord: ['netflix', 'hbo', 'viaplay', 'disney', 'spotify', 'tidal', 'youtube', 'apple.com', 'icloud', 'google', 'microsoft', 'adobe', 'strim', 'storytel'] },
  { ikon: '🔌', ord: ['telenor', 'telia', 'talkmore', 'onecall', 'chilimobil', 'fjordkraft', 'tibber', 'hafslund', 'strom', 'strøm', 'elvia'] },
  { ikon: '🐶', ord: ['musti', 'veterin', 'arken zoo', 'dyrebutikk', 'buddy'] },
  { ikon: '🍷', ord: ['vinmonopolet', 'polet'] },
  { ikon: '🎁', ord: ['blomster', 'interflora', 'gavekort', 'presang'] },
  { ikon: '🏋️', ord: ['sats', 'evo fitness', 'fresh fitness', 'treningssenter', 'yoga', 'crossfit'] },
  { ikon: '🎬', ord: ['kino', 'nordisk film', 'odeon', 'teater', 'konsert', 'ticketmaster', 'billettservice'] },
];

const MAANEDER = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember'];

/* ─── Småverktøy ────────────────────────────────────────── */

const $ = (sel, rot = document) => rot.querySelector(sel);
const $$ = (sel, rot = document) => Array.from(rot.querySelectorAll(sel));

const nfTo = new Intl.NumberFormat('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfHel = new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 });

const kr = (n) => `${nfTo.format(n)} kr`;
const krHel = (n) => `${nfHel.format(Math.round(n))} kr`;

/** Runder til øre, så 0.1+0.2 ikke lekker ut i oppgjøret. */
const ore = (n) => Math.round(n * 100) / 100;

function visDato(iso, langt = false) {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('nb-NO', langt
    ? { day: 'numeric', month: 'long', year: 'numeric' }
    : { day: 'numeric', month: 'short' });
}

function idFra(i) {
  return `u${i}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Matcher et nøkkelord mot tekst. Korte ord krever ordgrense. */
function harOrd(tekst, ord) {
  if (ord.length > 4) return tekst.includes(ord);
  const i = tekst.indexOf(ord);
  return i === 0 || (i > 0 && /[^a-zæøå0-9]/.test(tekst[i - 1]));
}

function gjettIkon(tekst) {
  const t = tekst.toLowerCase();
  for (const kat of KATEGORIER) {
    if (kat.ord.some((o) => harOrd(t, o))) return kat.ikon;
  }
  return '💳';
}

/**
 * Kjedenøkkel: «REMA 1000 GRÜNERLØKKA 12.03» og «REMA 1000 MAJORSTUEN»
 * skal havne i samme bås, så vi kan tilby «gjør det samme med resten»
 * og huske valget til neste regning.
 */
function kjedeNokkel(tekst) {
  const reint = String(tekst)
    .toLowerCase()
    .replace(/\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?/g, ' ')  // datoer
    .replace(/\*+\s*\d+/g, ' ')                            // *1234
    .replace(/\b\d+\b/g, ' ')                              // løse tall
    .replace(/\b(nok|usd|eur|sek|dkk|gbp|kurs|kjop|kjøp|varekjop|varekjøp|kortkjop|kortkjøp|betaling|as|asa|ab|oyj|ltd|inc)\b/g, ' ')
    .replace(/[^a-zæøåäöüé ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!reint) return String(tekst).toLowerCase().trim().slice(0, 12);
  const ord = reint.split(' ');
  return ord[0].length >= 4 ? ord[0] : ord.slice(0, 2).join(' ');
}

/** Kort kjedenavn til varsler: «REMA 1000 TORSHOV» → «REMA». */
function kjedeNavn(tekst) {
  const ord = String(tekst).trim().split(/\s+/).filter((o) => /[a-zæøåA-ZÆØÅ]/.test(o));
  if (!ord.length) return String(tekst).trim().slice(0, 22);
  const antall = ord[0].length >= 4 ? 1 : 2;
  // Ta med et etterfølgende kortord, så «CIRCLE K» ikke blir til «CIRCLE».
  const hale = ord[antall] && ord[antall].length <= 2 ? 1 : 0;
  return ord.slice(0, antall + hale).join(' ').slice(0, 22);
}

/** Lesbart butikknavn til kortet: rydder bort referanser og roper ikke. */
function pentNavn(tekst) {
  let t = String(tekst)
    .replace(/\*+\s*\d+/g, ' ')                       // *1234
    .replace(/\b[A-Z0-9]*\d[A-Z0-9]{5,}\b/g, ' ')      // referansekoder
    .replace(/\b\d{6,}\b/g, ' ')                       // lange tallrekker
    .replace(/\b(nok|kurs|kortkj(ø|o)p|varekj(ø|o)p)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) t = String(tekst).trim();
  // ROPENDE NAVN blir til Ropende Navn. Blandet skrift får stå som det er.
  if (t === t.toUpperCase()) {
    t = t.replace(/[\p{L}][\p{L}'’-]*/gu, (o) => o[0] + o.slice(1).toLowerCase());
  }
  return t.length > 42 ? `${t.slice(0, 41).trim()}…` : t;
}

/* ─── 2. INNLESING ──────────────────────────────────────── */

/**
 * Tolker et beløp slik norske (og engelske) bankeksporter skriver dem:
 *   «1 234,56»  «1.234,56»  «-438,20»  «438.20»  «kr 1 234»  «(120,00)»  «120,00-»
 * Returnerer null hvis strengen ikke er et tall.
 */
function tilTall(verdi) {
  if (typeof verdi === 'number') return Number.isFinite(verdi) ? verdi : null;
  if (verdi == null) return null;

  let t = String(verdi).replace(/[   ]/g, ' ').trim();
  if (!t) return null;

  let negativ = false;
  if (/^\(.*\)$/.test(t)) { negativ = true; t = t.slice(1, -1).trim(); }
  t = t.replace(/\b(kr|nok)\b/gi, '').replace(/−/g, '-').trim();
  if (/^[-–]/.test(t)) { negativ = true; t = t.replace(/^[-–]\s*/, ''); }
  if (/[-–]$/.test(t)) { negativ = true; t = t.replace(/\s*[-–]$/, ''); }
  if (!/^[\d\s.,']*\d[\d\s.,']*$/.test(t)) return null;

  t = t.replace(/[\s']/g, '');

  const sisteKomma = t.lastIndexOf(',');
  const sistePunkt = t.lastIndexOf('.');
  let desimal = -1;
  if (sisteKomma >= 0 && sistePunkt >= 0) {
    desimal = Math.max(sisteKomma, sistePunkt);
  } else if (sisteKomma >= 0 || sistePunkt >= 0) {
    const pos = Math.max(sisteKomma, sistePunkt);
    const bak = t.length - pos - 1;
    const antall = (t.match(/[.,]/g) || []).length;
    // Ett skilletegn med 1–2 sifre bak er desimal, alt annet er tusenskille.
    if (antall === 1 && bak >= 1 && bak <= 2) desimal = pos;
  }

  let heltall; let brok = '';
  if (desimal >= 0) {
    heltall = t.slice(0, desimal).replace(/[.,]/g, '');
    brok = t.slice(desimal + 1).replace(/[.,]/g, '');
  } else {
    heltall = t.replace(/[.,]/g, '');
  }
  if (!heltall && !brok) return null;

  const tall = Number(`${heltall || '0'}.${brok || '0'}`);
  if (!Number.isFinite(tall)) return null;
  return negativ ? -tall : tall;
}

/** Tolker dato. Returnerer ISO (yyyy-mm-dd) eller null. */
function tilDato(verdi) {
  if (verdi == null) return null;
  const t = String(verdi).trim();
  if (!t) return null;

  const lag = (aa, mm, dd) => {
    const y = Number(aa); const m = Number(mm); const d = Number(dd);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
    if (y < 1990 || y > 2100) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  let m;
  if ((m = t.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return lag(m[1], m[2], m[3]);
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/))) {
    const aa = m[3].length === 2 ? String(2000 + Number(m[3])) : m[3];
    return lag(aa, m[2], m[1]);
  }
  // «12.03» uten år → antar inneværende år
  if ((m = t.match(/^(\d{1,2})[-/.](\d{1,2})\.?$/))) {
    return lag(String(new Date().getFullYear()), m[2], m[1]);
  }
  // «12. mars 2025» / «12 mar»
  if ((m = t.match(/^(\d{1,2})\.?\s*([a-zæøå]{3,})\.?\s*(\d{4})?$/i))) {
    const i = MAANEDER.findIndex((n) => n.startsWith(m[2].toLowerCase().slice(0, 3)));
    if (i >= 0) return lag(m[3] || String(new Date().getFullYear()), i + 1, m[1]);
  }
  return null;
}

const erDato = (s) => tilDato(s) !== null;
const erTall = (s) => tilTall(s) !== null;

/** Deler opp en avgrenset fil. Takler sitater og linjeskift inni felt. */
function splittRader(tekst, skille) {
  const rader = []; let rad = []; let felt = ''; let iSitat = false;
  for (let i = 0; i < tekst.length; i += 1) {
    const c = tekst[i];
    if (iSitat) {
      if (c === '"') {
        if (tekst[i + 1] === '"') { felt += '"'; i += 1; } else iSitat = false;
      } else felt += c;
    } else if (c === '"') iSitat = true;
    else if (c === skille) { rad.push(felt); felt = ''; }
    else if (c === '\n') { rad.push(felt); rader.push(rad); rad = []; felt = ''; }
    else if (c !== '\r') felt += c;
  }
  rad.push(felt); rader.push(rad);
  return rader
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ''));
}

function gjettSkilletegn(tekst) {
  const linjer = tekst.split('\n').filter((l) => l.trim()).slice(0, 25);
  if (!linjer.length) return null;
  let best = null; let bestPoeng = 0;
  for (const d of [';', '\t', ',', '|']) {
    const tellinger = linjer.map((l) => (l.split(d).length - 1)).sort((x, y) => x - y);
    const median = tellinger[Math.floor(tellinger.length / 2)];
    if (median >= 1 && median > bestPoeng) { bestPoeng = median; best = d; }
  }
  return best;
}

const HODE = {
  dato: /^(dato|date|bokf|transaksjonsdato|kjøpsdato|kjopsdato|betalingsdato|rentedato|valuteringsdato|posted|trans.?date)/i,
  tekst: /(tekst|beskriv|forklar|melding|merchant|butikk|brukssted|sted|detalj|narrative|description|title|type|mottaker|kortholder.?tekst)/i,
  belop: /^(bel(ø|o)p|amount|sum|verdi|value|transaksjonsbel)/i,
  ut: /(ut fra konto|uttak|debet|debit|belastet|ut\b)/i,
  inn: /(inn p(å|a) konto|innskudd|kredit|credit|godskrevet|inn\b)/i,
  hopp: /(valuta|currency|kurs|rate|saldo|balance|kontonr|kontonummer|referanse|arkiv|status|kategori|melding til)/i,
};

/** Finner hvilke kolonner som er dato/tekst/beløp, med eller uten overskriftsrad. */
function finnKolonner(rader) {
  const bredde = Math.max(...rader.map((r) => r.length));
  const forste = rader[0] || [];

  const erHode = forste.length >= 2
    && forste.some((c) => HODE.dato.test(c))
    && forste.some((c) => HODE.belop.test(c) || HODE.ut.test(c) || HODE.inn.test(c))
    && !forste.some((c) => erTall(c) && String(c).trim() !== '');

  if (erHode) {
    const finn = (re, unntak) => forste.findIndex((c) => re.test(c) && !(unntak && unntak.test(c)));
    const kol = {
      dato: finn(HODE.dato),
      tekst: finn(HODE.tekst),
      belop: finn(HODE.belop, HODE.hopp),
      ut: finn(HODE.ut, HODE.hopp),
      inn: finn(HODE.inn, HODE.hopp),
    };
    if (kol.dato >= 0 && (kol.belop >= 0 || kol.ut >= 0)) {
      if (kol.tekst < 0) {
        // Ingen åpenbar tekstkolonne, ta den med mest bokstaver.
        kol.tekst = beste(rader.slice(1), bredde, (v) => (/[a-zæøå]{3}/i.test(v) ? v.length : 0),
          [kol.dato, kol.belop, kol.ut, kol.inn]);
      }
      return { ...kol, hode: forste, datarader: rader.slice(1) };
    }
  }

  // Ingen brukbar overskrift: gjett ut fra innholdet.
  const datarader = erHode ? rader.slice(1) : rader;
  const dato = beste(datarader, bredde, (v) => (erDato(v) ? 1 : 0));
  const belop = beste(datarader, bredde, (v) => {
    const n = tilTall(v);
    if (n === null || erDato(v)) return 0;
    return /[.,]\d{2}\s*$/.test(v) ? 2 : 1;   // desimaler lukter beløp
  }, [dato]);
  const tekst = beste(datarader, bredde, (v) => (/[a-zæøå]{3}/i.test(v) ? Math.min(v.length, 40) : 0), [dato, belop]);
  return { dato, tekst, belop, ut: -1, inn: -1, hode: null, datarader };
}

/** Kolonnen som gir høyest snittpoeng, utenom de i «unntatt». */
function beste(rader, bredde, poeng, unntatt = []) {
  let best = -1; let bestSum = 0;
  for (let k = 0; k < bredde; k += 1) {
    if (unntatt.includes(k)) continue;
    let sum = 0;
    for (const r of rader) sum += poeng(r[k] == null ? '' : String(r[k]));
    if (sum > bestSum) { bestSum = sum; best = k; }
  }
  return bestSum > 0 ? best : -1;
}

/** Strategi 1: avgrenset fil (CSV/TSV). */
function lesTabell(tekst) {
  const skille = gjettSkilletegn(tekst);
  if (!skille) return null;
  const rader = splittRader(tekst, skille);
  if (rader.length < 2) return null;

  const kol = finnKolonner(rader);
  if (kol.belop < 0 && kol.ut < 0) return null;

  const poster = kol.datarader.map((r) => byggPost(r, kol)).filter(Boolean);
  if (!poster.length) return null;
  return { poster, kol, skille, kilde: 'tabell' };
}

function byggPost(rad, kol) {
  const hent = (i) => (i >= 0 && rad[i] != null ? String(rad[i]).trim() : '');

  let belop = null;
  if (kol.belop >= 0) belop = tilTall(hent(kol.belop));
  if (belop === null && kol.ut >= 0) {
    const ut = tilTall(hent(kol.ut));
    const inn = kol.inn >= 0 ? tilTall(hent(kol.inn)) : null;
    if (ut !== null && ut !== 0) belop = -Math.abs(ut);
    else if (inn !== null && inn !== 0) belop = Math.abs(inn);
  }
  if (belop === null || belop === 0) return null;

  const tekst = hent(kol.tekst) || rad.filter((c) => /[a-zæøå]{3}/i.test(c)).join(' ').trim();
  if (!tekst) return null;

  return { dato: tilDato(hent(kol.dato)), tekst: tekst.replace(/\s+/g, ' '), belop };
}

/** Strategi 2: én transaksjon per linje, limt inn fra nettbank eller PDF. */
function lesLinjer(tekst) {
  const poster = [];
  for (const rå of tekst.split('\n')) {
    const linje = rå.replace(/[  ]/g, ' ').trim();
    if (!linje || linje.length < 4) continue;

    // Beløpet er som regel det siste tallet på linja. Det må starte på egen
    // «ordgrense», ellers napper vi siste siffer i en referanse:
    // «SPOTIFY P1A2B3C4 139,00» er 139,00, ikke 4 139,00.
    const m = linje.match(/^(.*?)(?:^|\s)(-?\s?(?:kr\s*)?(?:\d{1,3}(?:[ .']\d{3})+|\d+)[.,]\d{2}\s*(?:kr|NOK)?-?)\s*$/i);
    if (!m) continue;
    const belop = tilTall(m[2]);
    if (belop === null || belop === 0) continue;

    let rest = m[1].trim();
    let dato = null;
    const dm = rest.match(/^(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?|\d{4}-\d{2}-\d{2})\s+/);
    if (dm) { dato = tilDato(dm[1]); rest = rest.slice(dm[0].length).trim(); }
    // En del utskrifter har både kjøps- og bokføringsdato først.
    const dm2 = rest.match(/^(\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?)\s+/);
    if (dm2 && tilDato(dm2[1])) rest = rest.slice(dm2[0].length).trim();

    rest = rest.replace(/[;\t|]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!/[a-zæøå]{2}/i.test(rest)) continue;
    poster.push({ dato, tekst: rest, belop });
  }
  return poster.length ? { poster, kol: null, kilde: 'linjer' } : null;
}

/** Strategi 3: loddrett lim, der dato, tekst og beløp står på hver sin linje. */
function lesBlokker(tekst) {
  const linjer = tekst.split('\n').map((l) => l.replace(/[  ]/g, ' ').trim()).filter(Boolean);
  const poster = [];
  let dato = null; let ord = [];

  const flush = (belop) => {
    const t = ord.join(' ').replace(/\s+/g, ' ').trim();
    if (t && belop !== null && belop !== 0 && /[a-zæøå]{2}/i.test(t)) poster.push({ dato, tekst: t, belop });
    ord = [];
  };

  for (const linje of linjer) {
    const somDato = /^\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\.?$|^\d{4}-\d{2}-\d{2}$/.test(linje) ? tilDato(linje) : null;
    const somTall = /^-?\s?(?:kr\s*)?\d[\d\s.']*(?:[.,]\d{1,2})?\s*(?:kr|NOK)?-?$/i.test(linje) ? tilTall(linje) : null;

    if (somDato) { if (ord.length) flush(null); dato = somDato; }
    else if (somTall !== null) flush(somTall);
    else ord.push(linje);
  }
  return poster.length ? { poster, kol: null, kilde: 'blokk' } : null;
}

const INNBETALING = /(innbetal|betaling\s+(mottatt|registrert)|takk for betaling|payment\s+(received|thank)|direkte\s?remittering|autogiro|avtalegiro|overf(ø|o)rt\s+fra|fra\s+konto|saldooverf)/i;

/**
 * Leser rå tekst og gir tilbake ferdige utgiftsposter.
 * Prøver alle tre strategiene og beholder den som finner flest poster.
 */
function lesInn(rå) {
  const tekst = String(rå || '').replace(/^﻿/, '');
  if (!tekst.trim()) return { feil: 'Ingenting å lese. Lim inn eller velg en fil.' };

  const forsok = [lesTabell(tekst), lesLinjer(tekst), lesBlokker(tekst)].filter(Boolean);
  if (!forsok.length) {
    return { feil: 'Fant ingen beløp her. Sjekk at hver utgift har et beløp, f.eks. «438,20».' };
  }
  forsok.sort((x, y) => y.poster.length - x.poster.length);
  const valgt = forsok[0];

  // Fortegn: er de fleste beløpene negative, er utgifter negative. Snu, så
  // utgifter alltid er positive tall videre i appen.
  const nonzero = valgt.poster.filter((p) => p.belop !== 0);
  const negative = nonzero.filter((p) => p.belop < 0).length;
  const snu = negative > nonzero.length * 0.6 ? -1 : 1;

  const poster = valgt.poster.map((p, i) => {
    const belop = ore(p.belop * snu);
    return {
      id: idFra(i),
      dato: p.dato,
      tekst: p.tekst.slice(0, 120),
      belop,
      bucket: null,
      // Innbetalinger på kortet er ikke utgifter og filtreres bort som standard.
      innbetaling: INNBETALING.test(p.tekst) || (belop < 0 && INNBETALING.test(p.tekst)),
    };
  });

  return { poster, kol: valgt.kol, kilde: valgt.kilde, snudd: snu === -1 };
}

/* ─── Eksempeldata ──────────────────────────────────────── */
// Kjøres gjennom den samme parseren som ekte filer. Fungerer dermed
// også som en liten røyktest av innlesingen.
const DEMO = `Dato;Forklaring;Beløp;Valuta
03.03.2025;REMA 1000 GRUNERLOKKA OSLO;-438,20;NOK
03.03.2025;RUTER APP OSLO;-465,00;NOK
04.03.2025;FOODORA NORGE AS;-389,00;NOK
05.03.2025;VINMONOPOLET TORSHOV;-612,50;NOK
06.03.2025;H&M HENNES & MAURITZ OSLO;-799,00;NOK
07.03.2025;NETFLIX.COM;-199,00;NOK
08.03.2025;KIWI 812 SANDAKER;-287,45;NOK
09.03.2025;SATS ELIXIA NYDALEN;-549,00;NOK
10.03.2025;CIRCLE K STOROKKRYSSET;-742,10;NOK
11.03.2025;APOTEK 1 STORO;-268,90;NOK
12.03.2025;IKEA FURUSET;-2 349,00;NOK
13.03.2025;REMA 1000 TORSHOV;-521,75;NOK
14.03.2025;OSLO KINO RINGEN;-320,00;NOK
15.03.2025;SPOTIFY P1A2B3C4;-139,00;NOK
16.03.2025;MUSTI OG MIRRI STORO;-478,00;NOK
17.03.2025;WIDEROE.NO BODO;-1 890,00;NOK
18.03.2025;KAFFEBRENNERIET GRUNERLOKKA;-96,00;NOK
19.03.2025;ZALANDO SE;-1 249,00;NOK
20.03.2025;REMA 1000 GRUNERLOKKA OSLO;-312,30;NOK
21.03.2025;TELIA NORGE AS;-598,00;NOK
22.03.2025;XXL SPORT & VILLMARK STORO;-1 099,00;NOK
23.03.2025;ZALANDO SE RETUR;249,00;NOK
25.03.2025;INNBETALING TAKK;12 500,00;NOK`;

/* ─── 3. TILSTAND ───────────────────────────────────────── */

const S = {
  navn: { a: 'Espen', b: 'Victoria' },
  betaler: 'a',
  poster: [],
  historikk: [],
  skjerm: 'start',
  filter: 'alle',
};

let minne = {};            // kjedenøkkel → bøtte, husket på tvers av regninger
let rååImport = '';        // siste rå tekst, for ny tolkning ved kolonnebytte
let importert = null;      // resultat fra lesInn(), før brukeren trykker start

function lagre() {
  try {
    localStorage.setItem(KONFIG.lagerNokkel, JSON.stringify({
      navn: S.navn, betaler: S.betaler, poster: S.poster, skjerm: S.skjerm,
    }));
  } catch { /* privat modus eller full disk, appen virker uansett */ }
}

function lagreMinne() {
  try { localStorage.setItem(KONFIG.minneNokkel, JSON.stringify(minne)); } catch { /* ignorer */ }
}

function hentLagret() {
  try {
    minne = JSON.parse(localStorage.getItem(KONFIG.minneNokkel) || '{}') || {};
    const d = JSON.parse(localStorage.getItem(KONFIG.lagerNokkel) || 'null');
    if (!d || !Array.isArray(d.poster) || !d.poster.length) return false;
    S.navn = d.navn || S.navn;
    S.betaler = d.betaler || 'a';
    S.poster = d.poster;
    S.skjerm = d.skjerm === 'oppgjor' ? 'oppgjor' : 'sveip';
    return true;
  } catch { return false; }
}

const finn = (id) => S.poster.find((p) => p.id === id);
const koen = () => S.poster.filter((p) => p.bucket == null);
const botteNavn = (b) => (b === 'a' ? S.navn.a : b === 'b' ? S.navn.b : b === 'shared' ? 'Felles' : 'Ikke satt');

function huskValg(post, botte) {
  minne[kjedeNokkel(post.tekst)] = botte;
  lagreMinne();
}
const minneFor = (post) => minne[kjedeNokkel(post.tekst)] || null;

/* ─── Skjermbytte ───────────────────────────────────────── */

const skjermer = {
  start: $('#skjerm-start'),
  sveip: $('#skjerm-sveip'),
  oppgjor: $('#skjerm-oppgjor'),
};
const stegNavn = { start: 'start', sveip: 'swipe', oppgjor: 'sum' };

function visSkjerm(navn) {
  S.skjerm = navn;
  for (const [k, el] of Object.entries(skjermer)) el.hidden = k !== navn;
  const rekke = ['start', 'sveip', 'oppgjor'];
  const naa = rekke.indexOf(navn);
  $$('.steps__item').forEach((el) => {
    const i = rekke.indexOf(Object.keys(stegNavn).find((k) => stegNavn[k] === el.dataset.step));
    el.toggleAttribute('aria-current', i === naa);
    if (i === naa) el.setAttribute('aria-current', 'step');
    el.toggleAttribute('data-done', i < naa);
  });
  $('#knapp-nullstill').hidden = navn === 'start' && !S.poster.length;
  if (navn === 'sveip') tegnStokk();
  if (navn === 'oppgjor') tegnOppgjor();
  window.scrollTo(0, 0);
  lagre();
}

function oppdaterNavn() {
  S.navn.a = ($('#navn-a').value || 'Person 1').trim().slice(0, 18) || 'Person 1';
  S.navn.b = ($('#navn-b').value || 'Person 2').trim().slice(0, 18) || 'Person 2';
  $$('[data-rolle="navn-a"]').forEach((el) => { el.textContent = S.navn.a; });
  $$('[data-rolle="navn-b"]').forEach((el) => { el.textContent = S.navn.b; });
  lagre();
}

function melding(tekst, type = '') {
  const el = $('#melding');
  el.textContent = tekst;
  el.dataset.type = type;
}

/* ─── 4. IMPORT-SKJERMEN ────────────────────────────────── */

function tolkOgVis(rå, overstyr) {
  rååImport = rå;
  const res = overstyr ? tolkMedKolonner(rå, overstyr) : lesInn(rå);
  if (res.feil) {
    importert = null;
    $('#forhandsvisning').hidden = true;
    melding(res.feil, 'feil');
    return;
  }
  importert = res;
  melding('', '');
  tegnForhandsvisning();
}

/** Ny tolkning når brukeren overstyrer kolonnevalget manuelt. */
function tolkMedKolonner(rå, overstyr) {
  const skille = gjettSkilletegn(rå);
  if (!skille) return lesInn(rå);
  const rader = splittRader(rå, skille);
  const auto = finnKolonner(rader);
  const kol = { ...auto, ...overstyr, ut: -1, inn: -1 };
  const poster = kol.datarader.map((r) => byggPost(r, kol)).filter(Boolean);
  if (!poster.length) return { feil: 'Fant ingen beløp med de kolonnene. Prøv en annen.' };

  const negative = poster.filter((p) => p.belop < 0).length;
  const snu = negative > poster.length * 0.6 ? -1 : 1;
  return {
    kol,
    kilde: 'tabell',
    poster: poster.map((p, i) => ({
      id: idFra(i),
      dato: p.dato,
      tekst: p.tekst.slice(0, 120),
      belop: ore(p.belop * snu),
      bucket: null,
      innbetaling: INNBETALING.test(p.tekst),
    })),
  };
}

function aktuellePoster() {
  if (!importert) return [];
  const medInn = $('#ta-med-innbetalinger').checked;
  return importert.poster.filter((p) => medInn || !p.innbetaling);
}

function tegnForhandsvisning() {
  const panel = $('#forhandsvisning');
  const poster = aktuellePoster();
  panel.hidden = false;
  $('#antall-funnet').textContent = String(poster.length);

  // Liste med de første postene
  const liste = $('#preview-liste');
  liste.textContent = '';
  for (const p of poster.slice(0, 6)) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="preview__dato"></span><span class="preview__tekst"></span><span class="preview__belop"></span>';
    li.children[0].textContent = visDato(p.dato);
    li.children[1].textContent = pentNavn(p.tekst);
    li.children[2].textContent = kr(p.belop);
    liste.append(li);
  }
  if (poster.length > 6) {
    const li = document.createElement('li');
    li.className = 'preview__note';
    li.textContent = `… og ${poster.length - 6} til`;
    liste.append(li);
  }

  // Filtrerte innbetalinger
  const antallInn = importert.poster.filter((p) => p.innbetaling).length;
  $('#sjekk-innbetalinger').hidden = antallInn === 0;
  const note = $('#filtrert-note');
  note.hidden = antallInn === 0;
  note.textContent = antallInn
    ? `${antallInn} ${antallInn === 1 ? 'rad så' : 'rader så'} ut som innbetaling på kortet og ${antallInn === 1 ? 'er' : 'er'} holdt utenfor.`
    : '';

  tegnKolonnevalg();
  tegnMinnevalg(poster);
  $('#knapp-start').disabled = poster.length === 0;
}

function tegnKolonnevalg() {
  const boks = $('#kolonnevalg');
  const kol = importert && importert.kol;
  if (!kol || !Array.isArray(kol.datarader)) { boks.hidden = true; return; }
  boks.hidden = false;

  const bredde = Math.max(...kol.datarader.map((r) => r.length), kol.hode ? kol.hode.length : 0);
  for (const [felt, id] of [['dato', '#kol-dato'], ['tekst', '#kol-tekst'], ['belop', '#kol-belop']]) {
    const sel = $(id);
    sel.textContent = '';
    for (let i = 0; i < bredde; i += 1) {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = (kol.hode && kol.hode[i]) ? kol.hode[i] : `Kolonne ${i + 1}`;
      sel.append(o);
    }
    if (felt === 'dato') {
      const ingen = document.createElement('option');
      ingen.value = '-1'; ingen.textContent = '(ingen dato)';
      sel.append(ingen);
    }
    sel.value = String(kol[felt]);
  }
}

/** Tilbyr å fylle ut automatisk de butikkene som er sortert før. */
function tegnMinnevalg(poster) {
  let boks = $('#sjekk-minne');
  const treff = poster.filter((p) => minneFor(p));
  if (!treff.length) { if (boks) boks.hidden = true; return; }

  if (!boks) {
    boks = document.createElement('label');
    boks.className = 'sjekk';
    boks.id = 'sjekk-minne';
    boks.innerHTML = '<input type="checkbox" id="bruk-minne"><span></span>';
    $('#forhandsvisning').insertBefore(boks, $('#forhandsvisning .panel__actions'));
  }
  boks.hidden = false;
  $('span', boks).textContent = `Fyll ut de ${treff.length} utgiftene jeg har sortert før automatisk`;
}

function startSveiping() {
  const poster = aktuellePoster();
  if (!poster.length) return;

  const brukMinne = $('#bruk-minne') && $('#bruk-minne').checked;
  S.poster = poster.map((p) => ({
    ...p,
    bucket: brukMinne ? minneFor(p) : null,
    fraMinne: Boolean(brukMinne && minneFor(p)),
  }));
  S.historikk = [];
  S.filter = 'alle';
  importert = null;
  $('#forhandsvisning').hidden = true;
  $('#lim-inn').value = '';
  melding('', '');
  visSkjerm('sveip');
}

/* ─── 5. SVEIPING ───────────────────────────────────────── */

const stack = $('#stack');
const soner = { a: $('#sone-a'), b: $('#sone-b') };
let toastTimer = null;

function basisTransform(dybde) {
  return `translate(0px, calc(-50% + ${dybde * 9}px)) scale(${(1 - dybde * 0.04).toFixed(3)})`;
}

function lagKort(post, dybde) {
  const el = document.createElement('article');
  el.className = 'kort';
  el.dataset.id = post.id;
  el.style.zIndex = String(KONFIG.synligeKort - dybde);
  el.style.transform = basisTransform(dybde);
  if (dybde === 0) el.dataset.topp = 'true';

  const husket = minneFor(post);
  const kreditt = post.belop < 0;

  el.innerHTML = `
    <div class="kort__topp">
      <span class="kort__kat" aria-hidden="true"></span>
      <span class="kort__dato"></span>
    </div>
    <h2 class="kort__butikk"></h2>
    <p class="kort__belop${kreditt ? ' kort__belop--kreditt' : ''}"></p>
    <p class="kort__meta"></p>
    <span class="kort__stempel kort__stempel--a" data-stempel="a"></span>
    <span class="kort__stempel kort__stempel--b" data-stempel="b"></span>
    <span class="kort__stempel kort__stempel--shared" data-stempel="shared">Felles</span>
    <span class="kort__stempel kort__stempel--skip" data-stempel="skip">Senere</span>`;

  $('.kort__kat', el).textContent = gjettIkon(post.tekst);
  $('.kort__dato', el).textContent = visDato(post.dato);
  $('.kort__butikk', el).textContent = pentNavn(post.tekst);
  $('.kort__belop', el).textContent = (kreditt ? '− ' : '') + kr(Math.abs(post.belop));
  $('.kort__meta', el).textContent = kreditt ? `Kreditering · ${post.tekst}` : post.tekst;
  $('[data-stempel="a"]', el).textContent = S.navn.a;
  $('[data-stempel="b"]', el).textContent = S.navn.b;

  if (husket) {
    const hint = document.createElement('span');
    hint.className = 'kort__minne';
    hint.textContent = `Sist: ${botteNavn(husket)}`;
    el.append(hint);
  }
  return el;
}

function tegnStokk() {
  const ko = koen();
  $$('.kort:not(.kort--flyr)', stack).forEach((e) => e.remove());

  // Bakerst først, så det øverste kortet havner sist i DOM-en.
  const synlige = ko.slice(0, KONFIG.synligeKort);
  for (let i = synlige.length - 1; i >= 0; i -= 1) stack.append(lagKort(synlige[i], i));

  const topp = $('.kort[data-topp]', stack);
  if (topp) koblePeker(topp);

  $('#tomt').hidden = ko.length > 0;
  stack.hidden = ko.length === 0;
  oppdaterFramdrift();
  $('#knapp-angre').disabled = S.historikk.length === 0;
}

function oppdaterFramdrift() {
  const totalt = S.poster.length;
  const igjen = koen().length;
  const gjort = totalt - igjen;
  $('#framdrift-fill').style.width = totalt ? `${(gjort / totalt) * 100}%` : '0%';
  $('#framdrift-tall').textContent = `${gjort} av ${totalt}`;
  const sumIgjen = koen().reduce((s, p) => s + p.belop, 0);
  $('#framdrift-sum').textContent = igjen ? `${krHel(sumIgjen)} igjen` : 'ferdig';
}

/* Pekerhåndtering: dra kortet, slipp for å sveipe. */
function koblePeker(el) {
  let startX = 0; let startY = 0; let dx = 0; let dy = 0;
  let drar = false; let pekerId = null;

  const terskelX = () => Math.max(60, el.offsetWidth * KONFIG.dragTerskel);

  function retning() {
    if (Math.abs(dx) > Math.abs(dy)) {
      return { botte: dx > 0 ? 'a' : 'b', styrke: Math.min(1, Math.abs(dx) / terskelX()) };
    }
    if (dy < 0) return { botte: 'shared', styrke: Math.min(1, -dy / KONFIG.terskelOpp) };
    return { botte: 'skip', styrke: Math.min(1, dy / KONFIG.terskelNed) };
  }

  function tegn() {
    el.style.transform = `translate(${dx}px, calc(-50% + ${dy}px)) rotate(${dx / 18}deg)`;
    const { botte, styrke } = retning();
    for (const b of ['a', 'b', 'shared', 'skip']) {
      $(`[data-stempel="${b}"]`, el).style.opacity = b === botte ? String(styrke) : '0';
    }
    soner.a.style.opacity = botte === 'a' ? String(styrke * 0.9) : '0';
    soner.b.style.opacity = botte === 'b' ? String(styrke * 0.9) : '0';
  }

  function nullstill() {
    el.classList.add('kort--tilbake');
    el.style.transform = basisTransform(0);
    $$('[data-stempel]', el).forEach((s) => { s.style.opacity = '0'; });
    soner.a.style.opacity = '0';
    soner.b.style.opacity = '0';
    setTimeout(() => el.classList.remove('kort--tilbake'), 360);
  }

  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drar = true; pekerId = e.pointerId;
    startX = e.clientX; startY = e.clientY; dx = 0; dy = 0;
    el.classList.remove('kort--tilbake', 'kort--dropp');
    try { el.setPointerCapture(pekerId); } catch { /* ignorer */ }
  });

  el.addEventListener('pointermove', (e) => {
    if (!drar || e.pointerId !== pekerId) return;
    dx = e.clientX - startX;
    dy = e.clientY - startY;
    tegn();
  });

  const slipp = (e) => {
    if (!drar || (e && e.pointerId !== pekerId)) return;
    drar = false;
    try { el.releasePointerCapture(pekerId); } catch { /* ignorer */ }
    const { botte, styrke } = retning();
    soner.a.style.opacity = '0';
    soner.b.style.opacity = '0';
    if (styrke >= 1 && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) sveip(botte, el);
    else nullstill();
  };

  el.addEventListener('pointerup', slipp);
  el.addEventListener('pointercancel', slipp);
}

function flyUt(el, botte, ferdig) {
  let kjort = false;
  const rydd = () => { if (kjort) return; kjort = true; el.remove(); ferdig(); };
  el.classList.add('kort--flyr', 'kort--dropp');
  el.removeAttribute('data-topp');
  const bredde = window.innerWidth + 200;
  const hoyde = window.innerHeight + 200;
  const mal = {
    a: `translate(${bredde}px, calc(-50% + ${-40}px)) rotate(24deg)`,
    b: `translate(${-bredde}px, calc(-50% + ${-40}px)) rotate(-24deg)`,
    shared: `translate(0px, calc(-50% - ${hoyde}px)) rotate(-4deg)`,
    skip: `translate(0px, calc(-50% + ${hoyde}px)) rotate(4deg)`,
  };
  requestAnimationFrame(() => {
    el.style.transform = mal[botte];
    el.style.opacity = '0';
  });
  el.addEventListener('transitionend', rydd, { once: true });
  setTimeout(rydd, 500);
}

/** Hovedhandlingen: sett dagens øverste kort i en bøtte (eller utsett det). */
function sveip(botte, fraElement) {
  const ko = koen();
  if (!ko.length) return;
  const post = ko[0];
  const el = fraElement || $('.kort[data-topp]', stack);

  if (botte === 'skip') {
    const indeks = S.poster.indexOf(post);
    S.poster.splice(indeks, 1);
    S.poster.push(post);
    S.historikk.push({ type: 'senere', id: post.id, indeks });
    si(`${pentNavn(post.tekst)} utsatt`);
  } else {
    post.bucket = botte;
    post.fraMinne = false;
    huskValg(post, botte);
    S.historikk.push({ type: 'en', endringer: [{ id: post.id, fra: null }] });
    si(`${pentNavn(post.tekst)} til ${botteNavn(botte)}`);
  }
  lagre();

  if (el) flyUt(el, botte, () => { tegnStokk(); if (botte !== 'skip') tilbySamme(post, botte); });
  else { tegnStokk(); if (botte !== 'skip') tilbySamme(post, botte); }
}

function si(tekst) { $('#sveip-status').textContent = tekst; }

function angre() {
  const h = S.historikk.pop();
  if (!h) return;
  if (h.type === 'senere') {
    const i = S.poster.findIndex((p) => p.id === h.id);
    if (i >= 0) {
      const [post] = S.poster.splice(i, 1);
      S.poster.splice(Math.min(h.indeks, S.poster.length), 0, post);
    }
  } else {
    for (const { id, fra } of h.endringer) {
      const p = finn(id);
      if (p) p.bucket = fra;
    }
  }
  skjulToast();
  lagre();
  tegnStokk();
  si('Angret');
}

/* «Du har 4 flere fra REMA. Sett alle til Felles?» */
function tilbySamme(post, botte) {
  const nokkel = kjedeNokkel(post.tekst);
  const like = koen().filter((p) => kjedeNokkel(p.tekst) === nokkel);
  if (!like.length) return;

  const toast = $('#toast');
  toast.textContent = '';
  const tekst = document.createElement('span');
  tekst.className = 'toast__tekst';
  tekst.textContent = `${like.length} ${like.length === 1 ? 'til' : 'til'} fra ${kjedeNavn(post.tekst)}. Samme der?`;
  const ja = document.createElement('button');
  ja.className = 'toast__btn';
  ja.type = 'button';
  ja.textContent = `Alle til ${botteNavn(botte)}`;
  ja.addEventListener('click', () => {
    const endringer = like.map((p) => ({ id: p.id, fra: p.bucket }));
    like.forEach((p) => { p.bucket = botte; });
    S.historikk.push({ type: 'flere', endringer });
    lagre();
    skjulToast();
    tegnStokk();
    si(`${like.length} utgifter til ${botteNavn(botte)}`);
  });
  const lukk = document.createElement('button');
  lukk.className = 'toast__lukk';
  lukk.type = 'button';
  lukk.setAttribute('aria-label', 'Lukk');
  lukk.textContent = '×';
  lukk.addEventListener('click', skjulToast);

  toast.append(tekst, ja, lukk);
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(skjulToast, KONFIG.toastMs);
}

function skjulToast() {
  clearTimeout(toastTimer);
  const toast = $('#toast');
  toast.hidden = true;
  toast.textContent = '';
}

/* ─── 6. OPPGJØR ────────────────────────────────────────── */

/**
 * Regnestykket:
 *   andel = egne utgifter + halvparten av felles
 * Den som ikke betalte regninga, skylder sin andel tilbake.
 * På felles kort deles differansen på to, så begge ender likt.
 */
function beregn() {
  const sum = { a: 0, b: 0, shared: 0, uten: 0 };
  const ant = { a: 0, b: 0, shared: 0, uten: 0 };
  for (const p of S.poster) {
    const k = p.bucket || 'uten';
    sum[k] = ore(sum[k] + p.belop);
    ant[k] += 1;
  }
  const andelA = ore(sum.a + sum.shared / 2);
  const andelB = ore(sum.b + sum.shared / 2);
  const total = ore(sum.a + sum.b + sum.shared);

  let skyldner; let mottaker; let belop;
  if (S.betaler === 'a') { skyldner = 'b'; mottaker = 'a'; belop = andelB; }
  else if (S.betaler === 'b') { skyldner = 'a'; mottaker = 'b'; belop = andelA; }
  else { skyldner = 'a'; mottaker = 'b'; belop = ore((andelA - andelB) / 2); }
  if (belop < 0) { [skyldner, mottaker] = [mottaker, skyldner]; belop = -belop; }

  return { sum, ant, andelA, andelB, total, skyldner, mottaker, belop };
}

function tegnOppgjor() {
  const r = beregn();

  // Dommen
  const dom = $('#dom');
  dom.textContent = '';
  if (Math.round(r.belop) === 0) {
    dom.textContent = 'Dere er skuls. Ingen skylder noe.';
  } else {
    dom.append(document.createTextNode(`${botteNavn(r.skyldner)} skylder ${botteNavn(r.mottaker)} `));
    const b = document.createElement('strong');
    b.textContent = krHel(r.belop);
    dom.append(b);
  }

  // Totalkort
  const totaler = $('#totaler');
  totaler.textContent = '';
  const kort = [
    { navn: S.navn.a, sum: r.andelA, under: `${kr(r.sum.a)} egne + halve felles`, farge: 'var(--a)' },
    { navn: S.navn.b, sum: r.andelB, under: `${kr(r.sum.b)} egne + halve felles`, farge: 'var(--b)' },
    { navn: 'Felles', sum: r.sum.shared, under: `${r.ant.shared} utgifter, deles 50/50`, farge: 'var(--shared)' },
    { navn: 'Hele regninga', sum: r.total, under: `${S.poster.length} utgifter`, farge: 'var(--ink-3)' },
  ];
  for (const k of kort) {
    const li = document.createElement('li');
    li.className = 'total';
    li.style.setProperty('--linjefarge', k.farge);
    li.innerHTML = '<p class="total__navn"></p><p class="total__sum"></p><p class="total__antall"></p>';
    li.children[0].textContent = k.navn;
    li.children[1].textContent = kr(k.sum);
    li.children[2].textContent = k.under;
    totaler.append(li);
  }

  const beskjed = $('#melding-sum');
  beskjed.textContent = r.ant.uten
    ? `${r.ant.uten} ${r.ant.uten === 1 ? 'utgift er' : 'utgifter er'} ikke fordelt ennå, og teller ikke med.`
    : '';
  beskjed.dataset.type = r.ant.uten ? 'feil' : '';

  tegnBetaler();
  tegnFiltre(r);
  tegnRader();
}

/** Hvem som la ut, kan også byttes her, det er her du ser hva det gjør. */
function tegnBetaler() {
  const boks = $('#betaler-oppgjor');
  $$('.chip', boks).forEach((el) => el.remove());
  for (const v of [{ id: 'a', navn: S.navn.a }, { id: 'b', navn: S.navn.b }, { id: 'none', navn: 'Felles kort' }]) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = v.navn;
    b.setAttribute('aria-pressed', String(S.betaler === v.id));
    b.addEventListener('click', () => {
      S.betaler = v.id;
      const radio = $(`input[name="betaler"][value="${v.id}"]`);
      if (radio) radio.checked = true;
      lagre();
      tegnOppgjor();
    });
    boks.append(b);
  }
}

function tegnFiltre(r) {
  const boks = $('#filtre');
  boks.textContent = '';
  const valg = [
    { id: 'alle', navn: `Alle (${S.poster.length})` },
    { id: 'a', navn: `${S.navn.a} (${r.ant.a})` },
    { id: 'b', navn: `${S.navn.b} (${r.ant.b})` },
    { id: 'shared', navn: `Felles (${r.ant.shared})` },
  ];
  if (r.ant.uten) valg.push({ id: 'uten', navn: `Ikke satt (${r.ant.uten})` });

  for (const v of valg) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.type = 'button';
    b.textContent = v.navn;
    b.setAttribute('aria-pressed', String(S.filter === v.id));
    b.addEventListener('click', () => { S.filter = v.id; tegnOppgjor(); });
    boks.append(b);
  }
}

function tegnRader() {
  const liste = $('#rader');
  liste.textContent = '';
  const synlige = S.poster.filter((p) => S.filter === 'alle' || (p.bucket || 'uten') === S.filter);

  for (const p of synlige) {
    const li = document.createElement('li');
    li.className = 'rad';
    li.dataset.id = p.id;
    li.style.setProperty('--linjefarge', BOTTE_FARGE[p.bucket] || 'var(--skip)');
    li.innerHTML = '<span class="rad__dato"></span><span class="rad__tekst"></span>'
      + '<span class="rad__belop"></span><span class="rad__valg"></span>';
    li.children[0].textContent = visDato(p.dato);
    li.children[1].textContent = pentNavn(p.tekst);
    li.children[1].title = p.tekst;
    li.children[2].textContent = (p.belop < 0 ? '− ' : '') + kr(Math.abs(p.belop));

    const valg = li.children[3];
    for (const b of ['a', 'b', 'shared']) {
      const knapp = document.createElement('button');
      knapp.className = 'velg';
      knapp.type = 'button';
      knapp.textContent = botteNavn(b);
      knapp.style.setProperty('--velgfarge', BOTTE_FARGE[b]);
      knapp.setAttribute('aria-pressed', String(p.bucket === b));
      knapp.setAttribute('aria-label', `Sett ${pentNavn(p.tekst)} til ${botteNavn(b)}`);
      knapp.addEventListener('click', () => {
        p.bucket = p.bucket === b ? null : b;
        if (p.bucket) huskValg(p, p.bucket);
        lagre();
        tegnOppgjor();
      });
      valg.append(knapp);
    }
    liste.append(li);
  }

  if (!synlige.length) {
    const li = document.createElement('li');
    li.className = 'sum__hint';
    li.textContent = 'Ingen utgifter i denne kategorien.';
    liste.append(li);
  }
}

/* ─── Eksport ───────────────────────────────────────────── */

function periode() {
  const datoer = S.poster.map((p) => p.dato).filter(Boolean).sort();
  if (!datoer.length) return '';
  const fra = datoer[0]; const til = datoer[datoer.length - 1];
  return fra === til ? visDato(fra, true) : `${visDato(fra)} – ${visDato(til, true)}`;
}

function oppsummeringstekst() {
  const r = beregn();
  const linjer = [
    `Kredittkortoppgjør${periode() ? ` ${periode()}` : ''}`,
    `${S.navn.a}: ${kr(r.sum.a)}`,
    `${S.navn.b}: ${kr(r.sum.b)}`,
    `Felles: ${kr(r.sum.shared)} (${kr(ore(r.sum.shared / 2))} hver)`,
    `Totalt: ${kr(r.total)}`,
    '',
    Math.round(r.belop) === 0
      ? 'Dere er skuls.'
      : `${botteNavn(r.skyldner)} skylder ${botteNavn(r.mottaker)} ${krHel(r.belop)}`,
  ];
  if (r.ant.uten) linjer.push(`(${r.ant.uten} utgifter er ikke fordelt)`);
  return linjer.join('\n');
}

function csvCelle(v) {
  const s = String(v == null ? '' : v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function lastNedCsv() {
  const r = beregn();
  const rader = [['Dato', 'Tekst', 'Beløp', 'Hvem']];
  for (const p of S.poster) rader.push([p.dato || '', p.tekst, nfTo.format(p.belop), botteNavn(p.bucket)]);
  rader.push([], ['', `${S.navn.a} egne`, nfTo.format(r.sum.a), '']);
  rader.push(['', `${S.navn.b} egne`, nfTo.format(r.sum.b), '']);
  rader.push(['', 'Felles', nfTo.format(r.sum.shared), '']);
  rader.push(['', `${S.navn.a} sin andel`, nfTo.format(r.andelA), '']);
  rader.push(['', `${S.navn.b} sin andel`, nfTo.format(r.andelB), '']);
  rader.push(['', `${botteNavn(r.skyldner)} skylder ${botteNavn(r.mottaker)}`, nfTo.format(r.belop), '']);

  const csv = rader.map((rad) => rad.map(csvCelle).join(';')).join('\r\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kortsveip-oppgjor-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function kopier(tekst) {
  try {
    await navigator.clipboard.writeText(tekst);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = tekst;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/* ─── 7. KOBLINGER ──────────────────────────────────────── */

async function lesFil(fil) {
  const buffer = await fil.arrayBuffer();
  let tekst = new TextDecoder('utf-8').decode(buffer);
  // Mange norske bankeksporter er latin-1. Bytt hvis æ, ø og å ble til tegnsalat.
  if (tekst.includes('�')) {
    try { tekst = new TextDecoder('windows-1252').decode(buffer); } catch { /* behold utf-8 */ }
  }
  return tekst;
}

function koble() {
  // Navn og betaler
  $('#navn-a').addEventListener('input', () => { oppdaterNavn(); if (S.skjerm === 'oppgjor') tegnOppgjor(); });
  $('#navn-b').addEventListener('input', () => { oppdaterNavn(); if (S.skjerm === 'oppgjor') tegnOppgjor(); });
  $$('input[name="betaler"]').forEach((r) => r.addEventListener('change', () => {
    S.betaler = r.value;
    lagre();
    if (S.skjerm === 'oppgjor') tegnOppgjor();
  }));

  // Filvelger og slippsone
  const sone = $('#dropzone');
  $('#fil-input').addEventListener('change', async (e) => {
    const fil = e.target.files && e.target.files[0];
    if (!fil) return;
    melding(`Leser ${fil.name} …`);
    tolkOgVis(await lesFil(fil));
    e.target.value = '';
  });
  ['dragenter', 'dragover'].forEach((n) => sone.addEventListener(n, (e) => {
    e.preventDefault(); sone.classList.add('is-over');
  }));
  ['dragleave', 'drop'].forEach((n) => sone.addEventListener(n, (e) => {
    e.preventDefault(); sone.classList.remove('is-over');
  }));
  sone.addEventListener('drop', async (e) => {
    const fil = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (fil) { melding(`Leser ${fil.name} …`); tolkOgVis(await lesFil(fil)); }
    else if (e.dataTransfer) tolkOgVis(e.dataTransfer.getData('text/plain'));
  });

  // Les inn / demo
  $('#knapp-les').addEventListener('click', () => tolkOgVis($('#lim-inn').value));
  $('#knapp-demo').addEventListener('click', () => {
    $('#lim-inn').value = DEMO;
    tolkOgVis(DEMO);
    melding('Eksempeldata lastet. Trykk «Start sveipingen».', 'ok');
  });

  // Forhåndsvisning
  ['#kol-dato', '#kol-tekst', '#kol-belop'].forEach((id) => $(id).addEventListener('change', () => {
    tolkOgVis(rååImport, {
      dato: Number($('#kol-dato').value),
      tekst: Number($('#kol-tekst').value),
      belop: Number($('#kol-belop').value),
    });
    $('#kolonnevalg').open = true;
  }));
  $('#ta-med-innbetalinger').addEventListener('change', tegnForhandsvisning);
  $('#knapp-start').addEventListener('click', startSveiping);
  $('#knapp-avbryt').addEventListener('click', () => {
    importert = null;
    $('#forhandsvisning').hidden = true;
    $('#lim-inn').value = '';
    melding('');
  });

  // Sveipeskjermen
  $$('[data-bucket]').forEach((b) => b.addEventListener('click', () => sveip(b.dataset.bucket)));
  $('#knapp-angre').addEventListener('click', angre);
  $('#knapp-til-oppgjor').addEventListener('click', () => visSkjerm('oppgjor'));
  $('#knapp-hopp-til-oppgjor').addEventListener('click', () => visSkjerm('oppgjor'));

  // Oppgjøret
  $('#knapp-tilbake').addEventListener('click', () => visSkjerm('sveip'));
  $('#knapp-csv').addEventListener('click', lastNedCsv);
  $('#knapp-kopier').addEventListener('click', async () => {
    const ok = await kopier(oppsummeringstekst());
    const el = $('#melding-sum');
    el.textContent = ok ? 'Oppsummeringen er kopiert. Lim den inn der du vil.' : 'Fikk ikke kopiert. Marker teksten manuelt.';
    el.dataset.type = ok ? 'ok' : 'feil';
  });

  // Ny regning
  $('#knapp-nullstill').addEventListener('click', () => {
    if (!window.confirm('Nullstille og starte på en ny regning? Fordelingen du har gjort forsvinner. Butikkene appen har lært, beholdes.')) return;
    S.poster = [];
    S.historikk = [];
    importert = null;
    try { localStorage.removeItem(KONFIG.lagerNokkel); } catch { /* ignorer */ }
    $('#lim-inn').value = '';
    $('#forhandsvisning').hidden = true;
    melding('');
    visSkjerm('start');
  });

  // Hurtigtaster
  document.addEventListener('keydown', (e) => {
    if (S.skjerm !== 'sveip') return;
    const mål = e.target;
    if (mål && /^(INPUT|TEXTAREA|SELECT)$/.test(mål.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    const taster = {
      ArrowRight: 'a', ArrowLeft: 'b', ArrowUp: 'shared', ArrowDown: 'skip',
    };
    if (taster[e.key]) { e.preventDefault(); sveip(taster[e.key]); }
    else if (e.key === 'z' || e.key === 'Z' || e.key === 'Backspace') { e.preventDefault(); angre(); }
  });
}

/* ─── Oppstart ──────────────────────────────────────────── */

function start() {
  koble();
  const gjenopptatt = hentLagret();

  $('#navn-a').value = S.navn.a;
  $('#navn-b').value = S.navn.b;
  const radio = $(`input[name="betaler"][value="${S.betaler}"]`);
  if (radio) radio.checked = true;
  oppdaterNavn();

  if (gjenopptatt) {
    visSkjerm(S.skjerm);
    const igjen = koen().length;
    si(igjen ? `Fortsetter der du slapp, ${igjen} igjen` : 'Alt er sortert');
  } else {
    visSkjerm('start');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
