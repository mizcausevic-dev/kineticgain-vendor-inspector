/* ------------------------------------------------------------------ *
 * On-page badge. Appended after the probe core (above) by the build
 * script. The probe core exposes probeWellKnown / SUITE_PATHS /
 * tierFromScore as plain top-level consts (the `export` keywords are
 * stripped during build), so we can call them directly here.
 * ------------------------------------------------------------------ */
(function () {
  "use strict";

  // Only run in the top frame on http(s) pages.
  if (window.top !== window.self) return;
  if (!/^https?:$/.test(location.protocol)) return;

  const TIER_COLOR = {
    comprehensive: "#10b981",
    strong: "#10b981",
    partial: "#f59e0b",
    minimal: "#f59e0b",
    none: "#f43f5e",
  };

  const host = document.createElement("div");
  host.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "right:16px",
    "z-index:2147483647",
    "font-family:ui-monospace,SFMono-Regular,Menlo,monospace",
    "font-size:12px",
    "background:#0f172a",
    "color:#e2e8f0",
    "border:1px solid #1e293b",
    "border-radius:10px",
    "box-shadow:0 8px 24px rgba(0,0,0,.4)",
    "padding:10px 12px",
    "max-width:280px",
    "cursor:pointer",
    "opacity:0.92",
    "transition:opacity .15s ease",
  ].join(";");
  host.title = "Kinetic Gain — Vendor AI Disclosure Inspector. Click to expand.";
  host.onmouseenter = () => (host.style.opacity = "1");
  host.onmouseleave = () => (host.style.opacity = "0.92");

  const line = document.createElement("div");
  line.textContent = "AI disclosure: probing…";
  host.appendChild(line);

  let expanded = false;
  let lastResult = null;
  const detail = document.createElement("div");
  detail.style.cssText = "margin-top:8px;display:none;line-height:1.7";
  host.appendChild(detail);

  host.addEventListener("click", () => {
    if (!lastResult) return;
    expanded = !expanded;
    detail.style.display = expanded ? "block" : "none";
  });

  function renderDetail(result) {
    detail.innerHTML = "";
    for (const [slug, spec] of Object.entries(SUITE_PATHS)) {
      const doc = result.documents[slug];
      const row = document.createElement("div");
      const mark = doc.found ? "✅" : "▫️";
      const color = doc.found ? "#e2e8f0" : "#64748b";
      row.style.color = color;
      row.textContent = `${mark} ${spec.label}`;
      detail.appendChild(row);
    }
  }

  document.documentElement.appendChild(host);

  probeWellKnown(location.hostname, { timeout: 6000 })
    .then((result) => {
      lastResult = result;
      const color = TIER_COLOR[result.tier] || "#94a3b8";
      line.innerHTML =
        `<span style="color:${color};font-weight:700">${result.score}/100</span> ` +
        `<span style="color:${color}">${result.tier}</span> ` +
        `<span style="color:#64748b">· ${result.published.length}/11 specs</span>`;
      renderDetail(result);
    })
    .catch((err) => {
      line.textContent = "AI disclosure: probe failed";
      line.title = String(err);
    });
})();
