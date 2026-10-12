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

More analysis tools will be added after the live Google connection is verified.

## Security
OAuth secrets and refresh tokens are environment variables only. Never commit `.env` files or credentials.

## Google OAuth callback
`{BASE_URL}/auth/google/callback`

## Scope
The application requests only the read-only Search Console scope:
`https://www.googleapis.com/auth/webmasters.readonly`
