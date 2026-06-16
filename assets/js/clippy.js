/* ============================================================
   clippy.js — binders-assistenten
   Foreløpig: åpne/lukke snakkeboblen. Senere: faktisk chat
   (krever en backend, så API-nøkkelen ikke ligger i klienten).
   ============================================================ */
(() => {
  "use strict";

  const clippy = document.getElementById("clippy");
  if (!clippy) return;

  const char = clippy.querySelector(".clippy__char");
  const closeBtn = clippy.querySelector(".clippy__close");

  function setOpen(open) {
    clippy.dataset.open = open ? "true" : "false";
    if (char) char.setAttribute("aria-expanded", open ? "true" : "false");
  }

  if (char) {
    char.addEventListener("click", () => setOpen(clippy.dataset.open !== "true"));
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(false);
    });
  }

  // Klikker man en snarvei, navigerer man uansett — lukk boblen.
  clippy.querySelectorAll(".clippy__chip").forEach((chip) => {
    chip.addEventListener("click", () => setOpen(false));
  });
})();
