/* ============================================================
   clippy.js, chatten til binders-assistenten «Bindersen»
   Åpner/lukker snakkeboblen og snakker med chat-backend-en
   (Cloudflare Worker, se github.com/espenbjork/clippy).
   API-nøkkelen ligger i Worker-en, aldri her.
   Blikk, blunk og bryn bor i bindersen.js, som lytter på hendelsen «bindersen».
   Maset (mas.js) snakker med chatten gjennom window.clippyChat: ask, open og api.
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
  const bubble = clippy.querySelector(".clippy__bubble");
  const closeBtn = clippy.querySelector(".clippy__close");
  const log = clippy.querySelector("#clippy-log");
  const form = clippy.querySelector("#clippy-form");
  const input = clippy.querySelector("#clippy-input");

  // Sier fra til bindersen.js om hva som skjer i chatten.
  const tell = (what) => document.dispatchEvent(new CustomEvent("bindersen", { detail: what }));

  function setOpen(open) {
    // Lukket boble er usynlig, og skal da heller ikke kunne nås med tastatur
    // eller leses opp. Sto fokus der inne, går det tilbake til Bindersen.
    if (bubble) {
      if (!open && char && bubble.contains(document.activeElement)) char.focus();
      bubble.inert = !open;
    }
    clippy.dataset.open = open ? "true" : "false";
    tell(open ? "open" : "close");
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

  // Escape lukker chatten.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && clippy.dataset.open === "true") setOpen(false);
  });

  // Ruller til toppen og åpner chatten der. Brukes av Bindersen nederst på siden,
  // og av følgefiguren (mas.js) via window.clippyChat.open.
  function open() {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
    let done = false;
    const go = () => { if (!done) { done = true; setOpen(true); } };
    if ("onscrollend" in window) window.addEventListener("scrollend", go, { once: true });
    setTimeout(go, smooth ? 900 : 0);
  }

  // Bindersen nederst på siden: tar deg opp til toppen og åpner chatten der.
  const peek = document.querySelector('[data-bindersen="peek"]');
  if (peek) peek.addEventListener("click", open);

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

  // Emotene som kommer med svaret. pek-* blir «pek» mot seksjonen, resten spilles som de står.
  // Finnes ikke window.bindersen (redusert bevegelse), skjer det ingenting.
  const PEK = { "pek-arbeid": "arbeid", "pek-erfaring": "erfaring", "pek-kontakt": "kontakt" };
  function playEmote(name) {
    const api = window.bindersen;
    if (!api || typeof name !== "string") return;
    if (PEK[name]) {
      const mot = document.getElementById(PEK[name]);
      if (mot) api.play("pek", { mot });
      return;
    }
    api.play(name);
  }

  // Sender en melding og venter på svaret. Felles for skjemaet og maset.
  // `before` er meldinger som skal ligge foran i samme historikk (spørsmålet hun stilte).
  async function exchange(text, before) {
    for (const m of before) {
      history.push(m);
      addMessage(m.role, m.content);
    }
    addMessage("user", text);
    history.push({ role: "user", content: text });
    persist();

    const thinking = addMessage("bot", "…");
    thinking.classList.add("is-thinking");
    tell("thinking");

    let out;
    try {
      const res = await fetch(CLIPPY_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-16) }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = (data && data.reply) || "Hmm. Tomt svar. Typisk.";
      const emote = data && typeof data.emote === "string" ? data.emote : null;
      thinking.textContent = reply;
      thinking.classList.remove("is-thinking");
      history.push({ role: "assistant", content: reply });
      persist();
      tell("reply");
      playEmote(emote);
      out = { reply, emote };
    } catch (e) {
      const reply = "Nettet svikter. Eller jeg gidder ikke. Prøv igjen.";
      thinking.textContent = reply;
      thinking.classList.remove("is-thinking");
      tell("error");
      out = { reply, emote: null, error: true };
    }
    log.scrollTop = log.scrollHeight;
    return out;
  }

  async function send(text) {
    if (busy || !text) return;
    busy = true;
    input.value = "";
    input.disabled = true;
    try {
      await exchange(text, []);
    } finally {
      busy = false;
      input.disabled = false;
      input.focus();
    }
  }

  // Maset stiller et spørsmål og sender svaret hit, uten at skjemaet er i bruk.
  // Gir { reply, emote }, eller { reply: "", emote: null, error: true } når chatten ikke kan svare nå.
  async function ask(text, opts) {
    const answer = typeof text === "string" ? text.trim() : "";
    if (!answer || busy || !CLIPPY_API) return { reply: "", emote: null, error: true };
    const before = ((opts && opts.before) || []).filter((m) =>
      m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content);
    busy = true;
    try {
      return await exchange(answer, before);
    } finally {
      busy = false;
    }
  }

  window.clippyChat = { ask, open, api: CLIPPY_API };

  if (input) input.addEventListener("input", () => tell("typing"));

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      send(input.value.trim());
    });
  }
})();
