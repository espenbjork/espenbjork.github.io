/* ============================================================
   mas.js, Bindersen den masete

   Har du vært lenge på siden, dukker hun opp ved det du leser og stiller
   et spørsmål. Spørsmålet skriver modellen (Worker-en, mode «mas»), ut fra
   hvilken seksjon og hvilket kort du ser på. Her finnes ingen ferdige replikker.

   Hun sklir ikke etter deg. Hun viskes ut der hun står og tegnes på nytt
   der du er: bindersen.js har emotene (kom, forsvinn, spor, bank, sov),
   her ligger bare når, og hvor.

   Trappa, hvert trinn en gang per besøk:
     1  rullet forbi toppen i FORSTE: øynene stikker opp over nedre kant
     2  SPORSMAL: hun tegnes ved det du leser, og spør
     3  VENTE uten svar: bank, flytt nærmere pekeren, nytt spørsmål (to ganger)
     4  tredje spørsmål uten svar: hun sovner i hjørnet og spør ikke mer
   Uten mus: 1, 2 og så 4.

   Klikker du et svar, går det til chatten (clippyChat.ask) og trappa er over.
   Krysset sender henne bort for resten av besøket. Hun tar aldri fokus.
   Redusert bevegelse og data-motion="off": her skjer ingenting, for da finnes
   ikke window.bindersen.

   ?mas=rask i adressen deler tidene på femten.
   ============================================================ */
