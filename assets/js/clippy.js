/* ============================================================
   clippy.js — binders-assistenten "Bindersen"
   Åpner/lukker snakkeboblen og snakker med chat-backend-en
   (Cloudflare Worker, se github.com/espenbjork/clippy).
   API-nøkkelen ligger i Worker-en, aldri her.
   ============================================================ */
(() => {
  "use strict";

  // ── Lim inn Worker-URL-en her etter `npx wrangler deploy` (se clippy-repoet).
  //    Tom streng = chat av: boblen viser bare en hilsen. Ingenting er ødelagt.
  const CLIPPY_API = "https://clippy-chat.dreampodcast.workers.dev";

  // Samtalen overlever sidelast i samme fane, og tømmes når fanen lukkes.
  const STORE_KEY = "clippy-chat";

  const clippy = document.getElementById("clippy");
  if (!clippy) return;

  const char = clippy.querySelector(".clippy__char");
  const closeBtn = clippy.querySelector(".clippy__close");
  const log = clippy.querySelector("#clippy-log");
  const form = clippy.querySelector("#clippy-form");
  const input = clippy.querySelector("#clippy-input");

  function setOpen(open) {
    clippy.dataset.open = open ? "true" : "false";
    if (char) char.setAttribute("aria-expanded", open ? "true" : "false");
    if (open && CLIPPY_API && input) setTimeout(() => input.focus(), 60);
  }

  // Klikk på Clippy åpner (eller lukker) chatten.
  if (char) {
    char.addEventListener("click", () => setOpen(clippy.dataset.open !== "true"));
  }
  if (closeBtn) {
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(false);
    });
  }

  // ── Chat ──────────────────────────────────────────────────
  const history = []; // { role: "user" | "assistant", content }
  let busy = false;

  function addMessage(role, text) {
    const p = document.createElement("p");
    p.className = "clippy__msg clippy__msg--" + (role === "user" ? "me" : "bot");
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
    return p;
  }

  function persist() {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(history)); } catch (e) {}
  }

  // Hilsen først, så eventuell tidligere samtale fra denne sesjonen.
  if (!CLIPPY_API) {
    addMessage("bot", "Snart kan jeg svare på ordentlig. Jobber med saken.");
    if (form) form.hidden = true;
  } else {
    addMessage("bot", "Spør i vei. Jeg svarer, motvillig.");
    let saved = [];
    try { saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]"); } catch (e) {}
    if (Array.isArray(saved)) {
      for (const m of saved) {
        if (m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string") {
          history.push(m);
          addMessage(m.role, m.content);
        }
      }
    }
  }

  async function send(text) {
    if (busy || !text) return;
    busy = true;

    addMessage("user", text);
    history.push({ role: "user", content: text });
    persist();
    input.value = "";
    input.disabled = true;

    const thinking = addMessage("bot", "…");
    thinking.classList.add("is-thinking");

    try {
      const res = await fetch(CLIPPY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-16) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = (data && data.reply) || "Hmm. Tomt svar. Typisk.";
      thinking.textContent = reply;
      thinking.classList.remove("is-thinking");
      history.push({ role: "assistant", content: reply });
      persist();
    } catch (e) {
      thinking.textContent = "Nettet svikter. Eller jeg gidder ikke. Prøv igjen.";
      thinking.classList.remove("is-thinking");
    } finally {
      busy = false;
      input.disabled = false;
      input.focus();
      log.scrollTop = log.scrollHeight;
    }
  }

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      send(input.value.trim());
    });
  }
})();
