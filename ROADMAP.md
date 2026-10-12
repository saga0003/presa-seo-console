# Presa SEO Console — Roadmap & Progress

Updated: 12 Oct 2026

## Overall status

Estimated implementation progress: **36% complete / 64% pending**.

This is weighted by engineering/content effort, not simple phase count. The resource library and interactive tools remain the largest unfinished pieces.

## Phase status

| Phase | Scope | Weight | Status | Completion |
|---|---|---:|---|---:|
| 1 | SEO Command Centre, keyword→URL routing, baselines, cannibalization, action engine | 16% | Complete; post-fix Google validation continues | 100% |
| 2 | Competitor Radar: editable registry + dynamic SERP top 3 + public page/sitemap monitoring | 12% | Built in v0.5.0; plugin refresh/live tool validation pending | 85% |
| 3 | NEET Resource Library: PYQs, solutions, subject/chapter/question pages, PDFs | 18% | Existing resource signals + early pages | 10% |
| 4 | Search-demand content engine | 12% | Early content + GSC opportunity signals | 15% |
| 5 | Interactive tools: PYQ practice, diagnostics, mock tests, calculators | 13% | Very early / existing mock-test assets | 5% |
| 6 | JEE + KCET expansion | 7% | Existing JEE SEO assets, system not generalized yet | 10% |
| 7 | Conversion layer: resource → counselling → scholarship/campus/admission | 8% | Basic CTAs and lead paths exist | 15% |
| 8 | Evidence Marketing / Claim Vault | 5% | Rules defined; first claim cleanup started | 10% |
| 9 | Daily SEO Autopilot | 5% | Daily brief + ranked action queue built | 45% |
| 10 | Authority / AEO / GEO / AI Overview optimization | 4% | First AI-citation page upgrade started | 20% |

Weighted total ≈ 36%.

## Phase 1

Complete:
- Google Search Console → MCP → ChatGPT connection
- persistent Google OAuth storage
- period comparison and monthly trends
- query→page and page→query analysis
- cannibalization detection
- keyword registry
- priority-keyword comparison against previous period and baseline
- daily SEO brief and ranked `seo_action_plan`
- live routing cleanup on major SMIS pages
- canonical/self-canonical and AIOSEO intent separation
- duplicate `/home-2/` noindexed and canonicalized
- duplicate older NEET long-term page noindexed/canonicalized
- Grade 11–12 NEET vs repeater intent separation
- PU/ISC brand vs generic intent separation
- first AI Overview citation-ready answer block

Google recrawl and impression-share validation continue as measurement, not as unfinished engineering.

## Phase 2 — Competitor Radar

Built in Presa SEO Console v0.5.0:
- persistent editable competitor registry
- add/update/remove any competitor without code changes
- seeded ALLEN, Aakash, Physics Wallah, NEETprep and Vedantu
- `record_serp_snapshot`: stores current organic results and automatically treats the first 3 distinct non-SMIS domains as dynamic competitors for that keyword
- `get_serp_snapshot`
- `analyze_competitor_page`: title/meta, H1-H3, word count, internal/external links, schema, published/modified signals, exact-query use and page-change diff
- `scan_competitor_site`: public robots/sitemap discovery, new/updated URL detection and observed topic themes
- `competitor_radar`: scans enabled tracked competitors
- `keyword_competitor_brief`: analyzes dynamic top 3 plus relevant tracked-competitor pages and compares them with the SMIS target page
- private Vercel Blob snapshots for page/site/SERP history
- SSRF-oriented URL validation, manual redirect checking and response-size/time limits

Important methodology: Presa observes public pages, sitemaps and search results. It does not claim access to competitors' private Google Search Console data or internal keyword-monitoring lists.

Remaining Phase 2 validation:
1. Refresh ChatGPT plugin tools so v0.5.0 schemas are visible.
2. Run live `competitor_registry` test.
3. Record a real search snapshot for a priority keyword.
4. Verify dynamic top-3 analysis and sitemap/page change snapshots end-to-end.
5. Activate the recurring daily competitor radar workflow.

## Next build after Phase 2

**Phase 3 — NEET Resource Library**

Create the scalable search footprint around PYQs, original solutions, year/subject/chapter/question-level HTML pages, downloadable resources and internal conversion paths.