(() => {
  "use strict";

  const root = document.documentElement;
  const mas = document.getElementById("mas");
  const chat = window.clippyChat;
  if (!mas || !chat || !chat.api || !window.bindersen) return;
  if (root.dataset.motion === "off") return;

  /* ── Tidene. Telles bare mens fanen er synlig og bare under toppen ── */
  const RASK = new URLSearchParams(location.search).get("mas") === "rask";
  const DEL = RASK ? 15 : 1;
  const FORSTE = 45000 / DEL;      /* fra toppen er ute av bildet til øynene stikker opp */
  const SPORSMAL = 90000 / DEL;    /* og til første spørsmål */
  const VENTE = 20000 / DEL;       /* så lenge hun venter på svar før hun prøver igjen */
  const SVAR_VIST = 12000;         /* så lenge svaret hennes blir stående i bobla (deles ikke) */
  const FIRE_SEKUNDER = 4000;      /* Worker-en får så lang tid på å skrive spørsmålet */
  const FORSOK = 3;                /* høyst tre kall per besøk, ett per spørsmål */

  const STORE_KEY = "bindersen-mas";   /* «borte» (krysset) eller «ferdig» (svart, eller sovnet) */
  const PAD = 16;                      /* minste avstand til kanten av vinduet */
  const LINJE = 26;                    /* halve høyden på linja pekeren står på */
  const VIEW_W = 220, VIEW_H = 320;    /* figuren er tegnet i 220 × 320 */

  const lagret = () => { try { return sessionStorage.getItem(STORE_KEY); } catch (e) { return null; } };
  const lagre = (v) => { try { sessionStorage.setItem(STORE_KEY, v); } catch (e) {} };
  if (lagret()) return;

  const char = mas.querySelector(".mas__char");
  const xBtn = mas.querySelector(".mas__x");
  const bubble = mas.querySelector(".mas__bubble");
  const qEl = bubble && bubble.querySelector(".mas__q");
  const answersEl = bubble && bubble.querySelector(".mas__answers");
  const answerBtns = bubble ? [...bubble.querySelectorAll(".mas__answer")] : [];
  const logEl = bubble && bubble.querySelector(".mas__log");
  if (!char || !xBtn || !bubble || !qEl || !answersEl || answerBtns.length < 2 || !logEl) return;

  const heroBtn = document.querySelector('[data-bindersen="hero"]');
  const peekBox = document.querySelector(".peek");
  const hero = document.querySelector(".hero");
  const clippy = document.getElementById("clippy");
  const mouse = !window.matchMedia("(hover: none)").matches;

  /* ── Hjelpere ─────────────────────────────────────────────── */
  const play = (navn, valg) => window.bindersen.play(navn, { figur: "folge", ...valg });
  const frames = (n) => new Promise((ok) => {
    const step = () => (--n <= 0 ? ok() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
  const inView = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
  };

  /* Siste kjente pekerposisjon. Uten mus finnes den ikke. */
  let ptr = null;
  window.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") ptr = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  document.addEventListener("mouseleave", () => { ptr = null; });

  /* ── Hva som er tilstanden ────────────────────────────────── */
  let phase = "idle";      /* idle, peek, ask, reply, sleep, done */
  let attempt = 0;         /* spørsmål stilt så langt */
  let shown = false;       /* står i vinduet (ikke borte, ikke skjult) */
  let clock = 0;           /* tid under toppen, med fanen synlig og ingen annen Bindersen i bildet */
  let askedAt = Infinity;  /* klokka da bobla kom opp, eller svaret kom */
  let view = null;         /* det bobla viser: { q, answers } eller { q, mine, reply } */
  let told = false;        /* er et spørsmål lest opp? Bare det første skal det */
  let place = null;        /* hvor hun står: { x, y, w, h } */
  let gen = 0;             /* hver kjede sjekker at ingen har avbrutt den */
  let busy = false;        /* en kjede kjører */
  let calmFrom = 0;        /* siden når ingen annen Bindersen har vært i bildet */

  /* En kjede er noe som tar tid: forsvinn, flytt, kom. Starter en ny, er den gamle avbrutt,
     og den sjekker alive() etter hver ventetid. */
  const go = (fn) => {
    const my = ++gen;
    busy = true;
    const alive = () => my === gen;
    Promise.resolve(fn(alive))
      .catch((e) => console.warn("mas:", e))
      .finally(() => { if (alive()) busy = false; });
  };

  /* ── Plassering ───────────────────────────────────────────── */

  /* Er dette tekst, bilde eller kort? Containerne uten eget innhold regnes ikke. */
  const NEUTRAL = "html, body, main, section, header, nav, canvas, aside, .hero, .section__head, .carousel, .cards";
  const CONTENT = "img, svg, a, button, input, h1, h2, h3, h4, p, li, figure, .card, .timeline__item";
  const isContent = (el) => {
    if (mas.contains(el) || el.matches(NEUTRAL)) return false;
    if (el.matches(CONTENT)) return true;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  };

  /* Står det noe av innholdet på siden i dette rektangelet, målt med elementsFromPoint? */
  const isFree = (x, y, w, h) => {
    const vh = window.innerHeight, vw = root.clientWidth;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 5; j++) {
        const px = x + 4 + ((w - 8) * i) / 2;
        const py = y + 4 + ((h - 8) * j) / 4;
        if (px < 0 || py < 0 || px >= vw || py >= vh) continue;
        if (document.elementsFromPoint(px, py).some(isContent)) return false;
      }
    }
    return true;
  };

  /* Står hun over det grønne panelet, er blekket usynlig. Da sier vi fra til stilarket,
     som tegner henne lyst. Hun står stille mens siden ruller under, så det sjekkes også ved rulling. */
  const darkPanels = [...document.querySelectorAll(".section--cv")];
  const tone = () => {
    if (!place) return;
    const cx = place.x + place.w / 2;
    const cy = place.y + Math.min(place.h, window.innerHeight - place.y) / 2;   /* midt i det som synes av henne */
    const dark = darkPanels.some((el) => {
      const r = el.getBoundingClientRect();
      return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
    });
    const v = dark ? "dark" : "light";
    if (mas.dataset.on !== v) mas.dataset.on = v;
  };
  let toneFrame = 0;
  window.addEventListener("scroll", () => {
    if (!shown || toneFrame) return;
    toneFrame = requestAnimationFrame(() => { toneFrame = 0; tone(); });
  }, { passive: true });

  /* Setter henne ned. kind:
       peek     bare bryn og øyne over nedre kant
       sleep    nedre hjørne, litt mer av henne, så z-ene vises
       reading  i margen ved det du leser (midten av vinduet)
       pointer  den ledige plassen nærmest siste kjente pekerposisjon */
  const setPlace = (kind) => {
    const w = char.offsetWidth || 96;
    const h = (w * VIEW_H) / VIEW_W;
    const vw = root.clientWidth, vh = window.innerHeight;
    const col = (document.getElementById("arbeid") || root).getBoundingClientRect();
    const left = Math.max(0, col.left), right = Math.max(0, vw - col.right);
    const fits = (m) => m >= w + 2 * PAD;
    const xL = (left - w) / 2, xR = col.right + (right - w) / 2;
    const xBL = PAD, xBR = vw - w - PAD;
    const edge = kind === "peek" || kind === "sleep";
    const frac = kind === "peek" ? 0.42 : kind === "sleep" ? 0.58 : 1;
    const yEdge = vh - h * frac;                 /* øverste kant når hun bare stikker opp */
    const yCorner = vh - h - PAD;
    const test = (x, y) => isFree(x, y, w, Math.min(h * frac, vh - y));

    let pick = null;
    if (edge) {
      /* Langs nedre kant: marg først (bred skjerm), så hjørnene. Første ledige. */
      const xs = kind === "sleep" ? [xBR, xBL] : [fits(right) && xR, xBR, fits(left) && xL, xBL];
      const x = xs.find((v) => v !== false && test(v, yEdge));
      pick = { x: x === undefined ? xBR : x, y: yEdge };
    } else {
      const target = kind === "pointer" && ptr ? ptr : { x: vw / 2, y: vh / 2 };
      const dist = (c) => Math.hypot(c.x + w / 2 - target.x, c.y + h / 2 - target.y);
      const margin = [];
      for (const x of [fits(right) && xR, fits(left) && xL]) {
        if (x === false) continue;
        for (let k = 0; k <= 7; k++) margin.push({ x, y: PAD + ((vh - h - 2 * PAD) * k) / 7 });
      }
      const free = margin.filter((c) => test(c.x, c.y)).sort((a, b) => dist(a) - dist(b));
      if (free.length) pick = free[0];
      else {
        /* Ingen ledig plass i margen: nedre hjørne, det nærmeste som er ledig, ellers bare det nærmeste */
        const corners = [{ x: xBR, y: yCorner }, { x: xBL, y: yCorner }].sort((a, b) => dist(a) - dist(b));
        pick = corners.find((c) => test(c.x, c.y)) || corners[0];
      }
    }
    place = { x: pick.x, y: pick.y, w, h };
    tone();
    char.style.left = `${Math.round(pick.x)}px`;
    char.style.top = `${Math.round(pick.y)}px`;
    xBtn.style.left = `${Math.round(Math.min(pick.x + w - 12, vw - 30))}px`;
    xBtn.style.top = `${Math.round(Math.max(2, pick.y - 12))}px`;
  };

  /* Bobla ved siden av henne, mot midten av siden. Kan ligge over innhold, men aldri utenfor
     vinduet og aldri over linja pekeren står på. */
  const placeBubble = () => {
    if (!place || bubble.hidden) return;
    const vw = root.clientWidth, vh = window.innerHeight, GAP = 12;
    const toRight = place.x + place.w / 2 < vw / 2;
    const room = toRight ? vw - (place.x + place.w + GAP) - PAD : place.x - GAP - PAD;
    const beside = room >= 200;
    const bw = Math.min(280, beside ? room : vw - 2 * PAD);
    bubble.style.width = `${bw}px`;
    const bh = bubble.offsetHeight;
    let x, y;
    if (beside) {
      x = toRight ? place.x + place.w + GAP : place.x - GAP - bw;
      y = place.y + place.h * 0.3 - bh / 2;
    } else {
      x = place.x + place.w / 2 - bw / 2;
      y = place.y - GAP - bh;                     /* smalt vindu: over henne */
    }
    const clampY = (v) => Math.max(PAD, Math.min(v, vh - PAD - bh));
    y = clampY(y);
    x = Math.max(PAD, Math.min(x, vw - PAD - bw));
    if (ptr && y < ptr.y + LINJE && y + bh > ptr.y - LINJE) {
      const above = ptr.y - LINJE - bh, below = ptr.y + LINJE;
      const opts = [above, below].filter((v) => v >= PAD && v + bh <= vh - PAD);
      if (opts.length) y = opts.sort((a, b) => Math.abs(a - y) - Math.abs(b - y))[0];
      else y = ptr.y > vh / 2 ? Math.max(PAD, above) : Math.min(vh - PAD - bh, below);   /* trangt: det som er igjen */
    }
    bubble.style.left = `${Math.round(x)}px`;
    bubble.style.top = `${Math.round(y)}px`;
  };

  /* ── Bobla ────────────────────────────────────────────────── */
  const hideBubble = () => { bubble.hidden = true; };

  const msg = (cls, text, extra) => {
    const p = document.createElement("p");
    p.className = `clippy__msg clippy__msg--${cls}${extra ? " " + extra : ""}`;
    p.textContent = text;
    return p;
  };

  /* Tegner innholdet fra view: spørsmålet og to svar, eller samtalen etter at du har svart */
  const paintBubble = () => {
    if (!view) return;
    qEl.textContent = view.q;
    if (view.mine == null) {
      answerBtns.forEach((b, i) => { b.textContent = view.answers[i]; b.removeAttribute("aria-disabled"); });
      answersEl.hidden = false;
      logEl.hidden = true;
      logEl.replaceChildren();
    } else {
      answersEl.hidden = true;
      logEl.hidden = false;
      /* Ditt eget svar og venteprikkene leses ikke opp, bare svaret hennes */
      const mine = msg("me", view.mine);
      mine.setAttribute("aria-hidden", "true");
      const next = view.reply == null ? msg("bot", "…", "is-thinking") : msg("bot", view.reply);
      if (view.reply == null) next.setAttribute("aria-hidden", "true");
      logEl.replaceChildren(mine, next);
    }
  };

  /* Første spørsmål leses opp høflig, de neste ikke */
  const showBubble = async (alive) => {
    if (!view) return;
    qEl.setAttribute("aria-live", told ? "off" : "polite");
    if (view.mine == null) told = true;
    bubble.hidden = false;
    await frames(1);                       /* regionen må finnes før teksten kommer */
    if (alive && !alive()) return;
    paintBubble();
    placeBubble();
  };

  /* ── Spørsmålet ───────────────────────────────────────────── */
  const sectionAtMiddle = () => {
    const mid = window.innerHeight / 2;
    for (const id of ["arbeid", "erfaring", "kontakt"]) {
      const el = document.getElementById(id);
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= mid && r.bottom > mid) return id;
    }
    return null;
  };

  /* Prosjektkortet nærmest midten av vinduet, av dem som er i bildet */
  const cardAtMiddle = () => {
    const cx = root.clientWidth / 2, cy = window.innerHeight / 2;
    let best = null, bestD = Infinity;
    for (const card of document.querySelectorAll("#arbeid .card")) {
      if (!inView(card)) continue;
      const r = card.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - cx, r.top + r.height / 2 - cy);
      if (d < bestD) { best = card; bestD = d; }
    }
    const h3 = best && best.querySelector("h3");
    const text = h3 && h3.textContent.trim();
    return text ? text.slice(0, 40) : null;
  };

  /* Gir { q, answers } eller null. Feil, for sen eller mangelfullt svar gir null: da blir det bare spor. */
  const fetchQuestion = async (n) => {
    const section = sectionAtMiddle();
    if (!section) return null;
    const card = section === "arbeid" ? cardAtMiddle() : null;
    const ctl = new AbortController();
    let timer = 0;
    const late = new Promise((ok) => { timer = setTimeout(() => { ctl.abort(); ok(null); }, FIRE_SEKUNDER); });
    const call = (async () => {
      try {
        const res = await fetch(chat.api, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "mas", section, card, attempt: n }),
          signal: ctl.signal,
        });
        if (!res.ok) return null;
        const d = await res.json();
        const q = d && typeof d.question === "string" ? d.question.trim() : "";
        const a = d && Array.isArray(d.answers) ? d.answers : [];
        if (!q || a.length < 2 || typeof a[0] !== "string" || typeof a[1] !== "string") return null;
        const answers = [a[0].trim(), a[1].trim()];
        if (!answers[0] || !answers[1]) return null;
        return { q: q.slice(0, 200), answers: answers.map((v) => v.slice(0, 40)) };
      } catch (e) {
        return null;
      }
    })();
    try { return await Promise.race([call, late]); } finally { clearTimeout(timer); }
  };

  /* ── Kjedene ──────────────────────────────────────────────── */

  /* Hun tegnes inn der hun skal stå i denne fasen, og viser det hun hadde å vise */
  const arrive = async (alive) => {
    mas.hidden = false;
    shown = true;
    setPlace(phase === "peek" ? "peek" : phase === "sleep" ? "sleep" : mouse ? "pointer" : "reading");
    await frames(2);                       /* bindersen.js må ha sett henne før kom */
    if (!alive()) return;
    await play("kom");
    if (!alive()) return;
    if (phase === "ask" && askedAt === Infinity) askedAt = clock;   /* avbrutt før spørsmålet kom: bare vent */
    if (view && (phase === "ask" || phase === "reply")) await showBubble(alive);
    else if (phase === "sleep") await play("sov");
  };

  /* Hun viskes ut og skjules. Fasen står, så hun kommer tilbake til det samme. */
  const leave = async (alive) => {
    hideBubble();
    shown = false;
    await play("forsvinn");
    if (!alive()) return;
    mas.hidden = true;
  };

  /* Trinn 2 og 3: hun viskes ut, flyttes, tegnes inn og spør */
  const ask = async (alive, n) => {
    hideBubble();
    view = null;
    if (n > 1) {
      await play("bank");
      if (!alive()) return;
    }
    await play("forsvinn");
    if (!alive()) return;
    setPlace(n > 1 && mouse ? "pointer" : "reading");
    await play("kom");
    if (!alive()) return;
    attempt = n;
    phase = "ask";
    askedAt = Infinity;
    const q = fetchQuestion(n);
    await play("spor");                    /* mens spørsmålet hentes */
    if (!alive()) return;
    view = await q;
    if (!alive()) return;
    askedAt = clock;
    if (view) await showBubble(alive);
  };

  /* Trinn 4: ut, til hjørnet, og sov */
  const sleep = async (alive) => {
    hideBubble();
    phase = "sleep";
    lagre("ferdig");
    await play("forsvinn");
    if (!alive()) return;
    setPlace("sleep");
    await play("kom");
    if (!alive()) return;
    await play("sov");
  };

  /* Ferdig for dette besøket: ut og skjult, og ingenting mer */
  const retire = (verdi) => {
    phase = "done";
    if (verdi) lagre(verdi);
    clearInterval(timer);
    go(async () => {
      hideBubble();
      if (shown) { shown = false; await play("forsvinn"); }
      mas.hidden = true;
    });
  };

  /* ── Svar, klikk og kryss ─────────────────────────────────── */
  const onAnswer = async (text) => {
    if (!view || view.mine != null) return;
    const q = view.q;
    answerBtns.forEach((b) => b.setAttribute("aria-disabled", "true"));
    view = { q, mine: text, reply: null };
    phase = "reply";
    askedAt = Infinity;
    lagre("ferdig");                       /* trappa er over, også etter en ny lasting */
    paintBubble();
    placeBubble();
    const r = await chat.ask(text, { before: [{ role: "assistant", content: q }] });
    if (phase === "done" || !view || view.mine !== text) return;
    if (!r.reply) {                        /* chatten kunne ikke svare nå: ingen boble, bare hjørnet */
      go(sleep);
      return;
    }
    view.reply = r.reply;
    askedAt = clock;
    paintBubble();
    placeBubble();
  };
  answersEl.addEventListener("click", (e) => {
    const b = e.target.closest(".mas__answer");
    if (b && view && view.mine == null) onAnswer(b.textContent);
  });

  char.addEventListener("click", () => {
    chat.open();
    retire("ferdig");
  });
  xBtn.addEventListener("click", () => retire("borte"));

  /* ── Klokka ───────────────────────────────────────────────── */
  const chatOpen = () => !!clippy && clippy.dataset.open === "true";
  const otherInView = () => (heroBtn && inView(heroBtn)) || (peekBox && inView(peekBox)) || chatOpen();
  const topOut = () => !hero || hero.getBoundingClientRect().bottom <= 0;

  let last = performance.now(), timer = 0;
  const tick = () => {
    const t = performance.now();
    const dt = Math.min(t - last, 500);    /* en fane i bakgrunnen får ikke hoppe fram i tid */
    last = t;
    if (phase === "done") return;
    if (document.hidden) return;
    if (root.dataset.motion === "off") { retire(); return; }

    /* En Bindersen om gangen: er toppfiguren, den nederst eller chatten i bildet, er hun borte */
    if (otherInView()) {
      calmFrom = 0;
      if (shown) go(leave);                /* leave setter shown til false med en gang */
      return;
    }
    if (!calmFrom) calmFrom = t;

    if (topOut()) clock += dt;
    if (busy) return;

    if (!shown) {
      if (t - calmFrom < 600) return;      /* ikke flimmer når hun står på kanten av bildet */
      if (phase === "idle") {
        if (clock < FORSTE) return;
        phase = "peek";
      }
      go(arrive);
      return;
    }
    if (phase === "peek" && clock >= SPORSMAL) go((alive) => ask(alive, attempt + 1));
    else if (phase === "ask" && clock - askedAt >= VENTE) {
      if (mouse && attempt < FORSOK) go((alive) => ask(alive, attempt + 1));
      else go(sleep);
    } else if (phase === "reply" && view && view.reply && clock - askedAt >= SVAR_VIST) go(sleep);
  };

  timer = setInterval(tick, 250);
  document.addEventListener("visibilitychange", () => { last = performance.now(); });

  /* Størrelsen på vinduet endres: sett henne ned på nytt, uten å tegne henne om */
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!shown || busy || phase === "done") return;
      setPlace(phase === "peek" ? "peek" : phase === "sleep" ? "sleep" : mouse ? "pointer" : "reading");
      placeBubble();
    });
  });
})();
