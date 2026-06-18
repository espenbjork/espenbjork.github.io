/* ============================================================
   main.js, grunnleggende interaksjon, helt uten avhengigheter
   ============================================================ */
(() => {
  "use strict";

  /* Safari gjenoppretter ellers gammel scroll-posisjon og hopper til bunnen. Start alltid på topp. */
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  if (!location.hash) window.scrollTo(0, 0);

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionOn = root.dataset.motion !== "off" && !reduceMotion;

  /* Riktig årstall i footer */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* Trigger inngangs-animasjoner (strek over "ubrukelige", nytteverdi-barer) */
  requestAnimationFrame(() => document.body.classList.add("is-ready"));

  /* ── Prosjekt-karusell ──────────────────────────────────────────
     Sporet (.cards) scroller sidelengs av seg selv (touch + tastatur).
     Her legger vi på desktop-piler, kant-toning og knapp-tilstand når
     det faktisk finnes mer å bla til. */
  document.querySelectorAll("[data-carousel]").forEach((carousel) => {
    const track = carousel.querySelector(".cards");
    if (!track) return;
    const section = carousel.closest("section") || document;
    const nav = section.querySelector("[data-carousel-nav]");
    const btnPrev = nav && nav.querySelector('[data-dir="prev"]');
    const btnNext = nav && nav.querySelector('[data-dir="next"]');

    /* Bla ~én kolonne om gangen, men aldri mindre enn 60 % av synlig bredde */
    const step = () => {
      const card = track.querySelector(".card");
      const gap = parseFloat(getComputedStyle(track).columnGap) || 24;
      const col = card ? card.getBoundingClientRect().width + gap : track.clientWidth * 0.8;
      return Math.max(col, track.clientWidth * 0.6);
    };

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      const x = track.scrollLeft;
      const more = max > 4;
      carousel.classList.toggle("can-left", more && x > 4);
      carousel.classList.toggle("can-right", more && x < max - 4);
      if (nav) nav.hidden = !more;
      if (btnPrev) btnPrev.disabled = x <= 4;
      if (btnNext) btnNext.disabled = x >= max - 4;
    };

    const go = (dir) =>
      track.scrollBy({ left: dir * step(), behavior: motionOn ? "smooth" : "auto" });

    if (btnPrev) btnPrev.addEventListener("click", () => go(-1));
    if (btnNext) btnNext.addEventListener("click", () => go(1));
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("load", update);   /* mål på nytt når bildene er inne */
    update();
  });

  /* Reveal-on-scroll: marker seksjoner og kort, animer dem inn når de er synlige */
  const revealTargets = document.querySelectorAll(
    ".section__head, .cards > li, .timeline__item, .section--contact > *"
  );

  if (!motionOn || !("IntersectionObserver" in window)) {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  revealTargets.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i % 8, 6) * 60}ms`;
  });

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.1 }
  );

  revealTargets.forEach((el) => io.observe(el));
})();
