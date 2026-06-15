/* ============================================================
   main.js, grunnleggende interaksjon, helt uten avhengigheter
   ============================================================ */
(() => {
  "use strict";

  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const motionOn = root.dataset.motion !== "off" && !reduceMotion;

  /* Riktig årstall i footer */
  document.querySelectorAll("[data-year]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* Trigger inngangs-animasjoner (strek over "ubrukelige", nytteverdi-barer) */
  requestAnimationFrame(() => document.body.classList.add("is-ready"));

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
