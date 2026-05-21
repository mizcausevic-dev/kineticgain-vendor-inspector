import { test } from "node:test";
import assert from "node:assert/strict";

import { probeWellKnown, SUITE_PATHS, tierFromScore } from "../shared/well-known-probe.js";

function fakeFetch(routes) {
  return async function (url) {
    const path = new URL(url).pathname;
    const key = Object.keys(routes).find((s) => path.endsWith(s));
    if (!key) return mk(404, "");
    return mk(routes[key].status ?? 200, routes[key].body ?? "");
  };
}
function mk(status, body) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    status,
    async json() {
      if (text === "") throw new Error("empty");
      return JSON.parse(text);
    },
  };
}

test("SUITE_PATHS has 11 entries, each with a label", () => {
  const entries = Object.entries(SUITE_PATHS);
  assert.equal(entries.length, 11);
  for (const [, spec] of entries) assert.equal(typeof spec.label, "string");
});

test("all-miss → 0 / none", async () => {
  const r = await probeWellKnown("example.com", { fetch: fakeFetch({}) });
  assert.equal(r.score, 0);
  assert.equal(r.tier, "none");
  assert.equal(r.published.length, 0);
});

test("all-hit → 100 / comprehensive", async () => {
  const r = await probeWellKnown("example.com", {
    fetch: fakeFetch({
      "/.well-known/aeo.json": { body: { aeo_version: "0.1" } },
      "/.well-known/agents/index.json": { body: [] },
      "/.well-known/prompts/index.json": { body: [] },
      "/.well-known/evidence/index.json": { body: [] },
      "/.well-known/tool-cards/index.json": { body: [] },
      "/.well-known/tutor-cards/index.json": { body: [] },
      "/.well-known/student-ai/index.json": { body: [] },
      "/.well-known/aup.json": { body: { aup_version: "0.1" } },
      "/.well-known/clinical-ai/index.json": { body: [] },
      "/.well-known/incidents/index.json": { body: [] },
      "/.well-known/decisions/index.json": { body: [] },
    }),
  });
  assert.equal(r.score, 100);
  assert.equal(r.tier, "comprehensive");
});

test("discriminator enforced: aeo 200 without aeo_version is not found", async () => {
  const r = await probeWellKnown("example.com", {
    fetch: fakeFetch({ "/.well-known/aeo.json": { body: { nope: true } } }),
  });
  assert.equal(r.documents.aeo.found, false);
});

test("tierFromScore boundaries", () => {
  assert.equal(tierFromScore(90), "comprehensive");
  assert.equal(tierFromScore(60), "strong");
  assert.equal(tierFromScore(30), "partial");
  assert.equal(tierFromScore(1), "minimal");
  assert.equal(tierFromScore(0), "none");
});
