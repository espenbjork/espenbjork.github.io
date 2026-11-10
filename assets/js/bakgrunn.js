/* ============================================================
   bakgrunn.js, disen bak arket

   Arket er ikke flatt. Bak teksten ligger en lavering: papirfargen,
   den lyseste papirfargen, og blekket og pennen tynnet ut til nesten
   ingenting. Fargene hentes fra :root i styles.css, så paletten har
   fortsatt en kilde. Ingen nye farger, bare flere trinn av de samme.

   Feltet er støy som er foldet inn i seg selv to ganger (domain
   warping), tegnet av en liten WebGL-shader. Tre ting gir dybden:
     - det driver så sakte at du ikke ser det flytte seg, bare at det
       har flyttet seg
     - det ruller saktere enn innholdet, som noe som ligger lenger bak
     - det viker en anelse for pekeren

   Dis har ingen detaljer, så den tegnes i en fjerdedel av oppløsningen
   og strekkes ut. Det koster nesten ingenting, og gir en mykere flate
   enn full oppløsning ville gjort.

   Uten WebGL eller JavaScript står den stille varianten i styles.css
   (html-bakgrunnen). Med redusert bevegelse tegnes ett bilde, og så
   ingenting mer.
   ============================================================ */
(() => {
  "use strict";

  const root = document.documentElement;
  const still =
    root.dataset.motion === "off" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const SCALE = 4;           /* tegnes i 1/4 oppløsning */
  const FRAME_MS = 50;       /* 20 bilder i sekundet holder for noe som nesten står stille */
  const DRIFT = 0.016;       /* fart på driften */

  const canvas = document.createElement("canvas");
  canvas.className = "haze";
  canvas.setAttribute("aria-hidden", "true");

  const gl = canvas.getContext("webgl", {
    alpha: false, antialias: false, depth: false, stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return;

  const VERT = `
    attribute vec2 a;
    void main(){ gl_Position = vec4(a, 0., 1.); }`;

  const FRAG = `
    precision highp float;
    uniform vec2 u_res;
    uniform float u_t, u_scroll;
    uniform vec2 u_ptr;
    uniform vec3 u_paper, u_light, u_wash, u_warm;

    float hash(vec2 p){
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float noise(vec2 p){
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3. - 2. * f);
      return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x),
                 mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
    }
    float fbm(vec2 p){
      float v = 0., a = .5;
      mat2 m = mat2(.8, .6, -.6, .8);
      for (int i = 0; i < 4; i++){ v += a * noise(p); p = m * p * 2.03 + 11.7; a *= .5; }
      return v;
    }

    /* En smal rand langs en høydekurve i feltet: der blekket tørker inn */
    float rim(float f, float at, float w){ float d = (f - at) / w; return exp(-d * d); }

    void main(){
      vec2 uv = gl_FragCoord.xy / u_res;
      vec2 base = vec2(uv.x * u_res.x / u_res.y, uv.y);

      /* Lyset kommer inn oppe til høyre: varmest der, mest blekk i motsatt hjørne */
      float sun = uv.x * .55 + uv.y * .45;

      /* ── Bakerste lag: store laveringer som nesten ikke følger med når du ruller ── */
      vec2 p = base * .78 + u_ptr * .03;
      p.y -= u_scroll * .2;

      /* Støy som forskyver støy som forskyver støy: slik blir flekker til slør */
      vec2 q = vec2(fbm(p + vec2(0., u_t * .7)),
                    fbm(p + vec2(5.2, 1.3) - u_t * .5));
      vec2 r = vec2(fbm(p + 2.1 * q + vec2(1.7, 9.2) + u_t * .35),
                    fbm(p + 2.1 * q + vec2(8.3, 2.8) - u_t * .3));
      float f = fbm(p + 2.3 * r);
      f = clamp((f - .47) * 2.1 + .5, 0., 1.);

      float wash = smoothstep(.42, .16, f) * (.5 + .5 * q.x) * mix(1., .35, sun);
      wash = min(wash + rim(f, .33, .04) * .2 * mix(1., .4, sun), 1.);

      /* Varmen: et fast feste oppe til høyre med en kant støyen river i,
         pluss flak som har løsnet og drevet innover */
      float w = sun + (r.x - .5) * .8;
      float warm = smoothstep(.6, .98, w);
      warm = max(warm, smoothstep(.5, .8, r.y) * smoothstep(.4, .7, q.y) * smoothstep(.25, .75, sun) * .8);
      warm = min(warm + rim(w, .68, .03) * .22, 1.);

      /* ── Fremste lag: et lyst slør som glir fortere forbi ── */
      vec2 n = base * 1.35 + vec2(31., 17.) + u_ptr * .09;
      n.y -= u_scroll * .55;
      float g = fbm(n + 1.7 * vec2(fbm(n + u_t * .9), fbm(n + vec2(3.1, 7.7) - u_t * .7)));
      g = clamp((g - .47) * 2.2 + .5, 0., 1.);
      float veil = smoothstep(.56, .86, g);

      vec3 c = u_paper;
      c = mix(c, u_wash, wash);        /* blekket samler seg i dalene */
      c = mix(c, u_warm, warm);        /* pennen har smittet av der lyset kommer inn */
      c = mix(c, u_light, veil * .9);  /* og foran alt ligger et lyst slør */
      gl_FragColor = vec4(c, 1.);
    }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  /* En trekant som dekker hele flaten */
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ["u_res", "u_t", "u_scroll", "u_ptr", "u_paper", "u_light", "u_wash", "u_warm"]
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

  /* ── Paletten, lest fra stilarket ─────────────────────────── */
  const css = getComputedStyle(root);
  const rgb = (name) => {
    const h = css.getPropertyValue(name).trim().replace("#", "");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  };
  const pct = (name) => parseFloat(css.getPropertyValue(name)) / 100;
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const paper = rgb("--paper");
  const wash = pct("--haze-wash"), warm = pct("--haze-warm");
  if (paper.some(Number.isNaN) || Number.isNaN(wash) || Number.isNaN(warm)) return;
  gl.uniform3fv(U.u_paper, paper);
  gl.uniform3fv(U.u_light, rgb("--paper-2"));
  gl.uniform3fv(U.u_wash, mix(paper, rgb("--brg"), wash));     /* blekk tynnet ut i papir */
  gl.uniform3fv(U.u_warm, mix(paper, rgb("--accent"), warm));  /* penn tynnet ut i papir */

  /* ── Tilstand ─────────────────────────────────────────────── */
  const seed = Math.random() * 40;       /* et nytt ark hver gang */
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let lastDraw = 0, running = false;

  const resize = () => {
    const w = Math.max(2, Math.ceil(window.innerWidth / SCALE));
    const h = Math.max(2, Math.ceil(window.innerHeight / SCALE));
    if (canvas.width === w && canvas.height === h) return false;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.u_res, w, h);
    return true;
  };

  const draw = (now) => {
    gl.uniform1f(U.u_t, seed + (still ? 0 : now * 0.001 * DRIFT));
    /* Rulling i skjermhøyder. Shaderen gir hvert lag sin andel av farten. */
    gl.uniform1f(U.u_scroll, still ? 0 : window.scrollY / window.innerHeight);
    gl.uniform2f(U.u_ptr, ptr.x, ptr.y);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    lastDraw = now;
  };

  const frame = (now) => {
    if (!running) return;
    if (now - lastDraw >= FRAME_MS) {
      ptr.x += (ptr.tx - ptr.x) * 0.06;
      ptr.y += (ptr.ty - ptr.y) * 0.06;
      draw(now);
    }
    requestAnimationFrame(frame);
  };

  const sync = () => {
    const want = !still && !document.hidden;
    if (want && !running) { running = true; requestAnimationFrame(frame); }
    else if (!want) running = false;
  };

  /* Lerretet henger på <html>, ikke <body>: da står det i ro også når
     påskeegget vipper på body. */
  resize();
  root.append(canvas);
  draw(performance.now());

  /* Et lerret som får ny størrelse, tømmes. Tegn med en gang, ellers blinker det svart. */
  window.addEventListener("resize", () => {
    if (resize()) draw(performance.now());
  });

  /* Mister nettleseren konteksten, tar den stille bakgrunnen i stilarket over */
  canvas.addEventListener("webglcontextlost", () => {
    running = false;
    canvas.remove();
  });

  if (still) return;

  window.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    ptr.tx = e.clientX / window.innerWidth - 0.5;
    ptr.ty = 0.5 - e.clientY / window.innerHeight;
  }, { passive: true });

  document.addEventListener("visibilitychange", sync);
  sync();
})();
