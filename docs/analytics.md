# Analytics contract

Current schema: `v1`. Collection is enabled only when both `NODE_ENV` and
Vercel's `VERCEL_ENV` are `production`.

## Current comparison funnel

| Event | Trigger | Deduplication |
| --- | --- | --- |
| `comparison_started` | A valid pair is accepted and its comparison request begins. | Once per request attempt. |
| `comparison_completed` | Comparison data is ready and the first result-gauge completion unlocks the detailed result. | Once per request attempt. |

Comparison completion is reported as sessions containing
`comparison_completed` divided by sessions containing `comparison_started`,
with raw session counts beside the rate. District selection, priority
selection, and official-source inspection remain **not yet instrumented**;
their events must not be emitted before those flows exist.

Events carry only an allowlisted route category and fixed page metadata. They
must not carry candidate names, slugs, parties, selected districts, free text,
query strings, detailed page titles, or referrers. Dynamic candidate and
district URLs are reduced to route templates; unknown paths become `/other`.

Page views are manual: sanitized global defaults are installed before GA is
configured, the configuration disables its automatic load page view, and one
sanitized `page_view` is emitted after initialization. Repeated delivery of
the same pathname is ignored, while another pathname remains countable. The
HU-002 funnel uses only its two explicit comparison events, never automatic
GA page views.

[Google documents](https://developers.google.com/analytics/devguides/collection/ga4/views#disable_page_changes_based_on_browser_history_events)
that `send_page_view: false` cannot disable Enhanced Measurement page views
produced by browser-history changes from application code. Any automatic event
therefore receives the safe global/config defaults, but those events are
outside this contract and its denominators.

## Pending production verification

- Inspect production network requests and GA DebugView to confirm each event
  arrives once and contains only the documented fields.
- Inspect any GA Enhanced Measurement events to verify the safe defaults are
  retained; their presence or absence does not change this funnel contract.
- Configure and verify staff/internal-traffic filtering and the owner-approved
  consent policy in the GA property; neither can be proven from this repository.
- Capture the seven-day baseline before setting growth targets.
