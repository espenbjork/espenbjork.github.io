/* ============================================================
   bindersen.js, livet i bindersen

   Tegningen ligger i index.html og styles.css. Her bor oppførselen:
     - pupillene følger pekeren, eller det han er opptatt av
     - han blunker når det passer ham, ikke på en fast takt
     - brynene sier hva han mener: oppmerksom, skeptisk, tenker, overrasket
     - han lener seg litt mot det han ser på

   Alt er hendelser. I ro gjør han nesten ingenting, og det er meningen:
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
    visible: false,
    cur: { px: 0, py: 0, bl: 0, br: 0, bla: 0, bra: 0, lean: 0 },
    written: {},
  }));
  if (!figures.length) return;

  /* ── Hva han ser på ───────────────────────────────────────── */
  let pointer = null;          /* { x, y, t } siste kjente pekerposisjon */
  let hold = null;             /* { el | dir, until } noe han er opptatt av en stund */
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

  /* Pek på «ubrukelige»: han har meninger om det ordet */
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

  /* ── Klikk: han gir etter litt før han svarer ─────────────── */
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

  /* ── Blikk i ro: av og til ser han på noe, så tilbake ─────── */
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
    const reach = Math.min(1, dist / (r.width * 2.4));   /* rett ved siden av ham: små utslag */
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
    if (flash && t > flash.until) flash = null;

    for (const f of figures) {
      if (!f.visible) continue;
      const g = gazeFor(f, t);
      const m = MOODS[flash ? flash.mood : mood !== "rolig" ? mood : g.near ? "oppmerksom" : "rolig"];
      const c = f.cur;
      c.px += (g.x * REACH_X - c.px) * kEye;
      c.py += (g.y * REACH_Y - c.py) * kEye;
      c.bl += (m.bl - c.bl) * kBrow;
      c.br += (m.br - c.br) * kBrow;
      c.bla += (m.bla - c.bla) * kBrow;
      c.bra += (m.bra - c.bra) * kBrow;
      c.lean += (g.x * 2.4 - c.lean) * kLean;

      set(f, f.svg, "--px", c.px + BASE_X, 2);
      set(f, f.svg, "--py", c.py + BASE_Y, 2);
      set(f, f.svg, "--bl", c.bl, 2);
      set(f, f.svg, "--br", c.br, 2);
      set(f, f.svg, "--bla", c.bla, 1);
      set(f, f.svg, "--bra", c.bra, 1);
      set(f, f.btn, "--lean", c.lean, 2);
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
