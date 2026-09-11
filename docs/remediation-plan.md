# Product and SEO remediation roadmap

**Recommended direction:** help a voter choose a district and priorities, compare official proposals side by side, and inspect their sources. News supports that decision; it must not define a candidate's worth through a danger score.

**Delivery order:** HU-001 → HU-002 → HU-003 → HU-004 → HU-005 → HU-006. This is a roadmap, not authorization to implement every story or deploy. Confirm each story's scope before starting it.

## Evidence and boundaries

Baseline supplied by the verified production audit on September 9, 2026; recheck before implementation:

| Evidence | Delivery implication |
|---|---|
| Database 35.3 MB; Supabase Storage 0 B; WAL 84 MB | Do not prescribe storage cleanup, database migration, or a paid upgrade from these numbers alone. They measure different resources. |
| 15,780 news records; 73.3% classified `LIMPIO` | Record volume and automated labels do not establish investigative quality or legal conclusions. |
| 350 of 485 municipal candidates have no news | Absence of collected coverage is an explicit unknown, never evidence of integrity. |
| 7,020 official JNE proposals across 485 municipal candidates | Reuse the existing proposal asset before expanding scraping. Coverage does not mean every field is complete or every proposal feasible. |
| Live `https://www.versuselectoral.com` advertises dead `transparencia-electoral.pe` in canonical, Open Graph, robots and sitemap | Repair discovery infrastructure first; do not promise rankings from a metadata fix. |
| Current comparison gamifies who is “more dangerous” | Replace that framing with neutral, source-led decision support. |

CodeGraph inspected the current branch before filesystem exploration. Relevant seams: `src/lib/site.ts` centralizes the origin; metadata, robots and sitemap consume it. `src/lib/planes-gobierno.ts` reads a bundled JSON dataset with JNE identifiers, problem, objective, indicator and target. `PlanGobierno` renders that information by four dimensions. `GoogleAnalytics` and `trackEvent` already exist: measurement is an extension and validation task, not a greenfield integration.

## Delivery rules

- Keep each work unit independently understandable and, where reasonable, below 400 authored changed lines. Split by contract, rendering, and verification; do not hide coupled changes behind arbitrary line cuts. Explain unavoidable generated-data changes separately.
- Use conventional commits without AI attribution, only when committing is explicitly requested. No database deletion or destructive migration belongs to these stories.
- Agent/model assignments below are suggestions, not permission to spawn agents or change models. Use the smallest topology allowed by repository instructions; an owner remains accountable for acceptance.
- Existing Spanish UI remains professional Spanish; this roadmap and new technical documentation are English. No political endorsement, personalized persuasion, opaque winner, or unsupported “verified news” claim.
- Suggested numerical targets are release criteria to validate, not measured outcomes. Record the HU-002 baseline before interpreting improvement. Report sample size and observation window; low traffic is not proof of failure or success.
- Run targeted automated checks, TypeScript, lint, and production build as applicable. `npm run check:isr` protects the existing ISR budget. `@playwright/test` is installed, but `package.json` has no test script: inspect existing test configuration before selecting the exact command.
- Separate code validation, preview validation, production deployment, and Search Console actions. Report missing credentials or unavailable environments; never equate local success with production verification.

## HU-001 — Restore a coherent canonical origin

**Priority:** P0 · **Value/story:** As a voter arriving from search, I want results and shared links to identify the working site rather than a dead domain.

**Scope:** `src/lib/site.ts`, environment examples/build configuration, metadata consumers, robots and sitemap. Standardize the production origin on `https://www.versuselectoral.com`; preserve valid path-level canonicals. Validate production origin configuration and distinguish preview indexing policy. Inspect apex redirect configuration separately; change it only with deployment authorization.

**Acceptance criteria**
- [ ] Home, municipal listing, district, municipal candidate, comparison and presidential routes emit one correct canonical each; Open Graph, language alternates and JSON-LD use the same origin with appropriate paths.
- [ ] Robots references the live sitemap; every sitemap location uses the approved origin; production pages intended for discovery remain indexable.
- [ ] Missing/default and malformed origin configuration have regression coverage. No generated public SEO URL references the dead domain; historical documentation may retain it.
- [ ] Production verification and sitemap resubmission are recorded, or explicitly marked pending owner access. Do not restore the dead fallback on rollback.

