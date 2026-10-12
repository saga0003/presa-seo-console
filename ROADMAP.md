# Presa SEO Console — Roadmap & Progress

Updated: 12 Oct 2026

## Overall status

Estimated weighted implementation progress: **46% complete / 54% pending**.

This is weighted by engineering/content effort rather than simple phase count.

## Phase status

| Phase | Scope | Weight | Status | Completion |
|---|---|---:|---|---:|
| 1 | SEO Command Centre, routing, baselines, cannibalization, action engine | 16% | Complete; Google recrawl validation continues | 100% |
| 2 | Competitor Radar: editable registry + dynamic SERP top 3 + public page/sitemap monitoring | 12% | Complete | 100% |
| 3 | NEET Resource Library platform + PYQ information architecture + QA/indexation controls | 18% | Engineering complete; verified historical question corpus rollout active | 55% |
| 4 | Search-demand content engine | 12% | Early content + GSC opportunity signals | 15% |
| 5 | Interactive tools: PYQ practice, diagnostics, mock tests, calculators | 13% | Very early / existing mock-test assets | 5% |
| 6 | JEE + KCET expansion | 7% | Existing JEE SEO assets, system not generalized yet | 10% |
| 7 | Conversion layer: resource → counselling → scholarship/campus/admission | 8% | Basic CTAs and lead paths exist | 15% |
| 8 | Evidence Marketing / Claim Vault | 5% | Rules defined; first claim cleanup started | 10% |
| 9 | Daily SEO Autopilot | 5% | Daily brief + ranked action queue + daily competitor radar | 55% |
| 10 | Authority / AEO / GEO / AI Overview optimization | 4% | Citation-ready page work started | 20% |

Weighted total ≈ 46%.

## Phase 1 — Complete

- Google Search Console → MCP → ChatGPT
- persistent Google OAuth storage
- period comparison and monthly trends
- query→page and page→query analysis
- cannibalization detection
- priority keyword registry/report
- daily SEO brief and ranked `seo_action_plan`
- live intent/routing cleanup on major SMIS pages
- canonical/noindex cleanup for duplicates
- first AI Overview citation-ready answer block

Google recrawl/impression-share validation is ongoing measurement, not unfinished engineering.

## Phase 2 — Complete

Presa SEO Console v0.5+ now supports:
- persistent editable competitor registry
- add/update/remove any competitor without code changes
- seeded ALLEN, Aakash, Physics Wallah, NEETprep and Vedantu
- live-search snapshot storage
- first 3 distinct non-SMIS organic domains treated as dynamic competitors per keyword
- public competitor page analysis: title, meta, H1-H3, content depth, internal/external links, schema, freshness signals and page-change diff
- public robots/sitemap discovery
- new/updated URL detection
- emerging public topic themes
- keyword-level comparison of dynamic competitors and tracked competitors against the St. Mary’s target page
- recurring daily competitor radar workflow

Methodology: Presa observes public pages, sitemaps and search results. It does not claim access to competitors’ private Search Console or internal keyword data.

## Phase 3 — NEET Resource Library

Presa SEO Console v0.6.0 adds a persistent NEET resource engine with:
- canonical library manifest
- hub/year/subject/chapter/question resource catalog
- 2014–2026 year architecture
- Physics, Chemistry, Botany and Zoology collections
- question records with source, answer, worked solution, concept, difficulty and image references
- question QA/index-readiness scoring
- duplicate detection
- resource-gap reporting
- page blueprints and indexation rules
- private Vercel Blob persistence

Public website foundation created:
- `https://smis.edu.in/neet/`
- `https://smis.edu.in/neet/previous-year-question-papers/`

The current hub links to existing St. Mary’s NEET question-paper/model-paper/simulation resources. Historical year/subject/question URLs are intentionally not mass-published until verified questions and original solutions are available; publishing empty placeholders would create thin content.

### Remaining Phase 3 corpus work

The platform and information architecture are complete. To make Phase 3 fully complete as a content corpus, verified NEET historical questions/official sources from 2014–2026 still need to be ingested, solved/reviewed and then published through the quality gate. This is a content-production workload, not a missing system capability.

## Next priority

1. Populate the verified NEET PYQ corpus through the Phase 3 ingestion/QA workflow.
2. Phase 4: turn GSC + competitor + library gaps into a controlled content production queue.
3. Phase 5: add interactive attempt/test mode on top of the verified question library.
