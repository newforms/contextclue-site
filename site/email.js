// Contact links are put together here, so the address never appears in the page source: common
// scrapers look for name@domain and mailto: in the HTML. Each link carries the two halves reversed
// (data-u, data-d) and an optional subject; elements with .email-text also get the address as their
// text. Without JavaScript the HTML shows "contextclue at timo dot is". (Timo, 2026-10-15.)
(() => {
  const flip = s => [...s].reverse().join("");
  for (const el of document.querySelectorAll("[data-u][data-d]")) {
    const address = `${flip(el.dataset.u)}@${flip(el.dataset.d)}`;
    const subject = el.dataset.subject ? `?subject=${encodeURIComponent(el.dataset.subject)}` : "";
    el.href = `mailto:${address}${subject}`;
    if (el.classList.contains("email-text")) el.textContent = address;
  }
})();