**Metrics:** zero dead-origin SEO URLs in the release crawl; 100% agreement across sampled metadata. Observe indexed canonical selection and valid indexed pages in Search Console for 14–28 days; no ranking guarantee.

**Dependencies:** production build/environment access; domain ownership and Search Console access for operational completion. No dependency on redesign.

**Risks:** build-time environment overrides; stale deployment/cache; nested routes inheriting the home canonical; preview URLs leaking into production; apex redirect loops.

**Verification:** unit/configuration cases, build, then inspect server HTML and HTTP responses on preview and live URL families; parse complete robots/sitemap responses. Check controlled aliases without assuming access to the dead host. Google recommends consistent canonical signals and self-referencing canonical pages ([canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)).

**Rollback boundary:** revert defective validation or route changes independently; retain the approved live origin. Revert a newly changed alias redirect independently if it loops. No data mutation.

**Work units / suggested actor:** origin policy + regression checks; route metadata corrections if needed; operational verification. SEO implementation agent · `gpt-5.6-sol` · high reasoning.

## HU-002 — Measure useful decisions, not clicks alone

**Priority:** P1 · **Value/story:** As the product owner, I want to know whether visitors reach and inspect official comparisons before investing in more features.

**Scope:** existing `GoogleAnalytics`/`trackEvent`, funnel instrumentation, and a compact baseline/reporting contract. Define aggregate events for district-selection completion, priority-selection completion, comparison rendered, and official-source open; reserve later events until their UI exists.

**Acceptance criteria**
- [ ] Event names, triggers, denominators, deduplication, consent behavior and exclusions are documented; page-view initialization/navigation does not double-count.
- [ ] A scripted journey emits each intended event once; blocked analytics never breaks navigation. Preview, staff and automated traffic are excluded from production interpretation.
- [ ] Do not send political preferences, selected candidates, free text, precise location, or query-string selection state to analytics; audit automatic page URLs as well as custom payloads. No voter profiling or cross-session preference linkage.
- [ ] Capture a seven-day baseline, then compare equivalent 14-day windows by device/channel when sample sizes allow. Existing unavailable events are marked “not yet instrumented,” not zero.

**Metrics:** comparison completion = sessions with a rendered comparison / sessions starting selection; source inspection = comparison sessions opening an official source / comparison sessions. Record counts alongside rates, errors and time to comparison. Launch validation target: 100% scripted-event accuracy; growth targets follow baseline review.

**Dependencies:** HU-001; analytics/property access and an owner-approved privacy/consent approach. Final funnel completion depends on HU-004.

**Risks:** low sample sizes, bot inflation, blockers, double page views, accidental collection of sensitive political-interest data. Prefer less granular measurement over individual profiling.

**Verification:** network payload inspection with and without analytics/consent, navigation/reload tests, analytics debug view if access exists; verify no selection data leaks through URL/referrer tracking.

**Rollback boundary:** disable new collection without removing the comparison UI; version event schemas rather than silently reinterpreting historical data.

**Work units / suggested actor:** event contract + payload guard; current-flow instrumentation + tests; baseline reporting. Measurement agent · `gpt-5.6-sol` · high reasoning.

## HU-003 — Design and ship a neutral district-first entry

**Priority:** P1 · **Value/story:** As a municipal voter, I want to find my district and the issues I care about without interpreting accusation scores or reading a whole plan first.

**Scope:** home and municipal entry information architecture, district selection, priority selection and a small reusable visual foundation. The core sequence is district → priorities → eligible candidates → proposals → optional news. Keep presidential and municipal contexts distinct. Start with existing four JNE dimensions; introduce finer topics only with an explicit mapping contract.

**Acceptance criteria**
- [ ] A reviewed mobile/desktop prototype includes empty, unavailable, loading and error states before implementation; it removes “more dangerous,” winners and score-led primary calls to action.
- [ ] District changes clear incompatible candidates; selection can be changed or skipped without hidden personalization. Preserve existing public candidate/district URLs.
- [ ] Keyboard and screen-reader users can complete selection; focus, labels and non-color status cues are present; the flow works at 320 px width and 200% zoom.
- [ ] In a small formative test, at least 4 of 5 participants locate a district and begin comparing without assistance. Record failures; this is usability evidence, not a population estimate.

