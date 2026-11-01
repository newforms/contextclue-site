// "love" in the footer becomes a heart while the pointer is over it, and back when it leaves (Timo,
// 2026-11-01). Touch screens have no hover, so there a tap switches it, as does a keyboard press. The width
// follows the face that shows, so the words after it slide (window.css .love). The heart arrives with a
// little burst of dots.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)");

  // Timo's second sketch (2026-11-01), dots only, scaled from it to the 13 px heart: angle (degrees, 0 =
  // right, clockwise) and distance (px) from the heart's centre where each dot lands. The first sketch also
  // had streaks; he dropped them.
  const DOTS = [[-97, 18.5], [-61, 14.4], [-131, 13.8], [125, 14.1], [54, 15.8], [90, 17.4]];
  const DOT = 2.5;   // px across
  function burst(el) {
    if (still.matches) return;
    const box = document.createElement("span"); box.className = "love-burst"; box.setAttribute("aria-hidden", "true");
    el.append(box);
    let left = DOTS.length;
    for (const [deg, dist] of DOTS) {
      const i = document.createElement("i"), a = deg * Math.PI / 180;
      Object.assign(i.style, { width: `${DOT}px`, height: `${DOT}px`, margin: `${-DOT / 2}px 0 0 ${-DOT / 2}px` });
      box.append(i);
      const at = d => `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
      // Out fast and slowing, from beside the heart to its place, then gone. (Tried and reverted, 2026-11-01:
      // appearing in place and drifting only 4 px; Timo preferred this first, thrown version.)
      i.animate([
        { transform: `${at(dist * 0.35)} scale(.4)`, opacity: 0 },
        { transform: `${at(dist * 0.75)} scale(1)`, opacity: 1, offset: 0.3 },
        { transform: `${at(dist)} scale(.6)`, opacity: 0 },
      ], { duration: 620, delay: 40, easing: "cubic-bezier(.2, .7, .3, 1)", fill: "backwards" })
        .finished.then(() => { if (--left === 0) box.remove(); }, () => box.remove());
    }
  }

  document.querySelectorAll(".love").forEach(el => {
    const word = el.querySelector(".love-word"), heart = el.querySelector(".love-heart");
    // The heart's width, from its ink. At footer size the emoji font reports a 16 px advance for a glyph about
    // 12 px wide, all the spare on the right, so neither the box nor the font's metrics will do (window.css).
    // Drawn off screen at 4x, scanned for ink, then given the slim side bearing (0.4 px) a letter has.
    const BEARING = 0.4;
    let heartFit = null;
    const fitHeart = () => {
      const cs = getComputedStyle(heart), S = 4, c = document.createElement("canvas");
      c.width = 64 * S; c.height = 32 * S;
      const x = c.getContext("2d"); x.scale(S, S); x.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      x.textBaseline = "middle"; x.fillText(heart.textContent, 16, 16);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      let L = Infinity, R = -1;
      for (let col = 0; col < c.width; col++) for (let row = 0; row < c.height; row++)
        if (d[(row * c.width + col) * 4 + 3] > 40) { L = Math.min(L, col); R = col; break; }
      if (R < 0) return null;   // nothing drawn (no emoji font): leave the heart's own box
      const inkLeft = L / S - 16, inkWidth = (R + 1 - L) / S;
      heart.style.marginLeft = `${BEARING - inkLeft}px`;
      return inkWidth + 2 * BEARING;
    };
    const size = () => {
      if (el.classList.contains("on")) { heartFit ??= fitHeart(); el.style.width = `${heartFit ?? heart.offsetWidth}px`; }
      else el.style.width = `${word.offsetWidth}px`;
    };
    const set = on => {
      if (el.classList.contains("on") === on) return;
      el.classList.toggle("on", on); el.setAttribute("aria-pressed", String(on)); size();
      if (on) burst(el);
    };
    // A mouse hovers; anything else (a finger, a pen, the keyboard) taps. Remembered from pointerdown, since
    // not every browser says on the click itself what made it.
    let lastPointer = "";
    el.addEventListener("pointerdown", e => { lastPointer = e.pointerType; });
    el.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") set(true); });
    el.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") set(false); });
    el.addEventListener("click", () => { if (lastPointer !== "mouse") set(!el.classList.contains("on")); lastPointer = ""; });
    size();   // a width to animate from, before the first change
    if (document.fonts) document.fonts.ready.then(() => { heartFit = null; size(); });
  });
})();
