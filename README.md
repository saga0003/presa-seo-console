# Presa SEO Console

A lightweight, read-only Google Search Console MCP server for ChatGPT.

## Goal
Use ChatGPT as the SEO analysis interface without paying for a separate AI API or third-party GSC analysis subscription.

## Architecture
Google Search Console API → Presa SEO Console MCP → ChatGPT Plugin.

## Current MCP tools
- `list_sites`
- `search_performance`
- `keyword_performance`
- `find_opportunities`
- `compare_periods`
- `monthly_trend`
- `query_pages`
- `page_queries`
- `detect_cannibalization`
- `keyword_registry`
- `priority_keyword_report`
- `seo_daily_brief`

## Phase 1: SEO Command Centre
Phase 1 turns raw Search Console data into an operational SEO control layer for St. Mary’s.

It tracks:
- current vs previous-period performance
- monthly trends
- priority commercial keywords
- the intended canonical landing page for each priority keyword
- ranking URL mismatches
- keyword cannibalization
- page-one / page-two opportunities
- ranking gains and losses
- CTR and impression opportunities

The approved St. Mary’s keyword-to-target-page map is currently maintained in `api/index.js` and exposed through the `keyword_registry` MCP tool.

## Security
Google OAuth client credentials stay in Vercel environment variables. The Google refresh token is stored in a private Vercel Blob object and is never committed to the repository.

The Search Console scope is read-only:
`https://www.googleapis.com/auth/webmasters.readonly`

## Google OAuth callback
`{BASE_URL}/auth/google/callback`