**Metrics:** selection-start and completion rates, task success, median time to comparison entry; error/abandonment counts. Compare against HU-002 rather than optimizing animation or time-on-site.

**Dependencies:** HU-002; product owner approval of neutral copy and district/priority taxonomy. Comparison destination can initially preserve the existing flow until HU-004.

**Risks:** visual redesign without improved navigation; forced topic choices; accidental election mixing; removing familiar routes; scope growth into a complete design-system rewrite.

**Verification:** prototype task tests, keyboard/screen-reader checks, responsive browser checks and selection-state tests; ensure links to existing candidates still resolve.

**Rollback boundary:** independently restore the previous navigation layout while retaining corrected SEO and measurement. Do not reintroduce unsupported danger/winner claims as fallback copy.

**Work units / suggested actor:** IA + prototype; selection contract/components; entry-page integration + accessibility checks. Product/design agent · `gpt-6-astra` · high reasoning; implementation agent · `gpt-5.6-sol` · high reasoning.

## HU-004 — Compare official proposals with inspectable evidence

**Priority:** P1 · **Value/story:** As a voter, I want two candidates for the same office compared on my selected priorities, with the original commitments and sources visible.

**Scope:** an additive view model over the existing JNE snapshot and a replacement proposal-first comparison surface. Preserve original source text and identifiers; avoid database/schema migration or new live JNE dependency for the first release. Show problem, objective, indicator and target using progressive disclosure.

**Acceptance criteria**
- [ ] Two distinct candidates from the same district/office can be compared; invalid, duplicate and cross-election selections produce actionable states rather than silently comparing unrelated candidates.
- [ ] Rows align by explicit dimension/topic, not by array position or proposal count. A missing proposal is distinguished from unavailable plan data and unmapped topic data.
- [ ] Every displayed proposal retains a traceable candidate, JNE identifier, source link and snapshot/source date when available; unknown dates are labeled unknown. Original wording is inspectable.
- [ ] “Verifiability” exposes a versioned rubric showing whether source, indicator and target are present, missing or require review. Field presence is not truth, feasibility, compliance or an endorsement; no aggregate candidate winner.
- [ ] Source comparison fixtures cover null fields, empty plans, more than 100 proposals and asymmetric topic coverage. Mobile readers can compare without losing candidate/row context.

**Metrics:** 100% displayed proposals traceable to snapshot/source identifiers; zero fabricated missing fields in fixtures; comparison completion and official-source inspection from HU-002. Track missing/mapping coverage separately from candidate quality.

**Dependencies:** HU-003 interaction contract; HU-002 events; audited candidate-to-plan mapping and owner approval of the rubric. Finer topics require reviewed mappings with an explicit unmapped state.

**Risks:** implying feasibility from numeric-looking text; mismatched candidate identifiers; false topic equivalence; excessive rendering payload; broken upstream source links; analytics leaking share-state selections.

**Verification:** deterministic view-model/rubric tests, spot-check source fidelity across districts and missing fields, end-to-end two-candidate flow, large-plan mobile/performance checks and ISR budget check. External link outages must not erase the original local evidence.

**Rollback boundary:** hide the new comparison surface and retain a neutral source-linked plan listing; keep original JSON untouched. Disable only the affected rubric/mapping version when evidence is wrong.

**Work units / suggested actor:** comparison contract + fixtures; grouping/rubric helpers; accessible rendering; route integration + telemetry/tests. Data/product architect · `gpt-6-astra` · high reasoning for rubric; implementation agent · `gpt-5.6-sol` · high reasoning.

## HU-005 — Make news secondary, contextual and correctable

**Priority:** P1 · **Value/story:** As a voter, I want to inspect reported events without confusing an automated label or lack of coverage with a proven fact about a candidate.

**Scope:** news presentation, coverage states, provenance, methodology and correction route. Preserve raw articles and existing classifications for traceability; do not expand scraping or perform irreversible relabeling in this story.

