import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CandidateSelect,
  createRequestGeneration,
  rosterContentKey,
  resolveEligibility,
  resolveEligibilityResponse,
  type MunicipalCandidate,
  viewReducer,
} from "../src/components/MunicipalComparison";

const roster = ["ana", "beatriz"];
const candidates: MunicipalCandidate[] = [
  { id: 1, nombre: "Beatriz Pérez", partido: "Partido B", slug: "beatriz" },
  { id: 2, nombre: "Ana López", partido: "Partido A", slug: "ana" },
];

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
    { eligibility: ready, left: "", right: "", retry: 0 },
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
