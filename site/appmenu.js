// Phones: the two-line button in the menu bar opens a small menu (Privacy Policy, Contact) and turns into
// an X while it is open, after Apple's own site (Timo, 2026-10-16). On wider screens the button is hidden
// and "Context Clue" links home, with the items beside it. Closes on a second tap, a tap elsewhere, Escape,
// or widening past phone size. Shared by every page.
(() => {
  const button = document.getElementById("appMenuButton"), menu = document.getElementById("appMenu");
  if (!button || !menu) return;
  const set = open => {
    menu.classList.toggle("open", open); button.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open)); button.setAttribute("aria-label", open ? "Close menu" : "Menu");
  };
  button.addEventListener("click", () => set(!menu.classList.contains("open")));
  document.addEventListener("pointerdown", e => { if (menu.classList.contains("open") && !menu.contains(e.target) && !button.contains(e.target)) set(false); }, true);
  addEventListener("keydown", e => { if (e.key === "Escape") set(false); });
  addEventListener("resize", () => { if (innerWidth >= 700) set(false); });
})();
