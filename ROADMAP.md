# Presa SEO Console — Roadmap & Progress

Updated: 14 Oct 2026

## Overall status

Estimated weighted implementation progress: **57% complete / 43% pending**.

This is weighted by engineering/content effort rather than simple phase count.

## Phase status

| Phase | Scope | Weight | Status | Completion |
|---|---|---:|---|---:|
| 1 | SEO Command Centre, routing, baselines, cannibalization, action engine | 16% | Complete; Google recrawl validation continues | 100% |
| 2 | Competitor Radar: editable registry + dynamic SERP top 3 + public page/sitemap monitoring | 12% | Complete | 100% |
| 3 | NEET Resource Library platform + PYQ information architecture + QA/indexation controls | 18% | Engineering complete; verified historical question corpus rollout active | 55% |
| 4 | Search-demand content engine | 12% | Production system complete in v0.7.0 | 100% |
| 5 | Interactive tools: PYQ practice, diagnostics, mock tests, calculators | 13% | Very early / existing mock-test assets | 5% |
| 6 | JEE + KCET expansion | 7% | Existing JEE SEO assets, system not generalized yet | 10% |
| 7 | Conversion layer: resource → counselling → scholarship/campus/admission | 8% | Basic CTAs and lead paths exist | 15% |
| 8 | Evidence Marketing / Claim Vault | 5% | Rules defined; first claim cleanup started | 10% |
| 9 | Daily SEO Autopilot | 5% | Daily brief + ranked action queue + competitor radar + search-demand plan | 60% |
| 10 | Authority / AEO / GEO / AI Overview optimization | 4% | Citation-ready page work started | 20% |

Weighted total ≈ 57%.

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

Presa SEO Console v0.5+ supports:
- persistent editable competitor registry
- add/update/remove any competitor without code changes
- seeded ALLEN, Aakash, Physics Wallah, NEETprep and Vedantu
- live-search snapshot storage
- first 3 distinct non-SMIS organic domains treated as dynamic competitors per keyword
- public competitor page analysis: title, meta, H1-H3, content depth, links, schema, freshness signals and page-change diff
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

Public website foundation:
- `https://smis.edu.in/neet/`
- `https://smis.edu.in/neet/previous-year-question-papers/`

The platform and information architecture are complete. The remaining Phase 3 workload is corpus production: ingesting, verifying and solving historical questions before publication through the quality gate.

### Resource-page design correction — 14 Oct 2026

The first public resource pages exposed an implementation problem: plain raw HTML in WordPress was passed through automatic paragraph formatting, which damaged card/link markup and contributed to inconsistent typography and spacing. Both resource pages were rebuilt as Gutenberg Custom HTML blocks with scoped CSS and a consistent mobile-first design system.

Mandatory standards for future generated pages are now encoded in Phase 4's `page_design_system` tool:
- St. Mary’s palette: #C80000 / #131E35 / neutral greys
- system typography with controlled responsive hierarchy
- full-width hero + readable max-width content
- clean mobile collapse at 390px; no horizontal overflow
- custom authored HTML must use a Gutenberg Custom HTML block so `wpautop` cannot corrupt structure
- hide duplicate theme title strips when the authored page already owns the H1
- inactive resources are status-labelled, never presented as fake/broken links
- strong contrast, practical tap targets and semantic heading hierarchy
- explicit visual-QA checklist before a page is considered complete

## Phase 4 — Complete

Presa SEO Console v0.7.0 adds the production search-demand content engine:
- `content_registry`: persistent canonical content/keyword ownership registry
- `upsert_content_item`: controlled production state from idea → brief → draft → review → approved → published → measure
- `content_demand_radar`: real GSC query scoring with previous-period comparison
- login/portal navigation-noise filtering
- intent and topic-cluster classification for NEET, JEE, PU/ISC, schools and cutoffs
- existing-page/resource matching before recommending a new URL
- opportunity scoring based on impressions, ranking proximity, CTR, growth and coverage gap
- `content_gap_queue`: surfaces weak/unowned search demand
- `content_brief`: answer-led SEO/AEO brief generation with stored dynamic competitor context
- `page_design_system`: mandatory visual/mobile/WordPress production guardrails
- `content_measurement`: post-publication query/page measurement against comparable periods
- `phase4_daily_plan`: ranked daily production queue with an explicit anti-thin-page rule
- recurring daily St. Mary’s Search Demand Plan workflow

Phase 4 follows one core rule: **upgrade or consolidate an existing authoritative URL before creating a new page; create a new URL only for genuinely distinct intent with substantial original value.**

## Next priority

1. Continue populating the verified NEET PYQ corpus through the Phase 3 ingestion/QA workflow.
2. Phase 5: interactive attempt/test mode on top of the verified question library.
3. Generalize the resource/content engine to JEE + KCET in Phase 6.
