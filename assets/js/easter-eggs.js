/* ============================================================
   easter-eggs.js — den useriøse delen
   Skru av/på og endre innhold i CONFIG under.
   ============================================================ */
(() => {
  "use strict";

  const CONFIG = {
    enabled: document.documentElement.dataset.eggs !== "off",
    konamiClass: "konami",          // CSS-klasse som slås på når koden tastes
    konamiDurationMs: 8000,         // hvor lenge "ekstra ubrukelig"-modus varer
    consoleGreeting: true,          // hilsen i devtools-konsollen
  };

  if (!CONFIG.enabled) return;

  /* ── Konsoll-hilsen til de nysgjerrige ───────────────────── */
  if (CONFIG.consoleGreeting) {
    const big = "font:600 16px/1.4 'Space Grotesk',sans-serif;color:#bd6a39";
    const small = "color:#4c5f55";
    console.log("%cDu leser konsollen. Imponerende.", big);
    console.log("%cAlt her er bygget for hånd, med AI som medbygger. Hint: ↑ ↑ ↓ ↓ ← → ← → B A", small);
  }

  /* ── Konami-kode ─────────────────────────────────────────── */
  const SEQUENCE = [
    "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
    "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
    "b", "a",
  ];
  let pos = 0;
  let resetTimer = null;

  function triggerKonami() {
    const body = document.body;
    body.classList.add(CONFIG.konamiClass);

    // Skru alle nytteverdier opp til et helt urealistisk nivå
    const meters = document.querySelectorAll(".nytteverdi");
    const original = [];
    meters.forEach((m) => {
      const fill = m.querySelector(".nytteverdi__fill");
      const pct = m.querySelector(".nytteverdi__pct");
      original.push({ fill, fillPct: fill ? fill.style.getPropertyValue("--pct") : "", pct, text: pct ? pct.textContent : "" });
      if (fill) fill.style.setProperty("--pct", "100%");
      if (pct) pct.textContent = "100 %";
    });

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      body.classList.remove(CONFIG.konamiClass);
      original.forEach((o) => {
        if (o.fill) o.fill.style.setProperty("--pct", o.fillPct);
        if (o.pct) o.pct.textContent = o.text;
      });
    }, CONFIG.konamiDurationMs);
  }

  window.addEventListener("keydown", (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === SEQUENCE[pos]) {
      pos += 1;
      if (pos === SEQUENCE.length) {
        pos = 0;
        triggerKonami();
      }
    } else {
      // tillat at en feiltasting starter sekvensen på nytt fra første tast
      pos = key === SEQUENCE[0] ? 1 : 0;
    }
  });
})();
