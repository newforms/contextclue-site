// THROWAWAY RENDER. The card geometry is a direct port of Shared/FrameRenderer.swift's Layout,
// drawn in the same 1280×720 space and scaled with the preview, as the real frame is.
// Motion: everything moves on one curve (--expand in window.css, from Cue/Motion.swift). Nothing is
// redrawn from scratch; elements are kept and moved, so every change can travel.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ---------- Where the visitor is, without asking ----------
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles";
  const zoneCity = (zone.split("/").pop() || "Los Angeles").replace(/_/g, " ");
  // Which scale "Automatic" means, as the app's TemperatureScale.preferred() decides it: from the
  // region, not the time zone. Fahrenheit where the region measures temperature that way (CLDR's
  // list, which macOS follows): US, Bahamas, Belize, Cayman Islands, Puerto Rico, Palau. With no
  // region in the browser's language, the time zone is the fallback guess.
  const region = (() => { try { return new Intl.Locale(navigator.language).maximize().region; } catch { return null; } })();
  const zoneGuessF = /^America\/(?!Argentina|Sao_Paulo|Bogota|Lima|Santiago|Caracas|Mexico_City|Toronto|Montreal|Vancouver|Halifax|Winnipeg|Edmonton|Regina)/.test(zone);
  const preferredUnit = region ? (["US", "BS", "BZ", "KY", "PR", "PW"].includes(region) ? "F" : "C") : (zoneGuessF ? "F" : "C");

  const state = {
    theme: siteTheme.initial,   // the system's, or the choice made earlier in this visit (theme.js)
    running: true, paused: false, source: "demo",
    clock: true,
    // Starts at the region's default: a browser can't see the Mac's own 24-hour switch (Timo's Mac
    // has it on with region en_US, and both Chrome and Safari report 12-hour). The checkbox drives
    // the card and the menu bar clock alike (Timo's choice, 2026-10-13).
    h24: /h2[34]/.test(Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle || ""),
    location: true, locAuto: true, place: zoneCity, locText: "",
    weather: true,
    // Temperature (app build 191): Automatic / Celsius / Fahrenheit, and whether to name the scale.
    // Automatic with the letter is the default, as in the app.
    tempChoice: "automatic", namesScale: true,
    drink: true, beverage: "coffee", count: 1, customDrink: "",
    mood: true, moodKey: "smooth", moodCustom: "",
    layout: "default", top: false, horizontal: "trailing",
    showReason: true, reasonKey: "eating", variant: "Tacos", reasonCustom: "",
  };

  const drinks = {
    coffee:   { label: "Cups", one: "1 Cup",       many: n => `${n} Cups`,       icon: "coffee-cup" },
    matcha:   { label: "Cups", one: "1 Matcha",    many: n => `${n} Matchas`,    icon: "coffee-cup" },
    redBull:  { label: "Cans", one: "1 Red Bull",  many: n => `${n} Red Bulls`,  icon: "drop-fill" },
    dietCoke: { label: "Cans", one: "1 Diet Coke", many: n => `${n} Diet Cokes`, icon: "drop-fill" },
    custom:   { label: "Count", icon: "drop-fill" },
  };
  const moods = { ready: "Ready to go", email: "Which email?", swamped: "Swamped", smooth: "Smooth Sailing" };
  const reasons = [
    { id: "eating", emoji: "🍽️", label: "Eating", variants: [["Tacos", "🌮"], ["Lunch", "🥪"], ["Ramen", "🍜"], ["Salad", "🥗"]] },
    { id: "door", emoji: "📦", label: "Getting the door", variants: [] },
    { id: "kids", emoji: "🧒", label: "Kids", variants: [] },
    { id: "coffee", emoji: "☕", label: "Making coffee", variants: [] },
    { id: "back", emoji: "👋", label: "Back in a minute", variants: [] },
    { id: "custom", emoji: "💬", label: "Custom…", variants: [] },
  ];
  const aspect = { "location-fill": 232 / 230, "coffee-cup": 300 / 224, "drop-fill": 170 / 230, "apple-meditate": 242 / 226,
                   "sun-max-fill": 1, "moon-stars-fill": 222 / 242 };

  function demoWeather(now) {
    const night = now.getHours() < 6 || now.getHours() >= 20;
    const c = 14 + ((zoneCity.length * 7) % 12);
    const unit = state.tempChoice === "celsius" ? "C" : state.tempChoice === "fahrenheit" ? "F" : preferredUnit;
    const degrees = unit === "F" ? Math.round(c * 9 / 5 + 32) : c;
    const temp = state.namesScale ? `${degrees}°${unit}` : `${degrees}°`;   // WeatherObservation.reading
    return { text: `${temp} Clear`, icon: night ? "moon-stars-fill" : "sun-max-fill" };
  }

  const q = new URLSearchParams(location.search);   // render-only switches: ?theme=&layout=&paused=1&scale=0.8
  // The pared-back site (Timo, 2026-10-17; the menu bar version is in spike-snapshot-2026-10-17-menubar/):
  // a flat background, a floating nav bar, the icon and name, the app window or (phones) one card. On
  // phones the document scrolls, so Safari's bars take the page colour.
  document.documentElement.classList.add("pared");
  document.querySelector("meta[name=viewport]").content += ", viewport-fit=cover";
  // The name fades into the nav bar once the page title has scrolled up under it, and on desktop also
  // while the window is centred over the title (Timo, 2026-10-17). Phones scroll the document, desktop
  // scrolls #page; setFocus() calls this too.
  function showNavTitle() {
    const under = $("#heroTitle").getBoundingClientRect().bottom < $("#menubar").getBoundingClientRect().bottom;
    $(".nav-title").classList.toggle("shown", under || $("#page").classList.contains("focus"));
  }
  addEventListener("scroll", showNavTitle, { passive: true }); $("#page").addEventListener("scroll", showNavTitle, { passive: true });
  addEventListener("resize", showNavTitle); addEventListener("load", showNavTitle); setTimeout(showNavTitle);   // after fit() has made the layout

  // ---------- Measuring ----------
  const measurer = document.createElement("canvas").getContext("2d");
  const rounded = getComputedStyle(document.documentElement).getPropertyValue("--font-rounded") || "ui-rounded, system-ui";
  const widthOf = (t, font) => { measurer.font = font; return measurer.measureText(t).width; };
  const cardText = (t, size) => widthOf(t, `600 ${size}px ${rounded}`);
  const uiText = (t, size = 13) => widthOf(t, `${size}px system-ui, -apple-system, sans-serif`);

  // ---------- Controls ----------
  $("#placeSelect").innerHTML = `<option>${zoneCity}</option>`;
  for (const sel of $$(".temp-select")) sel.options[0].text = `Automatic (°${preferredUnit})`;
  for (const sel of $$(".reason-select")) sel.innerHTML = reasons.map(r => `<option value="${r.id}">${r.label}</option>`).join("");

  // Wrap things that appear and disappear, so they can grow into place (see .cy/.cx in window.css)
  for (const el of $$("[data-anim]")) {
    const y = el.dataset.anim === "y";
    const wrap = document.createElement(y ? "div" : "span"), clip = document.createElement(y ? "div" : "span");
    wrap.className = y ? "cy" : "cx"; clip.className = "reveal";
    wrap.dataset.show = el.dataset.show; delete el.dataset.show;
    el.replaceWith(wrap); clip.append(el); wrap.append(clip);
  }
  // Sections: options sit in a collapsing container
  for (const body of $$(".section-body")) {
    const wrap = document.createElement("div"), clip = document.createElement("div");
    wrap.className = "expander"; clip.className = "reveal";
    body.replaceWith(wrap); clip.append(body); wrap.append(clip);
  }

  function syncVariants() {
    const r = reasons.find(r => r.id === state.reasonKey);
    if (r.variants.length) {
      for (const sel of $$(".variant-select")) sel.innerHTML = r.variants.map(([t]) => `<option>${t}</option>`).join("");
      if (!r.variants.some(([t]) => t === state.variant)) state.variant = r.variants[0][0];
      for (const sel of $$(".variant-select")) sel.value = state.variant;
    } // without variants the old options stay, so the popup can shrink away showing its last value
  }

  for (const el of $$("[data-bind]")) {
    const key = el.dataset.bind;
    el.addEventListener(el.type === "text" ? "input" : "change", () => {
      if (el.type === "checkbox") state[key] = el.checked;
      else if (key === "count") state.count = Math.max(0, Math.min(99, parseInt(el.value, 10) || 0));
      else state[key] = el.value;
      if (key === "reasonKey") syncVariants();
      if (key === "source") setSource(el.value);
      render();
    });
  }
  for (const r of $$("input[name=edge], input[name=edge2]")) r.addEventListener("change", () => { state.top = r.value === "top"; render(); });
  for (const b of $$("[data-step]")) b.addEventListener("click", () => {
    state.count = Math.max(0, Math.min(99, state.count + Number(b.dataset.step))); render();
  });
  $("#pauseButton").addEventListener("click", () => setPaused(!state.paused));
  $("#stopButton").addEventListener("click", () => {
    state.running = !state.running;
    if (!state.running) { state.paused = false; stopStream(); } else if (state.source !== "demo") setSource(state.source);
    render();
  });
  function shows(expr) {
    if (expr === "hasVariants") return reasons.find(r => r.id === state.reasonKey).variants.length > 0;
    let m;
    if ((m = expr.match(/^(\w+)(==|!=)(\w+)$/))) return (state[m[1]] === m[3]) === (m[2] === "==");
    if (expr.startsWith("!")) return !state[expr.slice(1)];
    return !!state[expr];
  }

  // A pop-up button is as wide as its widest choice, as a .fixedSize() Picker (NSPopUpButton) is in
  // the app, so choosing doesn't change its width. It only changes when its list does (the variant
  // pop-up, between reasons), and then it animates.
  function sizePopup(sel) {
    const widest = Math.max(0, ...[...sel.options].map(o => uiText(o.text)));
    sel.style.width = `${Math.ceil(widest + 42)}px`;
  }

  function writeControls() {
    for (const el of $$("[data-bind]")) {
      const key = el.dataset.bind;
      if (el.type === "checkbox") el.checked = !!state[key];
      else if (document.activeElement !== el) el.value = state[key];
    }
    for (const r of $$("input[name=edge], input[name=edge2]")) r.checked = (r.value === "top") === state.top;
    for (const el of $$("[data-show]")) el.classList.toggle("open", shows(el.dataset.show));
    for (const s of $$(".section")) s.classList.toggle("off", !state[s.dataset.key]);
    for (const el of $$(".count-label")) el.textContent = drinks[state.beverage].label;
    // the checkbox names the letter of the chosen scale
    const unitNow = state.tempChoice === "celsius" ? "C" : state.tempChoice === "fahrenheit" ? "F" : preferredUnit;
    for (const el of $$(".scale-label")) el.textContent = `Show °${unitNow}`;
    for (const sel of $$(".popup select")) sizePopup(sel);
  }

  // ---------- Video source ----------
  // The picker reads like the app's camera menu (Timo, 2026-10-17): "Demo feed", then the visitor's
  // cameras by name. A browser only tells a page its cameras' names once camera access has been allowed,
  // so until then the second entry is "Your camera"; after that it lists every camera by its real name
  // ("FaceTime HD Camera", "Studio Display Camera"…). Values: "demo", "camera" (no access yet), or
  // "camera:" + the browser's id for that camera.
  let stream = null;
  async function setSource(source) {
    state.source = source;
    if (source === "demo") { stopStream(); render(); return; }
    try {
      stopStream();
      const id = source.startsWith("camera:") ? source.slice(7) : null;
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, ...(id && { deviceId: { exact: id } }) }, audio: false });
      const v = $("#camVideo"); v.srcObject = stream; await v.play();
      const v2 = $(".mb-cam"); v2.srcObject = stream; v2.play().catch(() => {});
      await listCameras(stream.getVideoTracks()[0]?.getSettings().deviceId);
    } catch (e) {
      state.source = "demo"; $("#statusMeta").textContent = "Camera not available";
    }
    render();
  }
  async function listCameras(activeId) {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === "videoinput" && d.deviceId);
    if (!cams.length) return;
    const options = [`<option value="demo">Demo feed</option>`, ...cams.map((c, i) => {
      const name = (c.label || `Camera ${i + 1}`).replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)$/i, "").replace(/[<&]/g, ch => ch === "<" ? "&lt;" : "&amp;");   // Chrome adds a USB id, "(05ac:1112)"
      return `<option value="camera:${c.deviceId}">${name}</option>`;
    })];
    for (const sel of $$('select[data-bind="source"]')) sel.innerHTML = options.join("");
    if (activeId) state.source = `camera:${activeId}`;
  }
  function stopStream() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } }

  // ---------- Pause: freeze a frame, blur and enlarge it, keep the card going ----------
  function setPaused(paused) {
    if (paused) {
      const c = $("#frozen"), g = c.getContext("2d");
      const src = state.source !== "demo" ? $("#camVideo") : $("#demoImage");
      const sw = src.videoWidth || src.naturalWidth, sh = src.videoHeight || src.naturalHeight;
      const fill = Math.max(1280 / sw, 720 / sh);
      g.save(); g.clearRect(0, 0, 1280, 720);
      if (state.source !== "demo") { g.translate(1280, 0); g.scale(-1, 1); }
      g.drawImage(src, (1280 - sw * fill) / 2, (720 - sh * fill) / 2, sw * fill, sh * fill);
      g.restore();
      const g2 = $("#mbFrozen").getContext("2d"); g2.clearRect(0, 0, 1280, 720); g2.drawImage(c, 0, 0);
    }
    state.paused = paused; render();
  }

  // ---------- The card: computed as a list of placed pieces, then reconciled ----------
  const ASC = 0.952, DESC = 0.241, CAP = 0.705;   // SF Pro Rounded, per em
  const L = { padding: 26, lonely: 14, trailingExtra: 4, columnGap: 30, lineSpacing: 6, rowGap: 10, tierGap: 14,
              glyphGap: 10, glyphH: 21, slot: 29, margin: 40, clock: 58, small: 23, compactPadding: 34,
              reason: 22, discInset: 0.125, gap: 14, reasonTrailing: 26 };
  const line = (key, text, size, glyph) => ({ key, text, size, glyph, w: cardText(text, size), h: size * (ASC + DESC) });

  function clockText(now) {
    let h = now.getHours(); const m = String(now.getMinutes()).padStart(2, "0");
    if (state.h24) return `${String(h).padStart(2, "0")}:${m}`;
    h = h % 12 || 12; return `${h}:${m}`;
  }
  function parts(now) {
    const d = drinks[state.beverage];
    return {
      clock: state.clock ? clockText(now) : null,
      location: state.location ? ((state.locAuto ? state.place : state.locText.trim()) || "Location") : null,
      weather: state.weather ? demoWeather(now) : null,
      drink: state.drink ? (state.beverage === "custom"
        ? (state.customDrink.trim() ? `${state.count} ${state.customDrink.trim()}` : null)
        : (state.count === 1 ? d.one : d.many(state.count))) : null,
      mood: state.mood ? (state.moodKey === "custom" ? state.moodCustom.trim() || null : moods[state.moodKey]) : null,
    };
  }
  const cardX = width => state.horizontal === "leading" ? L.margin
    : state.horizontal === "center" ? Math.round((1280 - width) / 2) : 1280 - L.margin - width;

  function planDefault(p) {
    const items = [];
    if (p.location) items.push(line("location", p.location, L.small, "location-fill"));
    if (p.weather) items.push(line("weather", p.weather.text, L.small, p.weather.icon));
    if (p.drink) items.push(line("drink", p.drink, L.small, drinks[state.beverage].icon));
    if (p.mood) items.push(line("mood", p.mood, L.small, "apple-meditate"));
    const plan = { clock: p.clock ? line("clock", p.clock, L.clock) : null, column: items.slice(0, 2), bottom: items.slice(2) };
    if (!plan.clock && !items.length) return null;

    const itemW = i => L.slot + L.glyphGap + i.w;
    const columnWidth = Math.max(0, ...plan.column.map(itemW));
    const columnHeight = plan.column.reduce((s, i) => s + i.h, 0) + L.lineSpacing * Math.max(0, plan.column.length - 1);
    const clockWidth = plan.clock ? plan.clock.w : 0;
    const columnOffset = !plan.clock ? 0 : Math.max(clockWidth, plan.bottom.length > 1 ? itemW(plan.bottom[0]) : 0) + L.columnGap;
    const bottomOffsets = [];
    { let flow = 0; plan.bottom.forEach((it, i) => { const s = i === 1 ? Math.max(columnOffset, flow) : flow; bottomOffsets.push(s); flow = s + itemW(it) + L.columnGap; }); }
    const topWidth = !plan.clock ? columnWidth : (plan.column.length ? columnOffset + columnWidth : clockWidth);
    const topHeight = Math.max(plan.clock ? plan.clock.h : 0, columnHeight);
    let bottomWidth, bottomHeight;
    if (!plan.clock) {
      bottomWidth = Math.max(0, ...plan.bottom.map(itemW));
      bottomHeight = plan.bottom.reduce((s, i) => s + i.h, 0) + L.lineSpacing * Math.max(0, plan.bottom.length - 1) + (L.tierGap - L.rowGap);
    } else {
      bottomWidth = Math.max(0, ...plan.bottom.map((it, i) => bottomOffsets[i] + itemW(it)));
      bottomHeight = Math.max(0, ...plan.bottom.map(i => i.h));
    }
    const contentWidth = Math.max(topWidth, bottomWidth);
    const contentHeight = topHeight + (plan.bottom.length ? L.rowGap + bottomHeight : 0);
    const extra = plan.column.length === 1 && !plan.bottom.length ? L.lonely : 0;
    const W = Math.round(contentWidth + L.padding * 2 + extra + L.trailingExtra);
    const H = Math.round(contentHeight + L.padding * 2);

    const pieces = [];
    const text = (it, x, y) => pieces.push({ key: `d-${it.key}`, kind: "text", text: it.text, x, y, size: it.size, lh: it.h });
    const item = (it, slotLeft, top) => {
      const gw = L.glyphH * (aspect[it.glyph] || 1);
      pieces.push({ key: `d-${it.key}-g`, kind: "glyph", src: it.glyph, x: slotLeft + (L.slot - gw) / 2, y: top + it.size * ASC - it.size * CAP / 2 - L.glyphH / 2, w: gw });
      text(it, slotLeft + L.slot + L.glyphGap, top);
    };
    if (plan.clock) text(plan.clock, L.padding, L.padding + (topHeight - plan.clock.h) / 2);
    let y = L.padding + (topHeight - columnHeight) / 2;
    const columnX = L.padding + columnOffset;
    for (const it of plan.column) { item(it, columnX, y); y += it.h + L.lineSpacing; }
    if (plan.bottom.length) {
      if (!plan.clock) { y += L.tierGap - L.lineSpacing; for (const it of plan.bottom) { item(it, columnX, y); y += it.h + L.lineSpacing; } }
      else plan.bottom.forEach((it, i) => item(it, L.padding + bottomOffsets[i], H - L.padding - bottomHeight));
    }
    return { x: cardX(W), y: state.top ? L.margin : 720 - L.margin - H, w: W, h: H, r: Math.min(34, H / 2), pieces };
  }

  function planCompact(p) {
    // Text only, as FrameRenderer's compact strip draws it. **Laid out as one line, drawn as
    // pieces**, as compactGeometry() does: the whole strip is set once (dots are " · ", half white,
    // 3 px extra spacing), then each part and dot is placed where that line puts it, so the spacing
    // is the one-line strip's while each piece can still move on its own (B57). Placing pieces by
    // measuring them separately lost the dots' spaces: a line of its own drops them (2026-10-13).
    const parts = [["clock", p.clock], ["location", p.location], ["weather", p.weather && p.weather.text], ["drink", p.drink], ["mood", p.mood]].filter(([, t]) => t);
    if (!parts.length) return null;
    const h = L.small * (ASC + DESC), H = Math.round(h + L.padding * 2), y = (H - h) / 2;
    const esc = t => t.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const DOT = `<span class="cc-sep"> · </span>`;
    const keys = [];
    let html = "";
    parts.forEach(([id, text], i) => {
      if (i > 0) { keys.push([`c-dot-${id}`, DOT]); html += `<span data-k="${keys.length - 1}">${DOT}</span>`; }
      keys.push([`c-${id}`, esc(text)]); html += `<span data-k="${keys.length - 1}">${esc(text)}</span>`;
    });
    const m = $("#ccMeasure"); m.style.fontSize = `${L.small}px`; m.innerHTML = html;
    const pieces = [...m.children].map(span => {
      const [key, inner] = keys[+span.dataset.k];
      return { key, kind: "html", html: inner, x: L.compactPadding + span.offsetLeft, y, size: L.small, lh: h };
    });
    const W = Math.round(m.offsetWidth + L.compactPadding * 2);
    return { x: cardX(W), y: state.top ? L.margin : 720 - L.margin - H, w: W, h: H, r: H / 2, pieces };
  }

  // ---------- Card motion: a port of FrameRenderer.CardTransition (B57) ----------
  // One move takes 0.4 s on a critically damped spring (6.64 is where it is within 1% of rest).
  //  · a piece in both layouts slides from where it is to where it goes
  //  · a piece that leaves fades out over the first 25% of the move; one that arrives fades in over
  //    the last 40%, once its room has opened. Both ride with the card (they are positioned inside
  //    it, from its top-left corner), as the renderer carries them.
  //  · when a part leaves a compact strip that stays a strip, everything that moves waits until it
  //    has faded (the first 25%), or the gap closes straight through it.
  // Text always comes from the new layout, so a changed value shows at once. Drawn frame by frame
  // rather than with CSS transitions, so a move interrupted by another starts from where things are.
  const MOVE = 400;
  const spring = t => { if (t >= 1) return 1; const x = 6.64 * t; return 1 - (1 + x) * Math.exp(-x); };
  const fadeOut = p => Math.max(0, 1 - p / 0.25), fadeIn = p => Math.min(1, Math.max(0, (p - 0.6) / 0.4));
  // One engine per preview: the window's, and the menu bar popover's. Each keeps its own pieces and
  // its own clock, and both are given every change, so they move in step.
  function createCardView(layer) {
    const cardEl = Object.assign(document.createElement("div"), { className: "cc-card" });
    cardEl.style.opacity = 0;
    const pieces = new Map();   // key → { el, x, y, o, from, to, role }
    let card = null, cardFrom = null, cardTo = null, cardO = 0, cardOFrom = 0, cardOTo = 0, moveStart = 0, hold = false, moveFrame = 0;

    function makePiece(pc) {
      const el = document.createElement(pc.kind === "glyph" ? "img" : "div");
      el.className = pc.kind === "glyph" ? "cc-glyph" : "cc-line";
      if (pc.kind === "glyph") el.alt = "";
      cardEl.append(el);
      return el;
    }
    function dress(el, pc) {
      // The card's icons are the app's own artwork, SF Symbols exported to PNG (cue/Shared/Icons): on the
      // site they stand in for a screenshot of the app, so the card looks as it really does. Timo's call,
      // 2026-10-17, knowing the SF Symbols licence is written for apps: if Apple objects, they change.
      if (pc.kind === "glyph") { const src = `img/${pc.src}.png`; if (!el.src.endsWith(src)) el.src = src; el.style.width = `${pc.w}px`; }
      else {
        if (pc.kind === "html") { if (el.innerHTML !== pc.html) el.innerHTML = pc.html; } else if (el.textContent !== pc.text) el.textContent = pc.text;
        el.style.fontSize = `${pc.size}px`; el.style.lineHeight = `${pc.lh}px`;
      }
    }
    function paintCard() {
      if (!card) return;
      Object.assign(cardEl.style, { left: `${card.x}px`, top: `${card.y}px`, width: `${card.w}px`, height: `${card.h}px`, borderRadius: `${card.r}px`, opacity: cardO });
      for (const pc of pieces.values()) Object.assign(pc.el.style, { left: `${pc.x}px`, top: `${pc.y}px`, opacity: pc.o });
    }
    function stepCard(now) {
      const t = (now - moveStart) / MOVE, p = spring(Math.min(1, t));
      const moved = hold ? Math.max(0, (p - 0.25) / 0.75) : p;
      const mix = (a, b, k) => a + (b - a) * k;
      if (cardFrom && cardTo) card = { x: mix(cardFrom.x, cardTo.x, moved), y: mix(cardFrom.y, cardTo.y, moved), w: mix(cardFrom.w, cardTo.w, moved), h: mix(cardFrom.h, cardTo.h, moved), r: mix(cardFrom.r, cardTo.r, moved) };
      cardO = mix(cardOFrom, cardOTo, p);
      for (const [key, pc] of pieces) {
        if (pc.role === "stay") { pc.x = mix(pc.from.x, pc.to.x, moved); pc.y = mix(pc.from.y, pc.to.y, moved); pc.o = mix(pc.from.o, 1, p); }
        else if (pc.role === "arrive") pc.o = Math.max(pc.from.o, fadeIn(p));
        else if (pc.role === "leave") { pc.o = pc.from.o * fadeOut(p); if (t >= 1) { pc.el.remove(); pieces.delete(key); } }
      }
      paintCard();
      if (t < 1 && !document.hidden) moveFrame = requestAnimationFrame(stepCard);
      else if (t < 1) { moveStart = -1e9; stepCard(performance.now()); }   // no frames in a background tab: settle
    }

    function drawCard(spec) {
      if (!cardEl.parentNode) layer.append(cardEl);
      cancelAnimationFrame(moveFrame);
      const first = !card;
      // Where everything is now (mid-move or settled) is where the next move starts
      cardFrom = card ? { ...card } : spec && { x: spec.x, y: spec.y, w: spec.w, h: spec.h, r: spec.r };
      cardOFrom = cardO;
      if (!spec) { cardTo = cardFrom; cardOTo = 0; for (const pc of pieces.values()) { pc.from = { x: pc.x, y: pc.y, o: pc.o }; pc.to = pc.from; if (pc.role === "leave") continue; pc.role = "stay"; } }
      else {
        cardTo = { x: spec.x, y: spec.y, w: spec.w, h: spec.h, r: spec.r }; cardOTo = 1;
        const strip = k => k.startsWith("c-");
        const live = new Set(spec.pieces.map(pc => pc.key));
        const stayingStrip = spec.pieces.some(pc => strip(pc.key) && pieces.has(pc.key) && pieces.get(pc.key).role !== "leave");
        hold = stayingStrip && [...pieces.entries()].some(([k, pc]) => strip(k) && pc.role !== "leave" && !live.has(k));
        for (const pc of spec.pieces) {
          let cur = pieces.get(pc.key);
          if (!cur) { cur = { el: makePiece(pc), x: pc.x, y: pc.y, o: 0, role: "arrive" }; pieces.set(pc.key, cur); }
          else cur.role = cur.role === "leave" ? "arrive" : "stay";
          dress(cur.el, pc);
          if (cur.role === "arrive") { cur.x = pc.x; cur.y = pc.y; }
          cur.from = { x: cur.x, y: cur.y, o: cur.o }; cur.to = { x: pc.x, y: pc.y };
          if (first) { cur.role = "stay"; cur.o = cur.from.o = 1; }
        }
        for (const [k, cur] of pieces) if (!live.has(k)) { cur.role = "leave"; cur.from = { x: cur.x, y: cur.y, o: cur.o }; }
      }
      if (first && spec) { card = { ...cardTo }; cardO = cardOFrom = 0; }   // a card that appears fades in where it is
      // On the first paint (no-motion is set while the page settles) everything is simply in place
      moveStart = document.documentElement.classList.contains("no-motion") ? -1e9 : performance.now();
      stepCard(moveStart);
    }
    return { draw: drawCard };
  }
  const cardViews = [createCardView($("#cardLayer")), createCardView($("#mbCardLayer"))];
  const drawCard = spec => { for (const v of cardViews) v.draw(spec); };

  // ---------- Pause badge: a port of FrameRenderer.drawPauseBadge, drawn on a canvas ----------
  // State is { width, reveal }: reveal 0 is the bare dark disc with the pause bars, 1 the pill with
  // emoji and reason. A change of reason morphs between states over badgeMorph (0.42 s, ease-in-out).
  // On the way the plate dips below both of its sizes and swaps identity at the bottom of the dip;
  // the text keys off reveal, so it arrives late and leaves early. Comments in the Swift explain why.
  const B = { morph: 0.42, dip: 0.18, swapWindow: 0.16, textHold: 0.45, emojiShare: 0.51 };
  const easeInOut = t => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = t => { t = Math.max(0, Math.min(1, t)); return 1 - Math.pow(1 - t, 3); };
  const badgeCanvas = document.createElement("canvas"); badgeCanvas.className = "cc-badge-canvas";
  const bg = badgeCanvas.getContext("2d");
  const DPR = 2;   // drawn at twice the stage's resolution, so it stays sharp when the preview is large
  badgeCanvas.width = 1280 * DPR; badgeCanvas.height = 720 * DPR;
  let badgeFrom = null, badgeTo = null, badgeAt = 0, badgeContent = { text: "", emoji: null }, wasPaused = false, badgeFrame = 0;

  function badgeTarget() {
    const H = Math.round(L.small * (ASC + DESC) + L.padding * 2), inset = Math.round(H * L.discInset);
    const r = reasons.find(r => r.id === state.reasonKey);
    const variant = r.variants.find(([t]) => t === state.variant);
    const text = !state.showReason ? "" : state.reasonKey === "custom" ? state.reasonCustom.trim()
      : r.label + (variant ? " " + variant[0].toLowerCase() : "");
    const emoji = state.reasonKey === "custom" ? null : (variant ? variant[1] : r.emoji);
    const width = text ? inset + (H - inset * 2) + L.gap + cardText(text, L.reason) + L.reasonTrailing : H;
    return { width, reveal: text ? 1 : 0, text, emoji, H, inset };
  }
  const badgeNow = now => {
    if (!badgeFrom) return badgeTo;
    const t = easeInOut((now - badgeAt) / 1000 / B.morph);
    return { width: badgeFrom.width + (badgeTo.width - badgeFrom.width) * t, reveal: badgeFrom.reveal + (badgeTo.reveal - badgeFrom.reveal) * t, done: t >= 1 };
  };

  function paintBadge(st, H, inset, text, emoji) {
    const ink = "rgb(9 14 19)";
    bg.setTransform(DPR, 0, 0, DPR, 0, 0); bg.clearRect(0, 0, 1280, 720);
    const x0 = Math.round((1280 - st.width) / 2), y0 = Math.round((720 - H) / 2);
    bg.translate(x0, y0);
    const pillR = Math.min(st.width, H) / 2;
    const slot = { x: inset * st.reveal, y: inset * st.reveal, w: H - inset * 2 * st.reveal };
    const dip = H * B.dip * Math.sin(Math.PI * st.reveal);
    const d = Math.max(1, slot.w - dip), cx = slot.x + slot.w / 2, cy = slot.y + slot.w / 2;
    const swap = easeInOut((st.reveal - (0.5 - B.swapWindow / 2)) / B.swapWindow);
    const round = (w, h, r) => { bg.beginPath(); bg.roundRect(0, 0, w, h, r); };
    if (st.reveal > 0) { bg.fillStyle = `rgb(255 255 255 / ${0.82 * easeOut(st.reveal)})`; round(st.width, H, pillR); bg.fill(); }
    const disc = alpha => { bg.fillStyle = alpha; bg.beginPath(); bg.arc(cx, cy, d / 2, 0, Math.PI * 2); bg.fill(); };
    disc(`rgb(9 14 19 / ${0.82 * (1 - swap)})`); disc(`rgb(0 0 0 / ${0.06 * swap})`);
    const bars = colour => {
      const bh = Math.round(d * 0.30), bw = Math.round(d * 0.085), gap = Math.round(d * 0.075), left = cx - bw - gap / 2;
      bg.fillStyle = colour;
      for (const x of [left, left + bw + gap]) { bg.beginPath(); bg.roundRect(x, cy - bh / 2, bw, bh, bw / 2); bg.fill(); }
    };
    if (emoji) {
      if (swap < 1) bars(`rgb(255 255 255 / ${1 - swap})`);
      if (swap > 0) { bg.globalAlpha = swap; bg.fillStyle = "#000"; /* Chrome applies the fill's alpha to colour emoji */ bg.font = `${Math.round(d * B.emojiShare)}px "Apple Color Emoji", system-ui`; bg.textAlign = "center"; bg.textBaseline = "middle"; bg.fillText(emoji, cx, cy + 1); bg.globalAlpha = 1; }
    } else { bars(`rgb(255 255 255 / ${1 - swap})`); bars(`rgb(9 14 19 / ${swap})`); }
    if (text) {
      const appearing = easeInOut((st.reveal - B.textHold) / (1 - B.textHold));
      if (appearing > 0) {
        bg.save(); round(st.width, H, pillR); bg.clip();
        bg.globalAlpha = appearing; bg.fillStyle = ink; bg.font = `600 ${L.reason}px ${rounded}`; bg.textAlign = "left"; bg.textBaseline = "alphabetic";
        bg.fillText(text, cx + d / 2 + L.gap - (1 - appearing) * H * 0.25, H / 2 + (L.reason * CAP) / 2);
        bg.restore();
      }
    }
    bg.setTransform(1, 0, 0, 1, 0, 0);
    mirrorBadge();
  }
  // The popover's preview shows the same badge: copied from the window's canvas each frame
  const badgeMirror = document.createElement("canvas"); badgeMirror.className = "cc-badge-canvas";
  badgeMirror.width = 1280 * DPR; badgeMirror.height = 720 * DPR;
  function mirrorBadge() {
    if (!badgeMirror.parentNode) $("#mbBadgeLayer").append(badgeMirror);
    const g = badgeMirror.getContext("2d"); g.clearRect(0, 0, badgeMirror.width, badgeMirror.height); g.drawImage(badgeCanvas, 0, 0);
  }

  function drawBadge() {
    if (!badgeCanvas.parentNode) $("#badgeLayer").append(badgeCanvas);
    const tgt = badgeTarget();
    for (const el of $$(".emoji-button")) el.textContent = tgt.emoji || "💬";
    if (state.paused && !wasPaused) { badgeFrom = null; badgeTo = tgt; }          // a new pause starts settled
    else if (state.paused && (tgt.width !== badgeTo.width || tgt.reveal !== badgeTo.reveal)) {
      const now = performance.now(); badgeFrom = { ...badgeNow(now) }; badgeTo = tgt; badgeAt = now;
    }
    // While the reveal is above 0 the old text keeps drawing as it leaves; it changes only on arrival
    if (state.paused && (tgt.text || !badgeTo.text)) badgeContent = { text: tgt.text || badgeContent.text, emoji: tgt.emoji };
    if (state.paused) badgeContent.emoji = tgt.emoji;
    wasPaused = state.paused;
    if (!badgeTo) return;   // never paused yet: nothing to draw
    cancelAnimationFrame(badgeFrame);
    const tick = () => {
      const st = badgeNow(performance.now());
      paintBadge(st, tgt.H, tgt.inset, st.reveal > 0 ? badgeContent.text : "", badgeContent.emoji);
      if (!st.done && badgeFrom && !document.hidden) badgeFrame = requestAnimationFrame(tick);
    };
    tick();
    if (document.hidden && badgeFrom) { badgeFrom = null; paintBadge(badgeTo, tgt.H, tgt.inset, badgeTo.text, badgeTo.emoji); }  // no frames in a background tab: settle
  }

  // ---------- Render ----------
  const ICON = {
    videoSlash: "M3.3 2.3 21.7 20.7l-1.4 1.4-3.3-3.3H5.5A2.5 2.5 0 0 1 3 16.3v-9c0-.6.2-1.2.6-1.6L1.9 3.7zM8.2 5H14a2.5 2.5 0 0 1 2.5 2.5v7l-1.9-1.9zM17.5 10l3.2-2.3c.6-.4 1.3 0 1.3.7v7.2c0 .7-.7 1.1-1.3.7l-3.2-2.3z",
    video: "M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5zM17.5 10l3.2-2.3c.6-.4 1.3 0 1.3.7v7.2c0 .7-.7 1.1-1.3.7L17.5 14z",
    pause: "M5 3h4.5v18H5zM14.5 3H19v18h-4.5z",
    play: "M6 3.5v17c0 .8.9 1.3 1.6.8l13-8.5c.6-.4.6-1.2 0-1.6l-13-8.5C6.9 2.2 6 2.7 6 3.5z",
  };

  function render() {
    $("#desktop").dataset.theme = state.theme;
    document.documentElement.dataset.theme = state.theme;   // the page background follows (window.css)
    drawWallpaper();
    writeControls();
    const now = new Date();

    for (const stage of [$("#stage"), $("#mbStage")]) {
      stage.classList.toggle("paused", state.paused);
      stage.classList.toggle("stopped", !state.running);
    }
    for (const el of [$("#camVideo"), $(".mb-cam")]) el.style.opacity = state.source !== "demo" ? 1 : 0;
    for (const el of [$("#demoImage"), $(".mb-demo")]) el.style.opacity = state.source !== "demo" ? 0 : 1;
    $("#mbNameTag").textContent = state.source !== "demo" ? "You" : "Timo Kuhn";
    // the name sits bottom-left as meeting apps put it, unless the card is there; then bottom-right
    $("#mbNameTag").classList.toggle("right", !state.top && state.horizontal === "leading");

    $("#statusDot").style.background = !state.running ? "var(--label-3)" : state.paused ? "var(--color-sys-orange)" : "var(--color-sys-green)";
    const status = !state.running ? "Camera off" : state.paused ? "Camera paused" : "Camera on";
    $("#statusText").textContent = status; $("#statusText").style.width = `${Math.ceil(widthOf(status, getComputedStyle($("#statusText")).font))}px`;  // its own font: phones set it larger
    if (state.running && !/not available/.test($("#statusMeta").textContent)) $("#statusMeta").textContent = "720p · 30 fps";
    const stopText = state.running ? "Stop Camera" : "Start Camera";
    $("#stopLabel").textContent = stopText; $("#stopButton").style.width = `${Math.ceil(uiText(stopText) + 41)}px`;
    $("#stopIcon").setAttribute("d", state.running ? ICON.videoSlash : ICON.video);
    const pauseText = state.paused ? "Resume" : "Pause";
    $("#pauseLabel").textContent = pauseText; $("#pauseButton").style.width = `${Math.ceil(uiText(pauseText) + 38)}px`;
    $("#pauseIcon").setAttribute("d", state.paused ? ICON.play : ICON.pause);
    $("#pauseButton").classList.toggle("resume", state.paused);
    $("#reasonRow").classList.toggle("open", state.paused);
    // the popover's status row, as MenuBarView words it
    $(".mb-dot").style.background = $("#statusDot").style.background;
    $(".mb-status-text").textContent = status;
    $(".mb-stop-label").textContent = state.running ? "Stop" : "Start";
    $(".mb-stop-icon").setAttribute("d", state.running ? ICON.videoSlash : ICON.video);
    $(".mb-pause").style.display = state.running ? "" : "none";
    $(".mb-pause-label").textContent = pauseText;
    $(".mb-pause-icon").setAttribute("d", state.paused ? ICON.play : ICON.pause);
    $(".mb-pause").classList.toggle("resume", state.paused);

    const p = parts(now);
    drawCard(state.layout === "compact" ? planCompact(p) : planDefault(p));
    drawBadge();

    const mbClock = state.h24 ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
      : now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hourCycle: "h12" });
    const mc = $("#menubarClock"); mc.textContent = mbClock;
    mc.style.width = `${Math.ceil(widthOf(mbClock, `${getComputedStyle(mc).fontWeight} ${getComputedStyle(mc).fontSize} system-ui, -apple-system, sans-serif`))}px`;
    // The mark: pill at the card's corner (MarkView.origin), filled while the camera runs
    const px_ = state.horizontal === "leading" ? 8 : state.horizontal === "center" ? (52 - 16) / 2 : 52 - 8 - 16;
    const py_ = state.top ? 8 : 39 - 8 - 8;
    for (const pill of $$(".mark-pill")) pill.style.transform = `translate(${px_}px, ${py_}px)`;
    $(".mark").classList.toggle("live", state.running);
    fit();
  }

  // Scale the stage to the preview, and the window to the screen. Three stages as the screen shrinks:
  //  1. Big screens: the window at real size (1.0), as the app would look there.
  //  2. Laptops: the whole UI shrinks, down to SCALE_FLOOR, keeping the window within COMFORT of the
  //     space below the menu bar. (A 13" MacBook Air lands on 0.8, which Timo liked, 2026-10-11.)
  //  3. Smaller: the window itself gets smaller, like resizing the app: the video column narrows to
  //     the app's 920 minimum and the window gets shorter, the sidebar scrolling. Only past that
  //     does everything shrink again, with a small margin.
  const COMFORT = 0.85, SCALE_FLOOR = 0.8, MAX_W = 1440, MIN_W = 920, MIN_H = 560, TIGHT = 32;
  let naturalH = 0;   // what the window needs with everything showing; measured once it is laid out
  // Phones: below MOBILE_MAX the page reflows (window.css .mobile) and nothing is scaled or placed
  const MOBILE_MAX = 700;
  const isMobile = () => innerWidth < MOBILE_MAX;
  function fit() {
    const w = $("#window"), area = $("#stageArea");
    $("#desktop").classList.toggle("mobile", isMobile());
    if (isMobile()) { $("#stage").style.transform = `scale(${$("#preview").clientWidth / 1280})`; return; }
    $("#desktop").classList.remove("sheet-open");
    const aw = area.clientWidth, ah = area.clientHeight;
    const scaleStage = () => { $("#stage").style.transform = `scale(${$("#preview").clientWidth / 1280})`; };
    if (!naturalH) { scaleStage(); return; }
    const forced = Number(q.get("scale"));
    let s = forced || Math.max(SCALE_FLOOR, Math.min(1, COMFORT * aw / MAX_W, COMFORT * ah / naturalH));
    const width = Math.max(MIN_W, Math.min(MAX_W, COMFORT * aw / s));
    const height = Math.max(MIN_H, Math.min(naturalH, COMFORT * ah / s));
    w.style.width = `${width}px`; w.style.height = `${height}px`;
    s = Math.min(s, (aw - TIGHT) / width, (ah - TIGHT) / height);
    geo = { width, height, s, aw, ah };
    w.dataset.fit = `${s.toFixed(3)} ${Math.round(width)}x${Math.round(height)}`;
    scaleStage();   // after the window has its new size, so the video follows it
    // the nav bar spans the centred window (Timo, 2026-10-17): its left edge and width, for window.css
    const f = focusAt(), a = area.getBoundingClientRect(), desk = $("#desktop").style;
    desk.setProperty("--content-left", `${a.left + f.x}px`); desk.setProperty("--content-w", `${geo.width * f.s}px`);
    placeWindow(!placed);
    if (typeof placeClose === "function") placeClose();
  }

  // ---------- The menu bar item's popover ----------
  // Click the mark to open it; a click elsewhere, the mark again, or Escape closes it. Desktop only.
  const pop = $("#mbPopover"), mark = $("#menubarMark");
  const scaleMbStage = () => { $("#mbStage").style.transform = `scale(${$("#mbPreview").clientWidth / 1280})`; };
  function placePopover() {
    const r = mark.getBoundingClientRect(), w = pop.offsetWidth;
    // right edge lined up with the mark's plate (Timo, 2026-10-15), kept on screen
    const PLATE = 10;   // the plate spills 10 px past the icon (window.css #menubarMark::before)
    pop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.right + PLATE - w))}px`;
  }
  function setPopover(open) {
    if (open && isMobile()) return;
    pop.classList.toggle("open", open); mark.classList.toggle("active", open);
    if (open) { placePopover(); scaleMbStage(); }
  }
  mark.addEventListener("click", e => { e.stopPropagation(); setPopover(!pop.classList.contains("open")); });
  $(".mb-stop").addEventListener("click", () => $("#stopButton").click());
  $(".mb-pause").addEventListener("click", () => $("#pauseButton").click());
  $("#mbOpen").addEventListener("click", () => { setPopover(false); if (!focused && heroMode !== "0") setFocus(true); });
  document.addEventListener("pointerdown", e => {
    if (pop.classList.contains("open") && !pop.contains(e.target) && !mark.contains(e.target)) setPopover(false);
  }, true);
  addEventListener("keydown", e => {   // first: Escape closes the popover before it reaches the window
    if (e.key === "Escape" && pop.classList.contains("open")) { setPopover(false); e.stopImmediatePropagation(); }
  }, true);
  addEventListener("resize", () => { if (pop.classList.contains("open")) placePopover(); });
  new ResizeObserver(scaleMbStage).observe($("#mbPreview"));

  // ---------- Where the window sits: resting beside/below the title, or forward in the middle ----------
  // Timo's idea (2026-10-13): the window rests beside (side) or below (stack) the title; the pointer
  // pulls it part of the way towards the middle like a magnet, up to MAGNET of the way, from PULL_RANGE
  // px off; a click brings it all the way and the title fades behind it; × or Escape sends it back.
  // One critically damped spring (the app's .smooth(0.4)) moves it, so the pull, the click and a
  // resize are all the same motion and never jump.
  const heroMode = ["side", "stack", "0"].includes(q.get("hero")) ? q.get("hero") : "side";
  // The magnet is off since scrolling arrived (Timo, 2026-10-14): scroll and click are the way in, and
  // a window drifting under the pointer competed with both. ?magnet=1 brings it back to compare.
  const MAGNET = q.get("magnet") === "1" ? 0.2 : 0, PULL_RANGE = 300, REST_SCALE = 0.92;
  let geo = null, focused = heroMode === "0", pull = 0, placed = false;
  let cur = { x: 0, y: 0, s: 1 }, vel = { x: 0, y: 0, s: 0 }, springFrame = 0, last = 0;
  // With the labelled Close under the window, the centred window gives up a strip at the bottom for it
  const PILL_ROOM = 16 + 44 + 16;
  const focusAt = () => {
    if (q.get("close") !== "pill" || heroMode === "0") return { x: (geo.aw - geo.width * geo.s) / 2, y: (geo.ah - geo.height * geo.s) / 2, s: geo.s };
    const s = Math.min(geo.s, (geo.ah - PILL_ROOM - 16) / geo.height);
    return { x: (geo.aw - geo.width * s) / 2, y: (geo.ah - PILL_ROOM - geo.height * s) / 2 + 8, s };
  };
  const restAt = () => {
    const s = geo.s * REST_SCALE;
    if (heroMode === "side") return { x: geo.aw * 0.48, y: (geo.ah - geo.height * s) / 2 + 8, s };
    if (heroMode === "stack") return { x: (geo.aw - geo.width * s) / 2, y: geo.ah * 0.5, s };
    return focusAt();
  };
  function windowTarget() {
    const f = focusAt(), r = restAt(), m = focused ? 1 : pull * MAGNET;
    return { x: r.x + (f.x - r.x) * m, y: r.y + (f.y - r.y) * m, s: r.s + (f.s - r.s) * m };
  }
  const applyWindow = () => { $("#window").style.transform = `translate(${cur.x}px, ${cur.y}px) scale(${cur.s})`; };
  function placeWindow(snap) {
    if (!geo) return;
    const t = windowTarget();
    if (snap || document.hidden) { cur = { ...t }; vel = { x: 0, y: 0, s: 0 }; placed = true; applyWindow(); return; }
    if (!springFrame) { last = performance.now(); springFrame = requestAnimationFrame(stepSpring); }
  }
  function stepSpring(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = 2 * Math.PI / 0.4, t = windowTarget();
    let moving = false;
    for (const k of ["x", "y", "s"]) {
      vel[k] += (w * w * (t[k] - cur[k]) - 2 * w * vel[k]) * dt;
      cur[k] += vel[k] * dt;
      const tol = k === "s" ? 0.0005 : 0.25;
      if (Math.abs(t[k] - cur[k]) > tol || Math.abs(vel[k]) > tol * 4) moving = true; else { cur[k] = t[k]; vel[k] = 0; }
    }
    applyWindow();
    springFrame = moving && !document.hidden ? requestAnimationFrame(stepSpring) : 0;
    if (!springFrame && moving) placeWindow(true);
  }
  // The way back sits next to where the window lands in the middle
  // No button by default since scrolling arrived (Timo, 2026-10-14): scroll up, Escape, or a click on
  // the wallpaper around the window send it back. ?close=arrow|x|pill shows one, to compare.
  const closeStyle = ["arrow", "x", "pill"].includes(q.get("close")) ? q.get("close") : "none";
  const GLYPH = { x: "M6 6l12 12M18 6L6 18", left: "M19 12H5M11 6l-6 6 6 6", up: "M12 19V5M6 11l6-6 6 6" };
  function placeClose() {
    $("#focusClose").hidden = closeStyle === "none";
    if (!geo || heroMode === "0" || closeStyle === "none") return;
    const f = focusAt(), a = $("#stageArea").getBoundingClientRect(), b = $("#focusClose"), gap = 22 + 24;
    const left = a.left + f.x, top = a.top + f.y, right = left + geo.width * f.s, bottom = top + geo.height * f.s;   // a moves as the page scrolls
    let x, y, from, glyph;
    if (closeStyle === "pill") { x = (left + right) / 2; y = bottom + 16 + 22; from = null; glyph = GLYPH.x; }
    else if (closeStyle === "x") { x = right + gap; y = top + 20; from = "-12px 0"; glyph = GLYPH.x; }
    else if (heroMode === "side") { x = left - gap; y = (top + bottom) / 2; from = "16px 0"; glyph = GLYPH.left; }
    else { x = (left + right) / 2; y = top - gap; from = "0 16px"; glyph = GLYPH.up; }
    // keep it on screen when the window fills most of it
    x = Math.min(innerWidth - 30, Math.max(30, x)); if (a.top >= 0) y = Math.max(a.top + 30, y);
    b.classList.toggle("pill", closeStyle === "pill");
    Object.assign(b.style, { left: `${x}px`, top: `${y}px` }); if (from) b.style.translate = from;
    $("#focusCloseGlyph").setAttribute("d", glyph);
  }

  function setFocus(on) {
    if (heroMode === "0") return;
    focused = on; pull = 0;
    if (!on) $("#page").scrollTo({ top: 0, behavior: "smooth" });   // e.g. Escape from further down
    $("#page").classList.toggle("focus", on);
    showNavTitle();
    if (typeof updateBlur === "function") setTimeout(updateBlur, 0);
    placeWindow(false);
  }
  $("#windowCatch").addEventListener("click", () => setFocus(true));

  // Scrolling, in both layouts (Timo, 2026-10-14): the first scroll brings the window forward; after
  // that the page scrolls normally to whatever is below; back at the top, a *new* gesture upwards sends
  // the window back. "New" matters: a flick that carries the page back to the top must not also undo
  // the focus, so leaving needs a gesture that *started* at the top. A trackpad keeps sending wheel
  // events after the fingers lift, so a gesture is a run of events with no gap of GESTURE_END ms.
  // Inside the window, the sidebar's own scrolling comes first.
  if (heroMode !== "0") {
    const THRESHOLD = 24, OVERSCROLL = 80, GESTURE_END = 220, page = $("#page");
    let gesture = null, gestureTimer = 0;
    const sidebarCanScrollUp = target => { const sb = target.closest && target.closest(".sidebar"); return sb && sb.scrollTop > 0; };
    // Fidgeting (Timo, 2026-10-14): within one gesture, a *change of direction* counts at once, so
    // down-up-down goes forward, back, forward. Only momentum in the direction just triggered is
    // ignored (it never changes sign, so it is easy to tell from a deliberate reversal).
    page.addEventListener("wheel", e => {
      if (isMobile()) return;
      if (!gesture) gesture = { startTop: page.scrollTop, sum: 0, dir: 0 };
      clearTimeout(gestureTimer); gestureTimer = setTimeout(() => { gesture = null; }, GESTURE_END);
      const sign = Math.sign(e.deltaY);
      if (!sign) return;
      if (Math.sign(gesture.sum) !== sign) gesture.sum = 0;          // a reversal starts counting afresh
      if (!focused) {                                                  // resting: nothing scrolls
        e.preventDefault();
        if (sign < 0 || gesture.dir === 1) return;                     // up does nothing; momentum ignored
        gesture.sum += e.deltaY;
        if (gesture.sum >= THRESHOLD) { gesture.dir = 1; gesture.sum = 0; setFocus(true); }
        return;
      }
      const triggeredHere = gesture.dir !== 0;                         // this gesture already moved it
      const atTop = page.scrollTop <= 0 && !sidebarCanScrollUp(e.target);
      if (sign > 0) {
        if (triggeredHere) e.preventDefault();                         // its momentum doesn't scroll the page
        return;                                                        // otherwise: ordinary scrolling down
      }
      // up while forward, at the top: leave. A gesture that began at the top (or brought the window
      // forward: fidgeting) needs only THRESHOLD; one that scrolled up to the top needs OVERSCROLL more,
      // a little resistance instead of a wall (Timo, 2026-10-14: "less of a hump"). It used to require
      // lifting the fingers and starting again.
      if (!atTop || gesture.dir === -1) return;
      e.preventDefault();
      gesture.sum += e.deltaY;
      const needed = triggeredHere || gesture.startTop <= 0 ? THRESHOLD : OVERSCROLL;
      if (gesture.sum <= -needed) { gesture.dir = -1; gesture.sum = 0; setFocus(false); }
    }, { passive: false });
    let touchY = null, touchTop = 0;
    page.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; touchTop = page.scrollTop; }, { passive: true });
    page.addEventListener("touchmove", e => {
      if (touchY === null || isMobile()) return;
      const dy = touchY - e.touches[0].clientY;
      if (!focused && dy >= 40) { setFocus(true); touchY = null; }
      else if (focused && dy <= -40 && touchTop <= 0 && page.scrollTop <= 0 && !sidebarCanScrollUp(e.target)) { setFocus(false); touchY = null; }
    }, { passive: true });
    addEventListener("keydown", e => {
      if (isMobile()) return;
      if (document.activeElement && document.activeElement !== document.body) return;   // Space ticks a checkbox
      if (["PageDown", "ArrowDown", " "].includes(e.key) && !focused) { e.preventDefault(); setFocus(true); }
      if (["PageUp", "ArrowUp"].includes(e.key) && focused && page.scrollTop <= 0) { e.preventDefault(); setFocus(false); }
    });
  }
  $("#focusClose").addEventListener("click", () => setFocus(false));
  // A click on the wallpaper around the window sends it back, like clicking outside a sheet
  $("#page").addEventListener("click", e => {
    if (!focused || isMobile()) return;
    if (e.target === $("#page") || e.target === $("#stageArea") || e.target === $("#below")) setFocus(false);
  });
  $("#sidebarToggle").addEventListener("click", () => $("#desktop").classList.toggle("sheet-open"));
  $("#sheetScrim").addEventListener("click", () => $("#desktop").classList.remove("sheet-open"));
  $("#page").addEventListener("scroll", () => placeClose(), { passive: true });
  addEventListener("keydown", e => { if (e.key === "Escape" && focused) setFocus(false); });
  $("#page").addEventListener("pointermove", e => {
    if (focused || heroMode === "0") return;
    // Distance to where the window *rests*, not where it is now: measured from the moving window,
    // the pull changed as it moved and left it stranded part-way when the pointer stopped.
    if (!geo) return;
    const a = $("#stageArea").getBoundingClientRect(), rr = restAt();
    const r = { left: a.left + rr.x, top: a.top + rr.y, right: a.left + rr.x + geo.width * rr.s, bottom: a.top + rr.y + geo.height * rr.s };
    const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right), dy = Math.max(r.top - e.clientY, 0, e.clientY - r.bottom);
    const k = Math.max(0, 1 - Math.hypot(dx, dy) / PULL_RANGE);
    pull = k * k * (3 - 2 * k);   // smoothstep: gentle at the edge of the range
    placeWindow(false);
  });
  $("#page").addEventListener("pointerleave", () => { if (!focused) { pull = 0; placeWindow(false); } });
  addEventListener("resize", fit);

  // ---------- Wallpaper: none for now (flat page colour, 2026-10-17); render() still calls this ----------
  function drawWallpaper() {}



  // ---------- Title block and the bottom blur ----------
  // ?hero=0 hides the title block, for comparison. The blur shows only while there is more below.
  const page = $("#page");
  page.classList.toggle("hero-side", heroMode === "side");
  page.classList.toggle("hero-stack", heroMode === "stack");
  // Resting in the stacked layout the window runs off the bottom, so the blur shows; otherwise it shows
  // while there is more page below. (Measured from the page, it missed the stacked rest: checked
  // while the window was still travelling back up, nothing ran off yet.)
  const updateBlur = () => $("#bottomBlur").classList.toggle("done",
    !(heroMode === "stack" && !focused) && page.scrollTop + page.clientHeight >= page.scrollHeight - 2);
  page.addEventListener("scroll", updateBlur, { passive: true });
  addEventListener("resize", updateBlur);

  // ---------- Start ----------
  if (q.get("theme")) state.theme = q.get("theme");
  // the nav bar's switch, and following the system (theme.js); a switch re-renders in the new appearance
  siteTheme.start(to => { state.theme = to; render(); }, state.theme);
  if (q.get("layout")) state.layout = q.get("layout");
  // The card starts in the corner of the window that is on screen while it rests: bottom left beside
  // the title (the window runs off the right), top right when stacked (it runs off the bottom).
  // Timo, 2026-10-13. Only the starting corner; the Position controls work as before.
  if (heroMode === "side") { state.top = false; state.horizontal = "leading"; }
  if (heroMode === "stack") { state.top = true; state.horizontal = "trailing"; }
  const measure = document.createElement("div"); measure.id = "ccMeasure"; measure.className = "cc-measure"; $("#stage").append(measure);
  syncVariants();

  // Nothing animates on the first paint. Transitions are off while the page settles, styles are
  // flushed, and they come back on. (Not requestAnimationFrame: it never fires in a background tab.)
  // The window's height is fixed at what it first needs; after that the sidebar scrolls rather than
  // the window growing or shrinking, as in the app.
  // The window's height comes from the screen and from what the settings need on load, never from a
  // setting changing later (see fit()).
  const lockHeight = () => { const w = $("#window"); w.style.height = ""; w.style.width = `${MAX_W}px`; naturalH = w.offsetHeight; fit(); };
  const settle = () => {
    document.documentElement.classList.add("no-motion");
    render(); lockHeight();
    void document.body.offsetHeight;
    document.documentElement.classList.remove("no-motion");
  };
  settle();
  if (document.fonts) document.fonts.ready.then(settle);
  $("#demoImage").addEventListener("load", render);
  if (q.get("paused")) { const img = $("#demoImage"); img.complete ? setPaused(true) : img.addEventListener("load", () => setPaused(true), { once: true }); }
  new ResizeObserver(fit).observe($("#preview"));
  updateBlur();
  setInterval(() => { if (new Date().getSeconds() === 0) render(); }, 1000);
})();
