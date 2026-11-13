// Compact ?debug menu for the hosted demos. The kit's panel stacks one button per option and covers
// the game; this swaps it for one dropdown pill under the art toggle, with repeated names merged.
// Choosing an option clicks the kit's own (now detached) button, so the kit still runs the spin.
(() => {
  if (!new URLSearchParams(location.search).has("debug")) return;

  function compact(panel) {
    const buttons = [...panel.querySelectorAll("button[title]")];
    if (!buttons.length) return false;
    // "SNEAKY SACK RESPIN" (scenario file) and "Sneaky Sack Respin" (mode option) are one choice.
    const choices = new Map();
    for (const b of buttons) {
      const label = b.textContent.trim(), key = label.toLowerCase(), seen = choices.get(key);
      if (!seen) choices.set(key, { label, button: b });
      else if (seen.label === seen.label.toUpperCase() && label !== label.toUpperCase()) seen.label = label;
    }

    const select = document.createElement("select");
    select.setAttribute("aria-label", "Force next spin");
    const placeholder = new Option("DEMO ▾", "", true, true);
    placeholder.hidden = true;
    select.append(placeholder);
    const byValue = new Map();
    const titleCase = (s) => s === s.toUpperCase() ? s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()) : s;
    for (const [key, { label, button }] of choices) { select.append(new Option(titleCase(label), key)); byValue.set(key, button); }
    select.onchange = () => { byValue.get(select.value)?.click(); select.value = ""; };
    Object.assign(select.style, {
      appearance: "none", WebkitAppearance: "none", width: "84px", padding: "8px 12px", cursor: "pointer",
      background: "rgba(9,4,15,0.88)", color: "#f8edf8", border: "1px solid #59356f", borderRadius: "12px",
      font: '600 12px/1 "Space Grotesk", ui-sans-serif, sans-serif', letterSpacing: ".4px", textAlign: "center",
      boxShadow: "0 6px 18px rgba(0,0,0,.28)",
    });

    panel.replaceChildren(select);
    Object.assign(panel.style, { top: "48px", left: "auto", right: "8px", padding: "0", maxWidth: "none", background: "none", border: "0" });
    return true;
  }

  // The kit attaches the panel fully built, once the session config arrives.
  new MutationObserver((_, observer) => {
    const panel = document.getElementById("debug-panel");
    if (panel && compact(panel)) observer.disconnect();
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
