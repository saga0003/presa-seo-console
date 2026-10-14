# Presa SEO Console — Roadmap & Progress

Updated: 14 Oct 2026

## Overall status

Estimated weighted implementation progress: **68% complete / 32% pending**.

This is weighted by engineering/content effort rather than simple phase count. Phase 5 engineering is built; its clean site-layer frontend is awaiting one WordPress GitHub-bridge deployment.

## Phase status

| Phase | Scope | Weight | Status | Completion |
|---|---|---:|---|---:|
| 1 | SEO Command Centre, routing, baselines, cannibalization, action engine | 16% | Complete; Google recrawl validation continues | 100% |
| 2 | Competitor Radar: editable registry + dynamic SERP top 3 + public page/sitemap monitoring | 12% | Complete | 100% |
| 3 | NEET Resource Library platform + PYQ information architecture + QA/indexation controls | 18% | Engineering complete; historical verified corpus currently 0 questions | 55% |
| 4 | Search-demand content engine | 12% | Production system complete in v0.7.0 | 100% |
| 5 | Interactive NEET practice, test mode, diagnostics and error notebook | 13% | Backend/API complete in v0.8.0; standalone SMIS frontend prepared, deployment pending | 90% |
| 6 | JEE + KCET expansion | 7% | Existing JEE SEO assets, system not generalized yet | 10% |
| 7 | Conversion layer: resource → counselling → scholarship/campus/admission | 8% | Basic CTAs and lead paths exist | 15% |
| 8 | Evidence Marketing / Claim Vault | 5% | Rules defined; first claim cleanup started | 10% |
| 9 | Daily SEO Autopilot | 5% | Daily brief + ranked action queue + competitor radar + search-demand plan | 60% |
| 10 | Authority / AEO / GEO / AI Overview optimization | 4% | Citation-ready page work started | 20% |

Weighted total ≈ 68%.

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

Presa SEO Console v0.6.0 provides:
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

### Historical corpus status — 14 Oct 2026

The production readiness endpoint currently reports **0 verified/index-ready historical NEET questions** across Physics, Chemistry, Botany and Zoology. This is deliberate: Phase 5 does not admit unverified or AI-invented questions just to populate the interface.

The remaining Phase 3 workload is corpus production: ingest official/verified historical questions, verify source and answer, create/review original worked solutions, tag year/subject/chapter/concept/difficulty, pass duplicate and QA checks, then publish through the quality gate.

A weekly Phase 3 corpus progress report is active so verified totals, coverage and QA gaps are surfaced automatically.

## Resource delivery architecture — corrected 14 Oct 2026

New NEET resource/application pages are moving out of ordinary WordPress theme-bound pages and into the existing `st-marys-wordpress-layer` deployment system.

The new standalone resource shell:
- renders a full independent HTML document from SMIS Site Layer
- does not call the Facultic theme header/footer or load Facultic icons/widgets
- uses a dedicated St. Mary’s resource header/navigation and footer
- uses only the resource-page CSS/JS required for the page
- keeps the St. Mary’s palette and mobile-first responsive rules
- preserves canonical metadata, robots rules and structured data in the standalone renderer

Prepared plugin-owned routes:
- `/neet/`
- `/neet/previous-year-question-papers/`
- `/neet/practice/`

The practice route remains `noindex` until the verified corpus is substantial enough to be useful.

## Phase 4 — Complete

Presa SEO Console v0.7.0 includes:
- persistent canonical content/keyword ownership registry
- real GSC search-demand scoring and period comparison
- login/portal-noise filtering
- intent/topic clustering
- existing-page matching before new URL creation
- content-gap queue
- answer-led SEO/AEO briefs
- mandatory page design/mobile QA standards
- post-publication measurement
- daily ranked content-production plan

Core rule: **upgrade or consolidate an existing authoritative URL before creating a new page; create a new URL only for genuinely distinct intent with substantial original value.**

## Phase 5 — Interactive NEET Practice

Presa SEO Console v0.8.0 is live and health-verified with the Phase 5 backend enabled.

Built:
- verified-question-only practice pool
- Practice Mode with immediate worked feedback
- Test Mode with answers hidden until session completion
- subject/year/chapter/difficulty filters
- session scoring
- subject and chapter diagnostics
- anonymous learner history
- personal error notebook
- retest sessions based on previous mistakes
- public practice API restricted to the St. Mary’s frontend origins
- standalone `/neet/practice/` frontend prepared in SMIS Site Layer

The backend is ready now. Actual question availability is intentionally tied to Phase 3 verification rather than synthetic filler.

## Next priority

1. Deploy SMIS Site Layer v0.10.0 so the standalone resource shell replaces the two theme-bound WordPress pages and activates `/neet/practice/`.
2. Populate the verified historical NEET corpus; Phase 5 becomes useful automatically as questions pass the Phase 3 gate.
3. Generalize the resource/practice architecture to JEE + KCET in Phase 6.
