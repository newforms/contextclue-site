// Light and dark, shared by every page (Timo, 2026-10-17): the nav bar's sun/moon switch, the system's
// setting, and the sunset/sunrise the icon plays. A page loads this before its own script, reads
// siteTheme.initial for its first render, and calls siteTheme.start(apply) once it can switch; apply(to)
// puts the page in that appearance (the home page re-renders, the privacy page sets data-theme).
//
// Appearance: opens in the system's light or dark, and follows it as it changes, until the switch is
// used; that choice then holds for the rest of the visit, across pages (sessionStorage, so a new visit
// starts from the system again). From 2026-10-14 it always opened in light; before that it followed
// the system with no override. Storage can be missing or refuse (private windows), so every use is
// guarded and the page works without it.
window.siteTheme = (() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const THEME_KEY = "contextclue-theme";
  const chosenTheme = () => { try { return sessionStorage.getItem(THEME_KEY); } catch { return null; } };
  const systemDark = matchMedia("(prefers-color-scheme: dark)");
  const initial = chosenTheme() || (systemDark.matches ? "dark" : "light");
  let current = initial, apply = () => {};

  function start(applyTheme, now = initial) {
    apply = applyTheme; current = now;
    $("#themeToggle").addEventListener("click", () => {
      const to = current === "dark" ? "light" : "dark";
      try { sessionStorage.setItem(THEME_KEY, to); } catch {}
      switchTheme(to);
    });
    systemDark.addEventListener("change", e => {
      const to = e.matches ? "dark" : "light";
      if (!chosenTheme() && to !== current) switchTheme(to);
    });
  }

  // A tap is a sunset (or sunrise) with the screen changing in the middle of it. The screen
  // cross-fade shows pictures of the page while it runs, which freezes anything moving, so it is
  // placed where the icon is still: the empty horizon between the sun setting and the moon rising.
  // (Fading during the sunset would freeze the sun mid-set; Timo chose this order, 2026-10-11.)
  let pendingFlip = null;
  function switchTheme(to) {
    if (pendingFlip) { clearTimeout(pendingFlip.timer); pendingFlip.run(false); }   // tapped again mid-way
    turnThemeIcon(to);
    const html = document.documentElement;
    const run = fade => {
      pendingFlip = null;
      const flip = () => { html.classList.add("no-motion"); current = to; apply(to); void document.body.offsetHeight; };
      const done = () => { html.classList.remove("no-motion"); setTimeout(riseThemeIcon, fade ? RISE_PAUSE : 0); };
      if (fade && document.startViewTransition) document.startViewTransition(flip).finished.finally(done);
      else { flip(); done(); }
    };
    pendingFlip = { run, timer: setTimeout(() => run(true), SUNSET_FLIP_AT) };
  }

  // Sunset/sunrise, Timo's idea (2026-10-11): a dot under the icon grows into a horizon, the current
  // body sets behind it, the screen changes, the other rises, and the horizon shrinks back to a dot
  // and goes. Each half of the horizon draws outward from the centre (a dash growing along a line of
  // pathLength 1, so it starts as a round-capped dot). Two phases:
  //   set:  0–180 horizon grows · 100–600 the body sets   (the screen fade starts at 550)
  //   rise: begins 100 ms after the screen fade has *finished*, whenever that is ·
  //         0–450 the other rises · 450–550 rests · 550–800 horizon shrinks to a dot · 800–930 dot fades
  // The rise used to start at a fixed time and ran into the end of the fade, which freezes the page,
  // so its first frames were lost (Timo, 2026-10-11). How long the fade takes varies by machine.
  const SET = 600, RISE = 930, RISE_PAUSE = 100, SUNSET_FLIP_AT = 550;
  const down = "translateY(20px)", up = "translateY(0)";
  let iconAnimations = [], riseFor = null;
  const lines = () => $$("#themeIcon .horizon line");
  function turnThemeIcon(to) {
    iconAnimations.forEach(a => a.finish());
    const icon = $("#themeIcon");
    const setting = $(to === "dark" ? ".sun" : ".moon", icon), rising = $(to === "dark" ? ".moon" : ".sun", icon);
    const opts = { duration: SET, fill: "forwards" }, at = ms => ms / SET;
    riseFor = rising;
    iconAnimations = [
      setting.animate([{ transform: up, offset: 0 }, { transform: up, offset: at(100), easing: "ease-in" }, { transform: down, offset: 1 }], opts),
      rising.animate([{ transform: down }, { transform: down }], opts),   // held below until the rise
      ...lines().map(line => line.animate([
        { strokeDasharray: "0 2", opacity: 0, offset: 0 },
        { strokeDasharray: "0 2", opacity: 1, offset: at(10), easing: "ease-out" },
        { strokeDasharray: "1 2", opacity: 1, offset: at(180) },
        { strokeDasharray: "1 2", opacity: 1, offset: 1 },
      ], opts)),
    ];
  }
  function riseThemeIcon() {
    if (!riseFor) return;
    const rising = riseFor; riseFor = null;
    const opts = { duration: RISE, fill: "forwards" }, at = ms => ms / RISE;
    iconAnimations.push(
      rising.animate([{ transform: down, offset: 0, easing: "ease-out" }, { transform: up, offset: at(450) }, { transform: up, offset: 1 }], opts),
      ...lines().map(line => line.animate([
        { strokeDasharray: "1 2", opacity: 1, offset: 0 },
        { strokeDasharray: "1 2", opacity: 1, offset: at(550), easing: "ease-in-out" },
        { strokeDasharray: "0 2", opacity: 1, offset: at(800), easing: "ease-out" },
        { strokeDasharray: "0 2", opacity: 0, offset: 1 },
      ], opts)),
    );
  }

  return { initial, start };
})();
