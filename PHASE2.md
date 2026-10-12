# Phase 2 — Competitor Radar

Status: built in Presa SEO Console v0.5.0.

## Objectives

1. Maintain an editable competitor registry. Users can add or remove any competitor without code changes.
2. For every keyword researched, store a current search-result snapshot and automatically treat the first 3 distinct non-St. Mary's organic domains as dynamic competitors for that keyword.
3. Analyze public competitor pages for title/meta, H1-H3 structure, word count, internal/external links, structured-data types, publication/modified dates, exact-query usage and content changes.
4. Scan public sitemaps to identify newly added and updated URLs and infer observed public content themes. The system does not claim access to competitors' private Search Console, paid keyword lists or internal monitoring data.
5. Compare St. Mary's target page against the current dynamic top 3 and relevant pages from manually tracked competitors.
6. Persist page/site snapshots in private Vercel Blob storage so future scans can show changes over time.

## Seed competitors

- ALLEN — allen.in
- Aakash — aakash.ac.in
- Physics Wallah — pw.live
- NEETprep — neetprep.com
- Vedantu — vedantu.com

These are initial entries only. The registry is editable.

## Phase 2 MCP tools

- `competitor_registry`
- `add_competitor`
- `remove_competitor`
- `record_serp_snapshot`
- `get_serp_snapshot`
- `analyze_competitor_page`
- `scan_competitor_site`
- `competitor_radar`
- `keyword_competitor_brief`

## Dynamic top-3 workflow

For a fresh keyword, ChatGPT should first run a live web search, then call `record_serp_snapshot` with the organic results. Presa stores the first 3 distinct competitor domains after excluding smis.edu.in. `keyword_competitor_brief` then analyzes those exact pages and can additionally inspect relevant pages from the manually tracked competitor registry.

This design avoids pretending that Presa can see competitors' private keyword data. It measures what competitors publish and what current public search results expose.
