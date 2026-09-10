import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYTICS_EVENTS,
  createAnalyticsConfig,
  createAnalyticsInitScript,
  createPageViewTracker,
  dispatchAnalyticsEvent,
  isProductionAnalyticsEnvironment,
  toAnalyticsPagePath,
  type AnalyticsEventInput,
  type AnalyticsEventName,
} from "../src/lib/analytics";
import {
  acceptComparison,
  shouldApplyComparisonResult,
} from "../src/lib/comparison-flow";

const ORIGIN = "https://www.versuselectoral.com";

test("page analytics removes political and location identifiers", () => {
  assert.equal(toAnalyticsPagePath("/candidato/person?choice=x"), "/candidato/[slug]");
  assert.equal(toAnalyticsPagePath("/alcaldes/distrito/place#results"), "/alcaldes/distrito/[distrito]");
  assert.equal(toAnalyticsPagePath("/alcaldes/person"), "/alcaldes/[slug]");
  assert.equal(toAnalyticsPagePath("/unknown/private?q=secret"), "/other");
  assert.deepEqual(createAnalyticsConfig("/candidato/person?choice=x", ORIGIN), {
    page_path: "/candidato/[slug]",
    page_location: `${ORIGIN}/candidato/[slug]`,
    page_title: "Versus Electoral",
    page_referrer: "",
    send_page_view: false,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
});

test("page tracker deduplicates without exposing raw URLs", () => {
  const calls: unknown[][] = [];
  const track = createPageViewTracker((...args) => calls.push(args), ORIGIN);
  assert.equal(track("/candidato/first?candidate=second"), true);
  assert.equal(track("/candidato/first?candidate=third"), false);
  assert.equal(track("/candidato/second"), true);
  assert.equal(calls.filter(([command]) => command === "event").length, 2);
  assert.equal(/first|second|candidate=/.test(JSON.stringify(calls)), false);
});

test("GA initialization sets safe defaults before config", () => {
  const script = createAnalyticsInitScript("G-TEST", "/candidato/private?q=x", ORIGIN);
  assert.ok(script.indexOf("gtag('set'") < script.indexOf("gtag('config'"));
  assert.match(script, /"send_page_view":false/);
  assert.equal(/private|\?q=/.test(script), false);
});

test("custom events allow only approved names and fields", () => {
  assert.deepEqual(Object.values(ANALYTICS_EVENTS).sort(), [
    "comparison_completed",
    "comparison_started",
  ]);
  const calls: unknown[][] = [];
  const gtag = (...args: unknown[]) => calls.push(args);
  const input = {
    pathname: "/alcaldes/versus?ambito=ate&prioridad=SOCIAL",
    siteOrigin: ORIGIN,
    candidate_slug: "must-not-leak",
    district: "ate",
    priority: "SOCIAL",
  } as AnalyticsEventInput & {
    candidate_slug: string;
    district: string;
    priority: string;
  };
  assert.equal(dispatchAnalyticsEvent(gtag, ANALYTICS_EVENTS.comparisonStarted, input), true);
  assert.deepEqual(calls, [["event", "comparison_started", {
    page_path: "/alcaldes/versus",
    page_location: `${ORIGIN}/alcaldes/versus`,
    page_title: "Versus Electoral",
    page_referrer: "",
  }]]);
  assert.equal(dispatchAnalyticsEvent(gtag, "candidate_selected" as AnalyticsEventName, input), false);
  assert.equal(
    /candidate_slug|must-not-leak|ambito=|prioridad=|district|priority/.test(
      JSON.stringify(calls),
    ),
    false,
  );
});

test("analytics failures never escape", () => {
  const failure = () => { throw new Error("blocked analytics"); };
  const input = { pathname: "/versus", siteOrigin: ORIGIN };
  assert.doesNotThrow(() => dispatchAnalyticsEvent(failure, ANALYTICS_EVENTS.comparisonCompleted, input));
  assert.doesNotThrow(() => createPageViewTracker(failure, ORIGIN)("/versus"));
});

test("accepted pairs deduplicate and stale attempts cannot apply", () => {
  const first = acceptComparison(null, "left", "right");
  assert.equal(first.shouldStart, true);
  assert.equal(acceptComparison(first.pair, "left", "right").shouldStart, false);
  assert.equal(acceptComparison(first.pair, "left", "new-right").shouldStart, true);
  assert.equal(shouldApplyComparisonResult(1, 2), false);
  assert.equal(shouldApplyComparisonResult(2, 2), true);
});

test("analytics runs only on Vercel production", () => {
  assert.equal(isProductionAnalyticsEnvironment({ nodeEnv: "production", vercelEnv: "production" }), true);
  for (const environment of [
    { nodeEnv: "production", vercelEnv: "preview" },
    { nodeEnv: "production", vercelEnv: undefined },
    { nodeEnv: "development", vercelEnv: undefined },
  ]) {
    assert.equal(isProductionAnalyticsEnvironment(environment), false);
  }
});