**Acceptance criteria**
- [ ] News appears after proposals, labeled as secondary reporting. No collected news, failed collection and available coverage are distinct states; `LIMPIO` is not presented as proof of innocence or integrity.
- [ ] Each displayed item includes publisher, original link, publication date when known, collection/update context and an explicit automated-classification caveat. Unknown facts stay unknown.
- [ ] Labels distinguish reported allegations from documented outcomes; unsupported outcome claims are withheld. A visible methodology explains limitations, coverage bias and correction handling with a named operational owner.
- [ ] A correction entry point has an acknowledged handling workflow before publication; do not promise a response time the owner cannot meet. Duplicated reports must not visually count as independent corroboration.

**Metrics:** 100% rendered news items expose provenance and classification caveats; zero “no news = clean” states in fixtures; correction queue size/age and audited label-error rate with sample size. Scraped volume is not the success metric.

**Dependencies:** HU-004 proposal-first hierarchy; HU-002 safe event contract; editorial owner and legal review if needed for wording/handling, not a claim that the roadmap provides legal advice.

**Risks:** reputational harm, duplicate amplification, mismatched identities, stale outcomes, unstaffed corrections, destroying evidence during cleanup.

**Verification:** fixtures for zero coverage, unavailable feed, duplicate story, missing dates and disputed classification; human source audit on a stratified sample; keyboard/mobile checks for disclosure and source links.

**Rollback boundary:** suppress disputed labels or secondary news panels while preserving source records and accessible official plans. No deletion/backfill rollback is needed because data mutations are excluded.

**Work units / suggested actor:** coverage/provenance contract; neutral cards + methodology; correction integration + fixtures. Trust/editorial architect · `gpt-6-astra` · high reasoning; implementation agent · `gpt-5.6-sol` · high reasoning.

## HU-006 — Publish useful district/topic discovery pages

**Priority:** P2 · **Value/story:** As a voter searching for a local issue, I want an informative district-specific page that leads directly to comparable official proposals.

**Scope:** a small reviewed pilot of district/topic pages, internal links, metadata and sitemap eligibility. Reuse HU-004 mappings and evidence; do not generate every district × keyword combination or personalized comparison permutation.

**Acceptance criteria**
- [ ] Pilot pages contain distinct sourced proposal content for at least two eligible candidates, explain topic selection/coverage, and link into comparison and candidate pages. This is a project quality threshold, not a Google rule.
- [ ] Empty/unmapped topics are not published as indexable pages. Invalid routes return 404; valid but insufficient pilot content is withheld from indexing and the sitemap until the quality gate passes.
- [ ] Each indexable page has a unique descriptive title, H1 and self-canonical, crawlable internal links, visible source/update context and only structured data supported by its visible content.
- [ ] Sitemap includes only approved canonical pages and uses content-derived modification dates, not a fresh timestamp on every request. Owner approves the pilot before scale-out.

**Metrics:** pilot indexed canonical pages, non-brand district/topic impressions and clicks, search-entry-to-comparison rate and source inspection. Review equivalent 28-day windows after discovery; publish no traffic/ranking guarantee.

**Dependencies:** HU-001, HU-002, HU-004 topic mappings and HU-005 trust language; editorial validation capacity and Search Console access.

**Risks:** thin/duplicated pages, stale election data, uncontrolled faceted URL growth, inventing proposal summaries, crawl/index delays and cache/build cost.

**Verification:** content/source audit per pilot page; crawl canonical and link consistency; test insufficient/invalid routes; schema validation; sitemap diff; production build and ISR budget. Google advises listing preferred canonical URLs and accurate modification dates ([sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)).

**Rollback boundary:** remove affected pilot pages from discovery/navigation and sitemap and apply an appropriate non-indexable or not-found state while preserving the underlying comparison/data. Do not redirect unrelated topics to the home page.

**Work units / suggested actor:** publication gate + route contract; pilot template/content; internal links/metadata/sitemap tests; owner publication check. SEO/content architect · `gpt-6-astra` · high reasoning for topic quality; implementation agent · `gpt-5.6-sol` · high reasoning.

## Release evidence per story

Record: changed files and work-unit size; acceptance checklist; executed checks with results; before/after screenshots or response samples; deployed version/environment if applicable; metric baseline/window; remaining risks; rollback owner and tested boundary. Do not mark a story complete while its production-only checks are merely assumed.
