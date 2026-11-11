/* ============================================================
   bindersen.js, livet i bindersen

   Tegningen ligger i index.html og styles.css. Her bor oppførselen:
     - pupillene følger pekeren, eller det hun er opptatt av
     - hun blunker når det passer henne, ikke på en fast takt
     - brynene sier hva hun mener: oppmerksom, skeptisk, tenker, overrasket
     - hun lener seg litt mot det hun ser på
     - og tolv emoter som andre kan be henne spille: window.bindersen.play()

   Alt er hendelser. I ro gjør hun nesten ingenting, og det er meningen:
   en figur som rører seg hele tiden i utkanten av synsfeltet, blir slitsom.

   Chatten (clippy.js) sier fra med hendelsen «bindersen» på document:
   open, close, typing, thinking, reply, error.
   ============================================================ */
(() => {
  "use strict";

  const root = document.documentElement;
  if (root.dataset.motion === "off") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  /* Hvor langt pupillene kan gå fra midten av øyet, i tegningens egne enheter */
  const REACH_X = 7, REACH_Y = 10;
  /* Pupillene er tegnet litt til høyre og ned for midten. Dette flytter nullpunktet til midten. */
  const BASE_X = -3, BASE_Y = -4;
  /* Hvilestilling: blikket litt ned mot venstre, dit overskriften står */
  const REST = { x: -0.28, y: 0.22 };

  const MOODS = {
    rolig:      { bl: 0,    br: 0,    bla: 0,  bra: 0 },
    oppmerksom: { bl: -3.5, br: -3.5, bla: 0,  bra: 0 },
    skeptisk:   { bl: -7,   br: 2.5,  bla: -9, bra: 6 },
    tenker:     { bl: 3,    br: 3,    bla: 8,  bra: -8 },
    overrasket: { bl: -8,   br: -8,   bla: -3, bra: 3 },
  };

  const figures = [...document.querySelectorAll("[data-bindersen]")].map((btn) => ({
    btn,
    kind: btn.dataset.bindersen,
    svg: btn.querySelector("svg"),
    eyes: btn.querySelector(".clippy__eyes"),
    wire: btn.querySelector(".clippy__wire"),
    face: btn.querySelector(".clippy__face"),
    visible: false,
    cur: { px: 0, py: 0, bl: 0, br: 0, bla: 0, bra: 0, lean: 0, lid: 1, dx: 0, dy: 0 },
    written: {},
    /* Emotene: hva som spiller, hva som blir stående, og tilstanden til det som ikke glir av seg selv */
    em: null,          /* emoten som spiller nå */
    stay: null,        /* kanaler som blir holdt etter at emoten er ferdig (sov) */
    gone: false,       /* viska ut (forsvinn) til kom */
    grabbed: false,    /* har emotene overtatt innskriften og ansiktet fra CSS? */
    pose: null,        /* trådens tall akkurat nå */
    dashX: 0, faceV: 1, dotV: 0,
    zs: null, zAnim: null, dot: null, len: 0, dRest: "",
  })).filter((f) => f.svg && f.eyes && f.wire && f.face);
  if (!figures.length) return;

  /* ── Hva hun ser på ───────────────────────────────────────── */
  let pointer = null;          /* { x, y, t } siste kjente pekerposisjon */
  let hold = null;             /* { el | dir, until } noe hun er opptatt av en stund */
  let mood = "rolig";          /* varig stemning (tenker, skeptisk) */
  let flash = null;            /* { mood, until } kort reaksjon */
  let sawMouse = false;

  const now = () => performance.now();
  const lookAt = (el, ms) => { if (el) hold = { el, until: now() + ms }; };
  const lookDir = (x, y, ms) => { hold = { dir: { x, y }, until: now() + ms }; };
  const react = (m, ms) => { flash = { mood: m, until: now() + ms }; };

  window.addEventListener("pointermove", (e) => {
    pointer = { x: e.clientX, y: e.clientY, t: now() };
    if (e.pointerType === "mouse") sawMouse = true;
  }, { passive: true });
  window.addEventListener("pointerdown", (e) => {
    pointer = { x: e.clientX, y: e.clientY, t: now() };
  }, { passive: true });
  document.addEventListener("mouseleave", () => { pointer = null; });

  /* Uten mus: se dit siden ruller */
  let lastScroll = window.scrollY;
  window.addEventListener("scroll", () => {
    const dy = window.scrollY - lastScroll;
    lastScroll = window.scrollY;
    if (!sawMouse && Math.abs(dy) > 2 && !(hold && hold.el)) lookDir(0, dy > 0 ? 0.9 : -0.9, 700);
  }, { passive: true });

  /* Pek på «ubrukelige»: hun har meninger om det ordet */
  const strike = document.querySelector(".hero__strike");
  if (strike) {
    strike.addEventListener("pointerenter", () => { mood = "skeptisk"; });
    strike.addEventListener("pointerleave", () => { if (mood === "skeptisk") mood = "rolig"; });
  }

  /* ── Chatten ──────────────────────────────────────────────── */
  document.addEventListener("bindersen", (e) => {
    const input = document.getElementById("clippy-input");
    const log = document.getElementById("clippy-log");
    switch (e.detail) {
      case "open":     react("overrasket", 420); lookAt(input, 1300); break;
      case "close":    if (mood === "tenker") mood = "rolig"; hold = null; break;
      case "typing":   lookAt(input, 1600); break;
      case "thinking": mood = "tenker"; lookDir(-0.6, -0.85, 60000); break;
      case "reply":
      case "error":
        mood = "rolig"; react("overrasket", 520);
        lookAt(log && log.lastElementChild, 1500);
        break;
    }
  });

  /* ── Klikk: hun gir etter litt før hun svarer ─────────────── */
  figures.forEach((f) => {
    f.btn.addEventListener("click", () => {
      if (!f.btn.animate) return;
      f.btn.animate(
        [
          { scale: "1 1" },
          { scale: "1.07 0.9", offset: 0.28 },
          { scale: "0.97 1.05", offset: 0.6 },
          { scale: "1 1" },
        ],
        { duration: 440, easing: "cubic-bezier(.3,.7,.3,1)" }
      );
    });
    f.btn.addEventListener("focus", () => react("oppmerksom", 900));
  });

  /* ── Blunk: uregelmessig, av og til dobbelt ───────────────── */
  const blink = (f) => {
    if (!f.eyes.animate) return;
    /* Eier en emote eller søvnen øyelokkene, blunker hun ikke på toppen av dem */
    if (f.gone || f.stay || (f.em && f.em.tracks.lid)) return;
    f.eyes.animate(
      [{ transform: "scaleY(1)" }, { transform: "scaleY(.05)", offset: 0.45 }, { transform: "scaleY(1)" }],
      { duration: 150, easing: "ease-in-out" }
    );
  };
  const scheduleBlink = (f, first) => {
    const wait = first != null ? first : 2400 + Math.random() * 4400;
    setTimeout(() => {
      if (f.visible && !document.hidden) {
        blink(f);
        if (Math.random() < 0.16) setTimeout(() => blink(f), 240);
      }
      scheduleBlink(f);
    }, wait);
  };

  /* ── Blikk i ro: av og til ser hun på noe, så tilbake ─────── */
  const glanceTargets = () => [
    strike,
    document.getElementById("arbeid-tittel"),
    null,                                            /* rett fram */
  ];
  const scheduleGlance = () => {
    setTimeout(() => {
      const idle = !pointer || now() - pointer.t > 5000;
      if (idle && !hold && mood === "rolig" && !document.hidden) {
        const list = glanceTargets();
        const pick = list[Math.floor(Math.random() * list.length)];
        if (pick) lookAt(pick, 900 + Math.random() * 800);
        else lookDir(0, 0, 900 + Math.random() * 600);
      }
      scheduleGlance();
    }, 6500 + Math.random() * 7000);
  };

  /* ── Emotene: hvordan de er bygget ────────────────────────────
     En emote er noen få spor, ett per kanal. Et spor er nøkkelbilder
     [ms, verdi, letting] som glir fra der kanalen står nå. Mens emoten
     spiller, eier den kanalene den har spor for (pupiller, bryn, øyelokk,
     lening, tråd). Resten går som før. Når den er ferdig, slipper den
     kanalene, og rammeløkka glir videre derfra uten et hopp.

     Tråden er 26 tall i rekkefølgen M C L C L C L. En positur er 26 nye
     tall. Vi glir mellom dem her i JavaScript og skriver d, for CSS kan
     ikke animere d i Safari. */
  const bezier = (x1, y1, x2, y2) => (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 16; i++) {
      const cx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
      if (cx < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  };
  /* Lettelsene hentes fra :root, så de følger resten av siden */
  const cssEase = (name, fallback) => {
    const nums = getComputedStyle(root).getPropertyValue(name).match(/-?\d*\.?\d+/g);
    return bezier(...(nums && nums.length === 4 ? nums.map(Number) : fallback));
  };
  const ease = cssEase("--ease", [0.22, 0.61, 0.36, 1]);
  const ink = cssEase("--ease-ink", [0.3, 0.7, 0.15, 1]);
  const lin = (x) => x;

  const lerp = (a, b, k) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : a + (b - a) * k);
  const sampleTrack = (keys, t) => {
    const end = keys[keys.length - 1];
    if (t >= end[0]) return end[1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const a = keys[i - 1], b = keys[i];
        return lerp(a[1], b[1], (b[2] || ease)((t - a[0]) / (b[0] - a[0])));
      }
    }
    return end[1];
  };

  /* Trådens hvilestilling, og hvordan en positur blir til d */
  const REST_POSE = [138, 86, 138, 55, 78, 55, 78, 86, 78, 250, 78, 285, 150, 285, 150, 250, 150, 120, 150, 92, 100, 92, 100, 120, 100, 232];
  const poseToD = (p) => {
    const q = p.map((v) => +v.toFixed(1));
    return `M${q[0]} ${q[1]}C${q.slice(2, 8).join(" ")}L${q[8]} ${q[9]}C${q.slice(10, 16).join(" ")}L${q[16]} ${q[17]}C${q.slice(18, 24).join(" ")}L${q[24]} ${q[25]}`;
  };
  const posed = (changes) => {
    const p = REST_POSE.slice();
    for (const i in changes) p.splice(+i, changes[i].length, ...changes[i]);
    return p;
  };

  /* Spørsmålstegnet. Øynene sitter inne i buen, stammen går ned under dem,
     og prikken er et eget element (.clippy__dot). */
  const QUESTION = [
    60, 104,
    60, 72, 86, 46, 118, 46,
    118, 46,
    150, 46, 176, 72, 176, 104,
    176, 112,
    176, 140, 118, 134, 118, 166,
    118, 214,
  ];
  /* Den løse enden løfter seg: litt opp og ut, og litt videre mens hun holder den der */
  const WAVE_A = posed({ 0: [152, 60, 160, 32, 80, 40, 78, 86] });
  const WAVE_B = posed({ 0: [157, 53, 168, 27, 82, 36, 78, 86] });

  const G0 = [REST.x, REST.y];
  const MOOD = (name) => { const m = MOODS[name]; return [m.bl, m.br, m.bla, m.bra]; };
  const dir = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
  const sleepyBrows = [3, 3, -4, 4];

  /* Retningen fra øynene til et element, som enhetsvektor */
  const toward = (f, el) => {
    if (!el) return [0.8, 0.6];                              /* uten mål: litt ned mot høyre */
    const a = f.eyes.getBoundingClientRect(), b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d];
  };

  /* Hver emote gir et sett spor og en varighet. Ukjente kanaler finnes ikke.
       g     blikk, -1 til 1 i hver retning
       br    bryn [venstre opp, høyre opp, venstre vinkel, høyre vinkel]
       lid   øyelokk, 1 åpen og 0 lukket
       lean  lening i grader
       dx dy hele figuren, i piksler
       wire  tråden, 26 tall
       dot   prikken til spørsmålstegnet
       dash  innskriften, brukes av forsvinn og kom
       face  ansiktet, brukes av forsvinn og kom
     stay: kanaler som blir holdt etter at emoten er ferdig. */
  const EMOTES = {
    /* Den løse enden løfter seg en gang, venter litt og går ned igjen. */
    vink: () => ({
      dur: 1400,
      tracks: { wire: [[420, WAVE_A, ink], [800, WAVE_B, lin], [1400, REST_POSE, ease]] },
    }),

    /* Lener seg mot kanten av skjermen og dunker to ganger. */
    bank: () => ({
      dur: 1300,
      tracks: {
        lean: [[300, 3.5, ease], [390, 5.5, lin], [520, 3.7, ease], [640, 5.5, lin], [760, 3.7, ease], [1300, 0, ease]],
        dx: [[300, 1, ease], [390, 3, lin], [520, 1.2, ease], [640, 3, lin], [760, 1.2, ease], [1300, 0, ease]],
        g: [[250, [0.9, 0.15], ease], [900, [0.9, 0.15], lin], [1300, G0, ease]],
      },
    }),

    /* Øynene går tre linjer nedover, hver fra venstre mot høyre. */
    les: () => ({
      dur: 1550,
      tracks: {
        g: [
          [220, [-0.75, -0.4], ease],
          [520, [0.75, -0.4], lin], [600, [-0.75, 0.05], ease],
          [900, [0.75, 0.05], lin], [980, [-0.75, 0.5], ease],
          [1280, [0.75, 0.5], lin], [1550, G0, ease],
        ],
        br: [[220, MOOD("oppmerksom"), ease], [1280, MOOD("oppmerksom"), lin], [1550, MOOD("rolig"), ease]],
      },
    }),

    /* Øyelokkene siger, blikket går ned, og et lite z tegnes. Blir til vakne eller neste emote. */
    sov: (f) => {
      zOn(f);
      return {
        dur: 1400,
        stay: ["g", "br", "lid", "dy"],
        tracks: {
          lid: [[1400, 0.14, ease]],
          br: [[1300, sleepyBrows, ease]],
          g: [[900, [0, 0.8], ease]],
          dy: [[1300, 2.5, ease]],
        },
      };
    },

    /* Opp fra sov: lokkene åpner seg, brynet er ikke begeistret. */
    vakne: () => ({
      dur: 1250,
      tracks: {
        lid: [[200, 0.14, lin], [700, 1, ease]],
        br: [[300, MOOD("skeptisk"), ease], [850, MOOD("skeptisk"), lin], [1250, MOOD("rolig"), ease]],
        g: [[500, G0, ease]],
        dy: [[500, 0, ease]],
      },
    }),

    /* Tråden bøyer seg til et spørsmålstegn, holder (hold, 1200 ms) og retter seg. */
    spor: (f, o) => {
      const H = Math.max(200, o.hold == null ? 1200 : +o.hold || 1200);
      const up = 650 + H, end = up + 600;
      return {
        dur: end,
        tracks: {
          wire: [[650, QUESTION, ink], [up, QUESTION, lin], [end, REST_POSE, ease]],
          dot: [[520, 0, lin], [760, 1, ease], [up + 100, 1, lin], [up + 360, 0, ease]],
          br: [[420, MOOD("skeptisk"), ease], [up, MOOD("skeptisk"), lin], [end, MOOD("rolig"), ease]],
          g: [[420, [0, -0.55], ease], [up, [0, -0.55], lin], [end, G0, ease]],
        },
      };
    },

    /* Ansiktet toner ut, så viskes tråden ut fra starten av, samme vei som den ble tegnet. */
    forsvinn: (f) => ({
      dur: 1200,
      tracks: {
        face: [[420, 0, ease]],
        dash: [[250, 0, lin], [1200, -(f.len + 8), ink]],
      },
    }),

    /* Tråden tegnes, så toner ansiktet inn. Fra en halvt utvisket tråd går den bare tilbake. */
    kom: (f) => {
      /* Helt utvisket står innskriften på minussiden. Plussiden ser lik ut, men derfra
         tegnes hun fra starten av tråden, slik siden åpner, og ikke baklengs. */
      if (f.dashX <= -(f.len + 4)) f.dashX = 1400;
      return {
        dur: 1400,
        tracks: {
          dash: f.dashX <= 0 ? [[800, 0, ink]] : [[1000, 1400 - f.len - 8, ink]],
          face: [[600, f.faceV, lin], [1000, 1, ease]],
        },
      };
    },

    /* Et langsomt blunk. */
    blunk: () => ({
      dur: 900,
      tracks: { lid: [[360, 0.04, ease], [470, 0.04, lin], [900, 1, ease]] },
    }),

    /* Hele figuren synker et par piksler, blir der, og kommer opp. */
    sukk: () => ({
      dur: 1400,
      tracks: {
        dy: [[450, 4, ease], [900, 4, lin], [1400, 0, ease]],
        lid: [[450, 0.62, ease], [900, 0.62, lin], [1350, 1, ease]],
        br: [[450, [2.5, 2.5, -3, 3], ease], [900, [2.5, 2.5, -3, 3], lin], [1350, MOOD("rolig"), ease]],
        g: [[400, [-0.15, 0.7], ease], [900, [-0.15, 0.7], lin], [1350, G0, ease]],
      },
    }),

    /* Pupillene i en bue opp og rundt, en gang. */
    himle: () => ({
      dur: 1400,
      tracks: {
        g: [
          [220, dir(150), ease], [380, dir(180), lin], [540, dir(225), lin],
          [700, dir(270), lin], [860, dir(315), lin], [1020, dir(360), lin],
          [1160, dir(400), ease], [1400, G0, ease],
        ],
        br: [[250, MOOD("skeptisk"), ease], [1160, MOOD("skeptisk"), lin], [1400, MOOD("rolig"), ease]],
        lid: [[280, 0.78, ease], [1160, 0.78, lin], [1400, 1, ease]],
      },
    }),

    /* Lener seg og ser mot mot, og den løse enden strekker seg dit. */
    pek: (f, o) => {
      const H = Math.max(200, o.hold == null ? 800 : +o.hold || 800);
      const mot = o.mot instanceof Element ? o.mot : null;      /* alt annet enn et element er ikke et mål */
      const [ux, uy] = toward(f, mot);
      /* Rett under henne er det ingen ende å peke med: en arm nedover blir bare en krok
         langs kroppen. Da nikker hun dit i stedet, to ganger, med blikket på målet. */
      if (mot && uy > 0.8) {
        const up = 420 + H, end = up + 450;
        lookAt(mot, up);
        return {
          dur: end,
          tracks: {
            dy: [[260, 4, ease], [420, 1.5, ease], [580, 4, ease], [up, 4, lin], [end, 0, ease]],
            lid: [[260, 0.8, ease], [up, 0.8, lin], [end, 1, ease]],
            br: [[260, MOOD("oppmerksom"), ease], [up, MOOD("oppmerksom"), lin], [end, MOOD("rolig"), ease]],
          },
        };
      }
      /* Den løse enden sitter oppe til høyre, så mål på høyre side nås derfra.
         Mål på venstre side nås fra venstre kant av sløyfa. */
      const right = ux >= 0;
      let a = Math.atan2(uy, right ? ux : -ux);               /* vinkel mot høyre, speilet hvis målet er til venstre */
      a = Math.max(-0.6, Math.min(1.2, a));
      const vx = Math.cos(a) * (right ? 1 : -1), vy = Math.sin(a);
      const root0 = right ? [138, 86] : [78, 86];
      const tip = [root0[0] + vx * 64, root0[1] + vy * 64];
      const pose = posed({ 0: [tip[0], tip[1], tip[0] - vx * 26, tip[1] - vy * 26 - 6, 78, 55, 78, 86] });
      const up = 500 + H, end = up + 500;
      const lean = (right ? 1 : -1) * 3.5;
      if (mot) lookAt(mot, up);
      return {
        dur: end,
        tracks: {
          wire: [[500, pose, ink], [up, pose, lin], [end, REST_POSE, ease]],
          lean: [[480, lean, ease], [up, lean, lin], [end, 0, ease]],
          br: [[320, MOOD("oppmerksom"), ease], [up, MOOD("oppmerksom"), lin], [end, MOOD("rolig"), ease]],
        },
      };
    },

    /* Internt, ikke i lista: stop() bruker den til å gå til hvile. */
    hvile: () => ({ dur: 1, tracks: {} }),
  };
  const NAMES = Object.keys(EMOTES).filter((n) => n !== "hvile");

  /* ── Hjelpere for emotene ─────────────────────────────────── */
  const NS = "http://www.w3.org/2000/svg";
  const make = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  };

  /* Elementene som bare emotene bruker lages her, så markupen i index.html slipper å kjenne dem */
  figures.forEach((f) => {
    f.dRest = f.wire.getAttribute("d");
    f.pose = REST_POSE;
    f.dot = make("circle", { class: "clippy__dot", cx: 118, cy: 252, r: 4.8 });
    f.zs = [
      make("path", { class: "clippy__z", d: "M166 54h13l-13 17h13", pathLength: 1 }),
      make("path", { class: "clippy__z", d: "M184 24h19l-19 25h19", pathLength: 1 }),
    ];
    f.svg.append(f.dot, ...f.zs);
  });

  /* Lengden på tråden, til innskrift og utvisking */
  const lengthOf = (f) => {
    if (!f.len) {
      try { f.len = f.wire.getTotalLength(); } catch (_) { /* faller tilbake under */ }
      if (!(f.len > 0)) f.len = 760;
    }
    return f.len;
  };

  /* CSS tegner tråden inn og tar ansiktet fram med animasjoner som blir stående.
     Skal en emote styre dem, må den overta der CSS slapp. Det skjer en gang per figur. */
  const grab = (f) => {
    if (f.grabbed) return;
    const cs = getComputedStyle(f.wire);
    const dash = parseFloat(cs.strokeDashoffset);
    lengthOf(f);
    f.grabbed = true;
    f.dashX = Number.isFinite(dash) ? dash : 0;
    f.faceV = parseFloat(getComputedStyle(f.face).opacity);
    if (!Number.isFinite(f.faceV)) f.faceV = 1;
    f.wire.style.animation = "none";
    f.wire.style.strokeDasharray = "1400";
    f.wire.style.strokeDashoffset = String(f.dashX);
    f.face.style.animation = "none";
    f.face.style.opacity = String(f.faceV);
  };

  /* Z-ene: tegnes, driver litt opp og bort, og kommer igjen så lenge hun sover */
  const zOn = (f) => {
    if (f.zAnim || !f.zs[0].animate) return;
    f.zAnim = f.zs.map((z, i) => z.animate(
      [
        { opacity: 0, strokeDashoffset: 1, transform: "translate(0px,0px)", offset: 0 },
        { opacity: 1, strokeDashoffset: 0, offset: 0.24 },
        { opacity: 1, transform: "translate(4px,-10px)", offset: 0.72 },
        { opacity: 0, strokeDashoffset: 0, transform: "translate(8px,-18px)", offset: 1 },
      ],
      { duration: 3800, delay: 900 + i * 1500, iterations: Infinity, easing: "ease-out" }
    ));
  };
  const zOff = (f) => {
    if (!f.zAnim) return;
    const old = f.zAnim;
    f.zAnim = null;
    f.zs.forEach((z, i) => {
      const out = z.animate([{ opacity: getComputedStyle(z).opacity }, { opacity: 0 }], { duration: 240, fill: "forwards" });
      out.onfinish = () => { old[i].cancel(); out.cancel(); };
    });
  };

  /* Hva en kanal står på nå, som første nøkkelbilde i sporet */
  const current = (f, ch) => {
    const c = f.cur;
    switch (ch) {
      case "g":    return [c.px / REACH_X, c.py / REACH_Y];
      case "br":   return [c.bl, c.br, c.bla, c.bra];
      case "wire": return f.pose;
      case "dash": return f.dashX;
      case "face": return f.faceV;
      case "dot":  return f.dotV;
      default:     return c[ch];
    }
  };

  /* Verdiene emoten eier akkurat nå, pluss det som blir stående fra før */
  const ownedAt = (f, t) => {
    const em = f.em;
    if (!em) return f.stay;
    const k = Math.max(0, t - em.t0);
    const out = f.stay ? { ...f.stay } : {};
    for (const ch in em.tracks) out[ch] = sampleTrack(em.tracks[ch], k);
    return out;
  };

  /* Skriver det som ikke går via rammeløkkas kanaler: tråden, innskriften, ansiktet, prikken */
  const paint = (f, o) => {
    if (o.wire) {
      const d = o.wire === REST_POSE ? f.dRest : poseToD(o.wire);
      f.pose = o.wire;
      if (f.written.d !== d) { f.written.d = d; f.wire.setAttribute("d", d); }
    }
    if (o.dash !== undefined) {
      f.dashX = o.dash;
      const s = String(+o.dash.toFixed(1));
      if (f.written.dash !== s) { f.written.dash = s; f.wire.style.strokeDashoffset = s; }
    }
    if (o.face !== undefined) {
      f.faceV = o.face;
      const s = String(+o.face.toFixed(3));
      if (f.written.face !== s) { f.written.face = s; f.face.style.opacity = s; }
    }
    if (o.dot !== undefined) {
      f.dotV = o.dot;
      const s = o.dot.toFixed(3);
      if (f.written.dot !== s) {
        f.written.dot = s;
        f.dot.style.opacity = s;
        f.dot.style.transform = `scale(${(0.4 + 0.6 * o.dot).toFixed(3)})`;
      }
    }
  };

  /* Emoten er ferdig: skriv sluttilstanden (også om figuren er utenfor skjermen), slipp kanalene, løs løftet */
  const finish = (f, em) => {
    if (f.em !== em) return;
    f.em = null;
    clearTimeout(em.timer);
    const end = {};
    for (const ch in em.tracks) { const k = em.tracks[ch]; end[ch] = k[k.length - 1][1]; }
    if (end.dash !== undefined && end.dash >= 0) end.dash = 0;
    paint(f, { wire: end.wire, dash: end.dash, face: end.face, dot: end.dot });
    if (em.stay) { f.stay = {}; em.stay.forEach((ch) => { f.stay[ch] = end[ch]; }); }
    em.resolve();
  };

  /* Det som ikke glir av seg selv, må ikke bli stående når en emote avbrytes: gli det hjem */
  const settleTracks = (f, tracks) => {
    let dur = 0;
    const add = (ch, ms, value) => { tracks[ch] = [[ms, value, ease]]; dur = Math.max(dur, ms); };
    if (!tracks.wire && f.pose !== REST_POSE) add("wire", 360, REST_POSE);
    if (!tracks.dot && f.dotV > 0) add("dot", 260, 0);
    if (f.grabbed && !tracks.dash && f.dashX !== 0) add("dash", 360, 0);
    if (f.grabbed && !tracks.face && f.faceV !== 1) add("face", 260, 1);
    return dur;
  };

  const begin = (f, name, valg) => {
    if (f.gone && name !== "kom") return Promise.resolve();
    if (f.em) { const old = f.em; f.em = null; clearTimeout(old.timer); old.resolve(); }
    f.stay = null;
    if (name !== "sov") zOff(f);
    if (name === "forsvinn" || name === "kom") { grab(f); lengthOf(f); }
    if (name === "forsvinn") f.gone = true;
    if (name === "kom") f.gone = false;

    const spec = EMOTES[name](f, valg);
    /* Sporene starter der kanalen står nå, så ingenting hopper. Det emoten ikke selv rydder, glir hjem. */
    const wanted = { ...spec.tracks };
    const dur = Math.max(spec.dur, settleTracks(f, wanted));
    const tracks = {};
    for (const ch in wanted) tracks[ch] = [[0, current(f, ch)], ...wanted[ch]];

    return new Promise((resolve) => {
      const em = { name, t0: now(), dur, tracks, stay: spec.stay, resolve, timer: 0 };
      f.em = em;
      /* Står figuren utenfor skjermen, går ikke rammeløkka. Da avslutter vi på klokka. */
      em.timer = setTimeout(() => finish(f, em), dur + 150);
    });
  };

  const pickFigure = (valg) => {
    const byKind = (k) => figures.find((f) => f.kind === k);
    if (valg.figur) return byKind(valg.figur);
    const folge = byKind("folge");
    if (folge && folge.visible) return folge;
    return byKind("hero") || figures[0];
  };

  const play = (navn, valg) => {
    try {
      if (typeof navn !== "string" || !Object.prototype.hasOwnProperty.call(EMOTES, navn) || navn === "hvile") return Promise.resolve();
      const opts = valg && typeof valg === "object" ? valg : {};
      const f = pickFigure(opts);
      return f ? begin(f, navn, opts) : Promise.resolve();
    } catch (err) {
      console.warn("bindersen.play:", err);
      return Promise.resolve();
    }
  };

  const stop = () => {
    figures.forEach((f) => {
      try {
        if (f.gone) { begin(f, "kom", {}); return; }
        const off = f.em || f.stay || f.pose !== REST_POSE || f.dotV > 0 || f.zAnim ||
          (f.grabbed && (f.dashX !== 0 || f.faceV !== 1));
        if (off) begin(f, "hvile", {});
      } catch (err) {
        console.warn("bindersen.stop:", err);
      }
    });
  };

  window.bindersen = { play, stop, emotes: NAMES };

  /* ── Hver ramme: finn målet, gli mot det ──────────────────── */
  const gazeFor = (f, t) => {
    const r = f.eyes.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let point = null;

    if (hold && t < hold.until) {
      if (hold.dir) return { x: hold.dir.x, y: hold.dir.y, near: false };
      const hr = hold.el.getBoundingClientRect();
      point = { x: hr.left + hr.width / 2, y: hr.top + hr.height / 2 };
    } else {
      if (hold) hold = null;
      if (pointer && t - pointer.t < (sawMouse ? 5000 : 2200)) point = pointer;
    }
    if (!point) return { x: REST.x, y: REST.y, near: false };

    const dx = point.x - cx, dy = point.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, dist / (r.width * 2.4));   /* rett ved siden av henne: små utslag */
    return { x: (dx / dist) * reach, y: (dy / dist) * reach, near: point === pointer && dist < r.width * 2 };
  };

  const set = (f, el, name, value, digits) => {
    const s = value.toFixed(digits);
    if (f.written[name] === s) return;
    f.written[name] = s;
    el.style.setProperty(name, s);
  };

  let last = 0, running = false;
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min(t - (last || t), 50);
    last = t;
    const kEye = 1 - Math.exp(-dt / 70);
    const kBrow = 1 - Math.exp(-dt / 115);
    const kLean = 1 - Math.exp(-dt / 280);
    const kLid = 1 - Math.exp(-dt / 90);
    if (flash && t > flash.until) flash = null;

    for (const f of figures) {
      if (!f.visible) continue;
      const o = f.em || f.stay ? ownedAt(f, t) : null;
      const c = f.cur;

      /* Eier en emote blikket, trenger vi ikke spørre hvor hun ser */
      const g = o && o.g ? null : gazeFor(f, t);
      if (g) {
        c.px += (g.x * REACH_X - c.px) * kEye;
        c.py += (g.y * REACH_Y - c.py) * kEye;
      } else {
        c.px = o.g[0] * REACH_X;
        c.py = o.g[1] * REACH_Y;
      }

      if (o && o.br) {
        [c.bl, c.br, c.bla, c.bra] = o.br;
      } else {
        const m = MOODS[flash ? flash.mood : mood !== "rolig" ? mood : g && g.near ? "oppmerksom" : "rolig"];
        c.bl += (m.bl - c.bl) * kBrow;
        c.br += (m.br - c.br) * kBrow;
        c.bla += (m.bla - c.bla) * kBrow;
        c.bra += (m.bra - c.bra) * kBrow;
      }

      if (o && o.lean !== undefined) c.lean = o.lean;
      else c.lean += ((g ? g.x * 2.4 : 0) - c.lean) * kLean;

      if (o && o.lid !== undefined) c.lid = o.lid;
      else c.lid += (1 - c.lid) * kLid;
      if (o && o.dx !== undefined) c.dx = o.dx;
      else c.dx += (0 - c.dx) * kBrow;
      if (o && o.dy !== undefined) c.dy = o.dy;
      else c.dy += (0 - c.dy) * kBrow;

      set(f, f.svg, "--px", c.px + BASE_X, 2);
      set(f, f.svg, "--py", c.py + BASE_Y, 2);
      set(f, f.svg, "--bl", c.bl, 2);
      set(f, f.svg, "--br", c.br, 2);
      set(f, f.svg, "--bla", c.bla, 1);
      set(f, f.svg, "--bra", c.bra, 1);
      set(f, f.svg, "--lid", c.lid, 2);
      set(f, f.svg, "--dx", c.dx, 1);
      set(f, f.svg, "--dy", c.dy, 1);
      set(f, f.btn, "--lean", c.lean, 2);

      if (f.em) {
        paint(f, o);
        if (t >= f.em.t0 + f.em.dur) finish(f, f.em);
      }
    }
    requestAnimationFrame(frame);
  };

  const sync = () => {
    const want = !document.hidden && figures.some((f) => f.visible);
    if (want && !running) { running = true; last = 0; requestAnimationFrame(frame); }
    else if (!want) running = false;
  };
  document.addEventListener("visibilitychange", sync);

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const f = figures.find((x) => x.btn === entry.target);
        if (f) f.visible = entry.isIntersecting;
      });
      sync();
    }, { rootMargin: "80px" });
    figures.forEach((f) => io.observe(f.btn));
  } else {
    figures.forEach((f) => { f.visible = true; });
    sync();
  }

  /* ── Oppvåkning: tegnes, blunker, kaster et blikk på streken ─ */
  figures.forEach((f) => scheduleBlink(f, f.kind === "hero" ? 2300 : 1500 + Math.random() * 2000));
  setTimeout(() => { if (!pointer) lookAt(strike, 1200); }, 2700);
  scheduleGlance();
})();
