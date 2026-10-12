# Presa SEO Console — Roadmap & Progress

Updated: 12 Oct 2026

## Overall status

Estimated implementation progress: **26% complete / 74% pending**.

This is weighted by engineering/content effort, not simple phase count. The resource library, interactive tools and competitor intelligence are much larger pieces than the initial GSC connector.

## Phase status

| Phase | Scope | Weight | Status | Completion |
|---|---|---:|---|---:|
| 1 | SEO Command Centre, keyword→URL routing, baselines, cannibalization, action engine | 16% | Nearly complete | 95% |
| 2 | Competitor Radar: ALLEN, Aakash, PW, NEETprep, Vedantu + Karnataka competitors | 12% | Designed / research started | 10% |
| 3 | NEET Resource Library: PYQs, solutions, subject/chapter/question pages, PDFs | 18% | Existing resource signals + early pages | 10% |
| 4 | Search-demand content engine | 12% | Early content + GSC opportunity signals | 15% |
| 5 | Interactive tools: PYQ practice, diagnostics, mock tests, calculators | 13% | Very early / existing mock-test assets | 5% |
| 6 | JEE + KCET expansion | 7% | Existing JEE SEO assets, system not generalized yet | 10% |
| 7 | Conversion layer: resource → counselling → scholarship/campus/admission | 8% | Basic CTAs and lead paths exist | 15% |
| 8 | Evidence Marketing / Claim Vault | 5% | Rules defined; first claim cleanup started | 10% |
| 9 | Daily SEO Autopilot | 5% | Daily brief + ranked action queue built | 45% |
| 10 | Authority / AEO / GEO / AI Overview optimization | 4% | First AI-citation page upgrade started | 20% |

Weighted total ≈ 26%.

## Phase 1 completion criteria

Completed:
- Google Search Console → MCP → ChatGPT connection
- persistent Google OAuth storage
- period comparison
- monthly trends
- query→page and page→query analysis
- cannibalization detection
- keyword registry
- priority-keyword comparison against previous period and baseline
- daily SEO brief
- ranked `seo_action_plan`
- first live routing cleanup on SMIS pages
- canonical/self-canonical and AIOSEO intent separation on major money pages
- old duplicate `/home-2/` noindexed and canonicalized to homepage
- duplicate older NEET long-term landing page noindexed and canonicalized to the primary long-term page
- NEET Grade 11–12 vs repeater intent separation
- PU/ISC brand vs generic intent separation
- first AI Overview citation-ready answer block on the Karnataka PU/Science comparison page

Remaining before Phase 1 is considered fully closed:
1. Refresh ChatGPT plugin tools to expose Presa SEO Console v0.4.0.
2. Validate the new `seo_action_plan` end-to-end.
3. Wait for Google to recrawl the routing changes and compare the next settled 7-day window.
4. Confirm that the intended URLs begin gaining dominant impression share for the affected keywords.

## Next phase

**Phase 2 — Competitor Radar**

Build automated observation of public competitor pages and sitemaps for:
- new URLs
- changed titles/H1s
- updated content dates
- newly targeted topic clusters
- resource hubs / PYQ coverage
- ranking competitors around St. Mary's priority queries

Initial competitors: ALLEN, Aakash, Physics Wallah, NEETprep, Vedantu, plus Karnataka-specific school/PU/NEET/JEE competitors.
