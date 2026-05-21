/**
 * well-known-probe — single-file browser/userscript build.
 *
 * Vendored from https://github.com/mizcausevic-dev/well-known-probe-js v0.1.0,
 * flattened into one dependency-free ES module so it can be (a) imported
 * directly by the MV3 extension popup and (b) concatenated into the
 * Greasemonkey userscript by scripts/build-userscript.mjs (which strips the
 * `export` keywords).
 *
 * Keep this file in sync with the canonical package. If you change probe
 * logic here, port it back to well-known-probe-js (and vice-versa).
 */

export const PROBE_VERSION = "0.1.0";

/** The eleven canonical Suite paths. */
export const SUITE_PATHS = Object.freeze({
  aeo:          { label: "AEO Protocol",            url: "/.well-known/aeo.json",               discriminator: "aeo_version" },
  agents:       { label: "Agent Cards",             url: "/.well-known/agents/index.json",      discriminator: null },
  prompts:      { label: "Prompt Provenance",       url: "/.well-known/prompts/index.json",     discriminator: null },
  evidence:     { label: "AI Evidence Format",      url: "/.well-known/evidence/index.json",    discriminator: null },
  toolCards:    { label: "MCP Tool Cards",          url: "/.well-known/tool-cards/index.json",  discriminator: null },
  tutorCards:   { label: "AI Tutor Cards",          url: "/.well-known/tutor-cards/index.json", discriminator: null },
  studentAI:    { label: "Student AI Disclosure",   url: "/.well-known/student-ai/index.json",  discriminator: null },
  classroomAUP: { label: "Classroom AI AUP",        url: "/.well-known/aup.json",               discriminator: "aup_version" },
  clinicalAI:   { label: "Clinical AI Disclosure",  url: "/.well-known/clinical-ai/index.json", discriminator: null },
  incidents:    { label: "AI Incident Card",        url: "/.well-known/incidents/index.json",   discriminator: null },
  decisions:    { label: "Procurement Decision",    url: "/.well-known/decisions/index.json",   discriminator: null },
});

const SPEC_COUNT = Object.keys(SUITE_PATHS).length;

/** Map a 0-100 score to a tier label (matches the AI Procurement Pulse bands). */
export function tierFromScore(score) {
  if (score >= 90) return "comprehensive";
  if (score >= 60) return "strong";
  if (score >= 30) return "partial";
  if (score >= 1) return "minimal";
  return "none";
}

export function scoreResult(found, total) {
  if (total <= 0) return { score: 0, tier: "none" };
  const score = Math.round((found / total) * 100);
  return { score, tier: tierFromScore(score) };
}

/**
 * Probe a domain for every Suite document.
 * @param {string} domain
 * @param {{ timeout?: number, signal?: AbortSignal, fetch?: typeof fetch, scheme?: string }} [options]
 */
export async function probeWellKnown(domain, options = {}) {
  const {
    timeout = 5000,
    signal,
    fetch: fetchImpl = globalThis.fetch,
    scheme = "https",
  } = options;

  if (typeof fetchImpl !== "function") {
    throw new TypeError("probeWellKnown: no fetch implementation available");
  }
  if (typeof domain !== "string" || domain.length === 0) {
    throw new TypeError("probeWellKnown: domain must be a non-empty string");
  }

  const origin = normalizeOrigin(domain, scheme);
  const probedAt = new Date().toISOString();
  const documents = {};

  await Promise.all(
    Object.entries(SUITE_PATHS).map(async ([slug, spec]) => {
      documents[slug] = await probeOne(origin, spec, { fetchImpl, timeout, externalSignal: signal });
    }),
  );

  const published = Object.keys(documents).filter((s) => documents[s].found);
  const missing = Object.keys(documents).filter((s) => !documents[s].found);
  const { score, tier } = scoreResult(published.length, SPEC_COUNT);

  return { domain: hostnameFromOrigin(origin), probedAt, score, tier, documents, published, missing };
}

async function probeOne(origin, spec, { fetchImpl, timeout, externalSignal }) {
  const url = origin + spec.url;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const onAbort = () => controller.abort();
  if (externalSignal) externalSignal.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (response.status !== 200) return { status: response.status, found: false, url };

    let json;
    try {
      json = await response.json();
    } catch {
      return { status: 200, found: false, url, error: "200 but not valid JSON" };
    }

    if (spec.discriminator) {
      const version = json && typeof json === "object" ? json[spec.discriminator] : undefined;
      if (typeof version !== "string") {
        return { status: 200, found: false, url, error: `missing '${spec.discriminator}'` };
      }
      return { status: 200, found: true, url, json, version };
    }
    if (!json || typeof json !== "object") {
      return { status: 200, found: false, url, error: "expected JSON object or array" };
    }
    return { status: 200, found: true, url, json };
  } catch (err) {
    if (err && err.name === "AbortError") {
      return { status: 0, found: false, url, error: `timed out after ${timeout}ms` };
    }
    return { status: 0, found: false, url, error: String(err) };
  } finally {
    clearTimeout(timer);
    if (externalSignal) externalSignal.removeEventListener("abort", onAbort);
  }
}

function normalizeOrigin(input, scheme) {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = scheme + "://" + s;
  return new URL(s).origin;
}

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}
