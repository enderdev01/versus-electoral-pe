import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CandidateSelect,
  ComparisonPanels,
  createRequestGeneration,
  rosterContentKey,
  resolveNewsResponse,
  resolvePlanResponse,
  resolveEligibility,
  resolveEligibilityResponse,
  type MunicipalCandidate,
  viewReducer,
} from "../src/components/MunicipalComparison";
import type { PlanGobiernoView } from "../src/lib/planes-gobierno";

const roster = ["ana", "beatriz"];
const candidates: MunicipalCandidate[] = [
  { id: 1, nombre: "Beatriz Pérez", partido: "Partido B", slug: "beatriz" },
  { id: 2, nombre: "Ana López", partido: "Partido A", slug: "ana" },
];

const plan: PlanGobiernoView = {
  jneId: 12,
  expediente: "EXP-12",
  fuenteUrl: "https://plataformahistorico.jne.gob.pe/",
  pdfUrl: null,
  fechaRegistro: null,
  fechaResumen: null,
  propuestas: [{
    jneId: 1,
    dimension: "SOCIAL",
    problema: "Texto original del problema",
    objetivo: "Texto original de la propuesta",
    indicador: null,
    meta: null,
    orden: 1,
  }],
};

test("eligibility distinguishes zero roster, unavailable database coverage, and malformed responses", () => {
  assert.deepEqual(resolveEligibility([], candidates), { status: "empty" });
  assert.deepEqual(resolveEligibility(roster, []), { status: "unavailable" });
  assert.deepEqual(resolveEligibility(roster, { error: "failed" }), { status: "error" });
  assert.deepEqual(resolveEligibilityResponse(roster, { ok: false, body: [] }), { status: "error" });
});

test("eligible candidates are roster-limited and ordered without a score field", () => {
  assert.deepEqual(resolveEligibility(roster, [...candidates, { ...candidates[0], slug: "outside" }]), {
    status: "ready",
    candidates: [candidates[1], candidates[0]],
  });
});

test("a newer municipal request invalidates a late response from the previous district", () => {
  const requests = createRequestGeneration();
  const districtA = requests.next();
  const districtB = requests.next();

  assert.equal(requests.isCurrent(districtA), false);
  assert.equal(requests.isCurrent(districtB), true);
});

test("an equal-content roster rerender keeps the same loading scope", () => {
  assert.equal(rosterContentKey([...roster]), rosterContentKey([...roster]));
});

test("the ready state keeps native, distinct candidate controls and neutral municipal copy", () => {
  const ready = resolveEligibility(roster, candidates);
  assert.equal(ready.status, "ready");

  const state = viewReducer(
    { eligibility: ready, left: "", right: "", retry: 0, results: null },
    { type: "left", value: "ana" },
  );
  const distinctState = viewReducer(state, { type: "right", value: "ana" });
  assert.equal(distinctState.left, "");
  assert.equal(distinctState.right, "ana");

  const markup = renderToStaticMarkup(
    createElement("div", null,
      createElement(CandidateSelect, {
        id: "municipal-candidate-left", label: "Candidatura 1", value: "ana",
        candidates: ready.candidates, excluded: "beatriz", onChange: () => {},
      }),
      createElement(CandidateSelect, {
        id: "municipal-candidate-right", label: "Candidatura 2", value: "beatriz",
        candidates: ready.candidates, excluded: "ana", onChange: () => {},
      }),
    ),
  );

  assert.equal((markup.match(/<select/g) ?? []).length, 2);
  assert.match(markup, /id="municipal-candidate-left"/);
  assert.match(markup, /id="municipal-candidate-right"/);
  assert.match(markup, /value="beatriz" disabled/);
  assert.match(markup, /value="ana" disabled/);
  assert.doesNotMatch(markup, /ganador|peligroso|veredicto|medidor/i);
});

test("official plans stay primary, preserve JNE wording, and open the optional priority without ranking", () => {
  const markup = renderToStaticMarkup(
    createElement(ComparisonPanels, {
      left: candidates[1],
      right: candidates[0],
      priority: "SOCIAL",
      results: {
        plans: { left: { status: "ready", data: plan }, right: { status: "unavailable" } },
        news: { left: { status: "ready", data: [{ id: 1, titulo: "Noticia A", fuente: "Medio", url: "https://example.com/a", fechaNoticia: "2026-01-02" }] }, right: { status: "ready", data: [] } },
      },
    }),
  );

  assert.ok(markup.indexOf("Propuestas oficiales") < markup.indexOf("Noticias relacionadas"));
  assert.match(markup, /Texto original del problema/);
  assert.match(markup, /Texto original de la propuesta/);
  assert.match(markup, /<details open=""/);
  assert.match(markup, /plataformahistorico\.jne\.gob\.pe/);
  assert.doesNotMatch(markup, /ganador|peligroso|veredicto|medidor|puntaje/i);
});

test("plan and news sources retain asymmetric unavailable and empty states", () => {
  assert.deepEqual(resolvePlanResponse({ ok: true, body: { plan: null } }), { status: "unavailable" });
  assert.deepEqual(resolvePlanResponse({ ok: false, body: {} }), { status: "unavailable" });
  assert.deepEqual(resolveNewsResponse({ ok: true, body: { noticias: [] } }), { status: "ready", data: [] });
  assert.deepEqual(resolveNewsResponse({ ok: false, body: {} }), { status: "unavailable" });
});
