/* ============================================================
   main.js, sidens egne bevegelser, helt uten avhengigheter

   Regelen: tekst står i ro, streker tegnes. Derfor finnes det ingen
   «tone inn ved rulling» her. Det som skjer er:
     - streken over «ubrukelige» (og igjen når du peker på ordet)
     - skillelinjer som tegnes når de kommer til syne ([data-ink])
     - karusellen, som kan blas med piler og dras med mus
   ============================================================ */
(() => {
  "use strict";

  /* Safari gjenoppretter ellers gammel scroll-posisjon og hopper til bunnen. Start alltid på topp. */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionOn = root.dataset.motion !== "off" && !reduceMotion;

  /* Starter tegningen: headerstrek, binders, strek over «ubrukelige» */
  requestAnimationFrame(() => document.body.classList.add("is-ready"));

  /* ── Streken over «ubrukelige» tegnes på nytt når du peker på ordet ── */
  const strike = document.querySelector(".hero__strike");
  if (strike && motionOn) {
    strike.addEventListener("pointerenter", (e) => {
      if (e.pointerType !== "mouse") return;
      strike.classList.remove("is-again");
      void strike.offsetWidth;                 /* start animasjonen forfra */
      strike.classList.add("is-again");
    });
  }

  /* ── Streker som tegnes når de kommer til syne ─────────────────── */
  const inkTargets = document.querySelectorAll(".timeline__item, [data-ink]");
  if (!motionOn || !("IntersectionObserver" in window)) {
    inkTargets.forEach((el) => el.classList.add("is-inked"));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        let n = 0;                             /* de som kommer samtidig, tegnes etter tur */
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.style.setProperty("--d", `${n++ * 110}ms`);
          entry.target.classList.add("is-inked");
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0 }
    );
    inkTargets.forEach((el) => io.observe(el));
  }

  /* ── Prosjekt-karusell ──────────────────────────────────────────
     Sporet (.cards) scroller sidelengs av seg selv (touch, styreflate,
     tastatur). Her legges det på piler, kant-toning og dra-med-mus. */
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector(".cards");
    if (!track) return;
    const section = carousel.closest("section") || document;
    const nav = section.querySelector("[data-carousel-nav]");
    const btnPrev = nav && nav.querySelector('[data-dir="prev"]');
    const btnNext = nav && nav.querySelector('[data-dir="next"]');

    /* Bredden på en kolonne, inkludert mellomrommet */
    const column = () => {
      const card = track.querySelector(".card");
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      return card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
    };
    const maxScroll = () => track.scrollWidth - track.clientWidth;

    const update = () => {
      const max = maxScroll();
      const x = track.scrollLeft;
      const more = max > 4;
      carousel.classList.toggle("can-left", more && x > 4);
      carousel.classList.toggle("can-right", more && x < max - 4);
      if (nav) nav.hidden = !more;
      if (btnPrev) btnPrev.disabled = x <= 4;
      if (btnNext) btnNext.disabled = x >= max - 4;
    };

    /* Pilene blar så mange hele kolonner som får plass, minst en */
    const go = (dir) => {
      const col = column();
      const cols = Math.max(1, Math.floor((track.clientWidth + 8) / col));
      track.scrollBy({ left: dir * cols * col, behavior: motionOn ? "smooth" : "auto" });
    };

    if (btnPrev) btnPrev.addEventListener("click", () => go(-1));
    if (btnNext) btnNext.addEventListener("click", () => go(1));
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);   /* mål på nytt når bildene er inne */
    update();

    /* ── Dra med mus ──────────────────────────────────────────────
       Sporet følger hånda, glir videre med farten du slapp med, og
       legger seg til rette på nærmeste kolonne. Touch og styreflate
       har dette fra før, så det gjelder bare mus. */
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    track.classList.add("is-grabbable");
    track.addEventListener("dragstart", (e) => e.preventDefault());

    let down = false, dragging = false, moved = false;
    let startX = 0, startLeft = 0, lastX = 0, lastT = 0, v = 0, raf = 0, settleTimer = 0;

    const settle = () => {
      const col = column();
      const target = Math.min(maxScroll(), Math.max(0, Math.round(track.scrollLeft / col) * col));
      track.scrollTo({ left: target, behavior: motionOn ? "smooth" : "auto" });
      clearTimeout(settleTimer);
      settleTimer = setTimeout(() => track.classList.remove("is-gliding"), 520);
    };

    const glide = () => {
      let prev = performance.now();
      const tick = (now) => {
        const dt = Math.min(now - prev, 34);
        prev = now;
        track.scrollLeft += v * dt;
        v *= Math.exp(-dt / 320);
        const atEdge = track.scrollLeft <= 0 || track.scrollLeft >= maxScroll();
        if (Math.abs(v) > 0.03 && !atEdge) raf = requestAnimationFrame(tick);
        else settle();
      };
      raf = requestAnimationFrame(tick);
    };

    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      down = true; dragging = false; moved = false;
      startX = lastX = e.clientX; startLeft = track.scrollLeft; lastT = e.timeStamp; v = 0;
      cancelAnimationFrame(raf);
      clearTimeout(settleTimer);
    });

    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (!dragging) {
        if (Math.abs(dx) < 6) return;
        dragging = moved = true;
        track.classList.add("is-dragging", "is-gliding");
      }
      track.scrollLeft = startLeft - dx;
      const dt = e.timeStamp - lastT;
      if (dt > 0) v = 0.75 * (-(e.clientX - lastX) / dt) + 0.25 * v;   /* px per ms, i scroll-retning */
      lastX = e.clientX; lastT = e.timeStamp;
    });

    const release = (e) => {
      if (!down) return;
      down = false;
      if (!dragging) return;
      dragging = false;
      track.classList.remove("is-dragging");
      if (e.timeStamp - lastT > 90) v = 0;     /* hånda sto stille før den slapp */
      v = Math.max(-2.2, Math.min(2.2, v));    /* et kast skal ikke sende deg til enden */
      if (motionOn && Math.abs(v) > 0.05) glide();
      else settle();
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);

    /* Et drag skal ikke ende som et klikk på kortet du slapp over */
    track.addEventListener("click", (e) => {
      if (!moved) return;
      moved = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
  });
})();
