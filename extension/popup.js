/**
 * Popup controller. Reads the active tab's domain, probes its well-known
 * endpoints via the shared probe core (extension fetch bypasses CORS thanks
 * to host_permissions), and renders the score + per-spec breakdown.
 */

import { probeWellKnown, SUITE_PATHS } from "./well-known-probe.js";

// Cross-browser: Firefox exposes `browser`, Chrome exposes `chrome`.
const api = typeof browser !== "undefined" ? browser : chrome;

const els = {
  domain: document.getElementById("domain"),
  scoreBand: document.getElementById("scoreBand"),
  scoreNum: document.getElementById("scoreNum"),
  scoreTier: document.getElementById("scoreTier"),
  scoreSub: document.getElementById("scoreSub"),
  specList: document.getElementById("specList"),
  copyBtn: document.getElementById("copyBtn"),
};

let lastResult = null;

async function getActiveDomain() {
  const tabs = await api.tabs.query({ active: true, currentWindow: true });
  const tab = tabs && tabs[0];
  if (!tab || !tab.url) return null;
  try {
    const u = new URL(tab.url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname;
  } catch {
    return null;
  }
}

function renderError(message) {
  els.specList.innerHTML = "";
  const li = document.createElement("li");
  li.className = "error-state";
  li.textContent = message;
  els.specList.appendChild(li);
  els.scoreNum.textContent = "—";
  els.scoreTier.textContent = "n/a";
  els.scoreSub.textContent = "";
}

function render(result) {
  els.domain.textContent = result.domain;
  els.scoreNum.textContent = String(result.score);
  els.scoreTier.textContent = result.tier;
  els.scoreSub.textContent = `${result.published.length} of 11 Suite documents published`;
  els.scoreBand.className = "score-band tier-" + result.tier;

  els.specList.innerHTML = "";
  for (const [slug, spec] of Object.entries(SUITE_PATHS)) {
    const doc = result.documents[slug];
    const li = document.createElement("li");
    li.className = "spec-row " + (doc.found ? "is-found" : "is-missing");

    const dot = document.createElement("span");
    dot.className = "spec-dot " + (doc.found ? "found" : "missing");

    const label = document.createElement("span");
    label.className = "spec-label";
    label.textContent = spec.label;

    const status = document.createElement("span");
    status.className = "spec-status";
    status.textContent = doc.found ? (doc.version ? `v${doc.version}` : "published") : "—";

    li.append(dot, label, status);
    els.specList.appendChild(li);
  }
}

function toReportText(result) {
  const lines = [
    `AI Disclosure Report — ${result.domain}`,
    `Score: ${result.score}/100 (${result.tier})`,
    `Published ${result.published.length}/11:`,
    ...result.published.map((s) => `  + ${SUITE_PATHS[s].label}`),
    `Missing:`,
    ...result.missing.map((s) => `  - ${SUITE_PATHS[s].label}`),
    `Probed ${result.probedAt} via inspector.kineticgain.com`,
  ];
  return lines.join("\n");
}

els.copyBtn.addEventListener("click", async () => {
  if (!lastResult) return;
  try {
    await navigator.clipboard.writeText(toReportText(lastResult));
    els.copyBtn.textContent = "Copied ✓";
    els.copyBtn.classList.add("copied");
    setTimeout(() => {
      els.copyBtn.textContent = "Copy report";
      els.copyBtn.classList.remove("copied");
    }, 1500);
  } catch {
    /* clipboard denied; ignore */
  }
});

(async function main() {
  const domain = await getActiveDomain();
  if (!domain) {
    renderError("Open a regular https:// site, then click the inspector.");
    return;
  }
  els.domain.textContent = domain;
  try {
    lastResult = await probeWellKnown(domain, { timeout: 6000 });
    render(lastResult);
  } catch (err) {
    renderError("Probe failed: " + (err && err.message ? err.message : String(err)));
  }
})();
