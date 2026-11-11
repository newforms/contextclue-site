// Document pages (doc.css): the clock, the appearance switch and the phone layout. The page reads fully
// without this. Moved here from the privacy page when help articles joined it (2026-11-11), unchanged.
(() => {
  const desk = document.getElementById("desktop"), clock = document.getElementById("menubarClock");

  // Switch on the home page's pared-back layout (phones: its phone layout), and fade the page's name into
  // the nav bar once its title has scrolled under the bar (as window.js does on the home page)
  document.documentElement.classList.add("pared");
  document.querySelector("meta[name=viewport]").content += ", viewport-fit=cover";
  const title = document.getElementById("docTitle"), navTitle = document.querySelector(".nav-title"), bar = document.getElementById("menubar");
  const card = document.querySelector(".doc-window");
  const layout = () => {
    desk.classList.toggle("mobile", innerWidth < 700);
    navTitle.classList.toggle("shown", title.getBoundingClientRect().bottom < bar.getBoundingClientRect().bottom);
    // desktop: the bars contract to the card once the page has scrolled (CSS above)
    const r = card.getBoundingClientRect();
    desk.style.setProperty("--content-left", `${r.left}px`); desk.style.setProperty("--content-w", `${r.width}px`);
    desk.classList.toggle("scrolled", scrollY > 0);
  };
  layout(); addEventListener("resize", layout); addEventListener("scroll", layout, { passive: true });

  const tick = () => { clock.textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
  tick(); setInterval(tick, 10000);
  // Light and dark as on the home page, with the same switch and sunset (theme.js)
  const setTheme = to => { desk.dataset.theme = to; document.documentElement.dataset.theme = to; };
  setTheme(siteTheme.initial);
  siteTheme.start(setTheme);
})();
