import crypto from 'node:crypto';
import { google } from 'googleapis';
import { put, get } from '@vercel/blob';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const BASE_URL = process.env.BASE_URL || 'https://presa-seo-console.vercel.app';
const REDIRECT_URI = `${BASE_URL}/auth/google/callback`;
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
const TOKEN_PATH = 'oauth/google-search-console.json';

const PRIORITY_KEYWORDS = [
  { group: 'PU / ISC', keyword: 'best pu college in karnataka', targetUrl: 'https://smis.edu.in/best-pu-colleges-in-karnataka/', intent: 'commercial' },
  { group: 'PU / ISC', keyword: 'best pu colleges in karnataka', targetUrl: 'https://smis.edu.in/best-pu-colleges-in-karnataka/', intent: 'commercial' },
  { group: 'PU / ISC', keyword: 'best pu college in karnataka for science', targetUrl: 'https://smis.edu.in/best-pu-colleges-in-karnataka/', intent: 'commercial' },
  { group: 'PU / ISC', keyword: "st mary's pu college chikmagalur", targetUrl: 'https://smis.edu.in/best-pu-college-in-chikmagalur-for-science/', intent: 'brand-commercial' },
  { group: 'NEET', keyword: 'best neet coaching in karnataka', targetUrl: 'https://smis.edu.in/best-neet-coaching-in-karnataka/', intent: 'commercial' },
  { group: 'NEET', keyword: 'best neet long term coaching in karnataka', targetUrl: 'https://smis.edu.in/best-neet-long-term-coaching-2026-27/', intent: 'commercial' },
  { group: 'NEET', keyword: 'neet long term', targetUrl: 'https://smis.edu.in/best-neet-long-term-coaching-2026-27/', intent: 'commercial' },
  { group: 'JEE', keyword: 'best jee coaching in karnataka', targetUrl: 'https://smis.edu.in/best-jee-coaching-in-karnataka/', intent: 'commercial' },
  { group: 'School', keyword: 'best school in chikmagalur', targetUrl: 'https://smis.edu.in/best-school-of-chikmagalur/', intent: 'commercial' },
  { group: 'School', keyword: 'icse schools in chikmagalur', targetUrl: 'https://smis.edu.in/best-school-of-chikmagalur/', intent: 'commercial' },
  { group: 'PU / ISC', keyword: "st mary's isc college chikmagalur", targetUrl: 'https://smis.edu.in/isc/', intent: 'brand-commercial' },
  { group: 'PU / ISC', keyword: 'isc colleges in karnataka', targetUrl: 'https://smis.edu.in/isc/', intent: 'commercial' }
];

function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

async function loadGoogleTokens() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private credential storage is not configured.');
  try {
    const result = await get(TOKEN_PATH, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || result.statusCode === 404 || !result.stream) throw new Error('Google Search Console is not connected yet.');
    const chunks = [];
    for await (const chunk of result.stream) chunks.push(Buffer.from(chunk));
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (e) {
    if (String(e?.message || e).includes('not found') || e?.statusCode === 404) throw new Error('Google Search Console is not connected yet.');
    throw e;
  }
}

async function saveGoogleTokens(tokens) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Private credential storage is not configured.');
  await put(TOKEN_PATH, JSON.stringify(tokens), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: process.env.BLOB_READ_WRITE_TOKEN
  });
}

async function authFromStore() {
  const tokens = await loadGoogleTokens();
  const auth = oauthClient();
  auth.setCredentials(tokens);
  auth.on('tokens', async fresh => {
    if (!fresh || Object.keys(fresh).length === 0) return;
    const current = await loadGoogleTokens();
    await saveGoogleTokens({ ...current, ...fresh, refresh_token: fresh.refresh_token || current.refresh_token });
  });
  return auth;
}

async function queryGsc({ siteUrl, startDate, endDate, dimensions = ['query'], rowLimit = 1000, filters }) {
  const sc = google.searchconsole({ version: 'v1', auth: await authFromStore() });
  const requestBody = { startDate, endDate, rowLimit };
  if (dimensions?.length) requestBody.dimensions = dimensions;
  if (filters?.length) requestBody.dimensionFilterGroups = [{ filters }];
  const r = await sc.searchanalytics.query({ siteUrl, requestBody });
  return r.data.rows || [];
}

function aggregate(rows) {
  if (!rows?.length) return { clicks: 0, impressions: 0, ctr: 0, position: null };
  const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions || 0), 0);
  const weightedPosition = rows.reduce((s, r) => s + ((r.position || 0) * (r.impressions || 0)), 0);
  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: impressions ? weightedPosition / impressions : null
  };
}

function metricChange(current, previous) {
  const change = current - previous;
  const changePct = previous === 0 ? (current === 0 ? 0 : null) : change / previous;
  return { current, previous, change, changePct };
}

function summarizeComparison(currentRows, previousRows) {
  const current = aggregate(currentRows);
  const previous = aggregate(previousRows);
  return {
    current,
    previous,
    changes: {
      clicks: metricChange(current.clicks, previous.clicks),
      impressions: metricChange(current.impressions, previous.impressions),
      ctr: metricChange(current.ctr, previous.ctr),
      position: metricChange(current.position ?? 0, previous.position ?? 0)
    }
  };
}

function rowMap(rows) {
  return new Map((rows || []).map(r => [String(r.keys?.[0] || '').toLowerCase(), r]));
}

function normalizePage(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    return u.toString();
  } catch {
    return url;
  }
}

function groupCannibalization(rows, { minImpressions = 20, minPageImpressions = 2, minPages = 2 } = {}) {
  const grouped = new Map();
  for (const r of rows || []) {
    const query = String(r.keys?.[0] || '').trim();
    const page = String(r.keys?.[1] || '').trim();
    if (!query || !page) continue;
    if (!grouped.has(query)) grouped.set(query, []);
    grouped.get(query).push({ page, clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position ?? null });
  }
  const out = [];
  for (const [query, pagesRaw] of grouped) {
    const pages = pagesRaw.filter(p => p.impressions >= minPageImpressions).sort((a, b) => b.impressions - a.impressions);
    const totalImpressions = pages.reduce((s, p) => s + p.impressions, 0);
    if (pages.length < minPages || totalImpressions < minImpressions) continue;
    const totalClicks = pages.reduce((s, p) => s + p.clicks, 0);
    const weightedPosition = pages.reduce((s, p) => s + ((p.position || 0) * p.impressions), 0);
    const dominantShare = totalImpressions ? pages[0].impressions / totalImpressions : 1;
    out.push({
      query,
      totalClicks,
      totalImpressions,
      ctr: totalImpressions ? totalClicks / totalImpressions : 0,
      position: totalImpressions ? weightedPosition / totalImpressions : null,
      pageCount: pages.length,
      dominantPageShare: dominantShare,
      severity: dominantShare < 0.6 ? 'high' : dominantShare < 0.8 ? 'medium' : 'low',
      pages
    });
  }
  return out.sort((a, b) => b.totalImpressions - a.totalImpressions);
}

function makeMcp() {
  const mcp = new McpServer({ name: 'Presa SEO Console', version: '0.3.0' });

  mcp.tool('list_sites', 'List Google Search Console properties available to the connected account.', {}, async () => {
    const sc = google.searchconsole({ version: 'v1', auth: await authFromStore() });
    const r = await sc.sites.list();
    return { content: [{ type: 'text', text: JSON.stringify(r.data.siteEntry || [], null, 2) }] };
  });

  mcp.tool('search_performance', 'Get GSC clicks, impressions, CTR and average position.', {
    siteUrl: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    dimensions: z.array(z.enum(['query', 'page', 'date', 'device', 'country'])).default(['query']),
    rowLimit: z.number().int().min(1).max(25000).default(1000)
  }, async args => ({ content: [{ type: 'text', text: JSON.stringify(await queryGsc(args), null, 2) }] }));

  mcp.tool('keyword_performance', 'Get performance and ranking URLs for one keyword.', {
    siteUrl: z.string(), keyword: z.string(), startDate: z.string(), endDate: z.string()
  }, async ({ siteUrl, keyword, startDate, endDate }) => {
    const rows = await queryGsc({
      siteUrl, startDate, endDate, dimensions: ['query', 'page'], rowLimit: 25000,
      filters: [{ dimension: 'query', operator: 'equals', expression: keyword }]
    });
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });

  mcp.tool('find_opportunities', 'Find high-impression queries near page one or with weak CTR.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string(), minImpressions: z.number().default(50)
  }, async ({ siteUrl, startDate, endDate, minImpressions }) => {
    const rows = await queryGsc({ siteUrl, startDate, endDate, dimensions: ['query'], rowLimit: 25000 });
    const out = rows.filter(r => (r.impressions || 0) >= minImpressions && (((r.position || 0) >= 4 && (r.position || 0) <= 20) || (r.ctr || 0) < 0.02));
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  });

  mcp.tool('compare_periods', 'Compare aggregate GSC performance between two date ranges and calculate changes.', {
    siteUrl: z.string(),
    currentStart: z.string(), currentEnd: z.string(),
    previousStart: z.string(), previousEnd: z.string()
  }, async args => {
    const [currentRows, previousRows] = await Promise.all([
      queryGsc({ siteUrl: args.siteUrl, startDate: args.currentStart, endDate: args.currentEnd, dimensions: [], rowLimit: 1 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.previousStart, endDate: args.previousEnd, dimensions: [], rowLimit: 1 })
    ]);
    const report = summarizeComparison(currentRows, previousRows);
    report.periods = {
      current: { startDate: args.currentStart, endDate: args.currentEnd },
      previous: { startDate: args.previousStart, endDate: args.previousEnd }
    };
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  });

  mcp.tool('monthly_trend', 'Return monthly GSC totals with weighted CTR and average position for a date range.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string()
  }, async ({ siteUrl, startDate, endDate }) => {
    const rows = await queryGsc({ siteUrl, startDate, endDate, dimensions: ['date'], rowLimit: 25000 });
    const buckets = new Map();
    for (const r of rows) {
      const day = String(r.keys?.[0] || '');
      const month = day.slice(0, 7);
      if (!month) continue;
      if (!buckets.has(month)) buckets.set(month, []);
      buckets.get(month).push(r);
    }
    const out = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, monthRows]) => ({ month, ...aggregate(monthRows) }));
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  });

  mcp.tool('query_pages', 'Show every ranking URL Google used for an exact query in a date range.', {
    siteUrl: z.string(), query: z.string(), startDate: z.string(), endDate: z.string()
  }, async ({ siteUrl, query, startDate, endDate }) => {
    const rows = await queryGsc({
      siteUrl, startDate, endDate, dimensions: ['query', 'page'], rowLimit: 25000,
      filters: [{ dimension: 'query', operator: 'equals', expression: query }]
    });
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });

  mcp.tool('page_queries', 'Show the search queries sending impressions and clicks to one exact page.', {
    siteUrl: z.string(), pageUrl: z.string(), startDate: z.string(), endDate: z.string(), rowLimit: z.number().int().min(1).max(25000).default(1000)
  }, async ({ siteUrl, pageUrl, startDate, endDate, rowLimit }) => {
    const rows = await queryGsc({
      siteUrl, startDate, endDate, dimensions: ['query'], rowLimit,
      filters: [{ dimension: 'page', operator: 'equals', expression: pageUrl }]
    });
    return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
  });

  mcp.tool('detect_cannibalization', 'Find queries for which multiple URLs from the site receive meaningful impressions.', {
    siteUrl: z.string(), startDate: z.string(), endDate: z.string(),
    minImpressions: z.number().default(20),
    minPageImpressions: z.number().default(2),
    minPages: z.number().int().min(2).default(2)
  }, async ({ siteUrl, startDate, endDate, minImpressions, minPageImpressions, minPages }) => {
    const rows = await queryGsc({ siteUrl, startDate, endDate, dimensions: ['query', 'page'], rowLimit: 25000 });
    const out = groupCannibalization(rows, { minImpressions, minPageImpressions, minPages });
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  });

  mcp.tool('keyword_registry', 'Return the approved priority keyword to canonical target URL map for St. Mary’s.', {}, async () => {
    return { content: [{ type: 'text', text: JSON.stringify(PRIORITY_KEYWORDS, null, 2) }] };
  });

  mcp.tool('priority_keyword_report', 'Compare St. Mary’s priority keywords against the previous period and a baseline period, including ranking URLs and target URL alignment.', {
    siteUrl: z.string(),
    currentStart: z.string(), currentEnd: z.string(),
    previousStart: z.string(), previousEnd: z.string(),
    baselineStart: z.string(), baselineEnd: z.string()
  }, async args => {
    const [currentQueries, previousQueries, baselineQueries, currentQueryPages] = await Promise.all([
      queryGsc({ siteUrl: args.siteUrl, startDate: args.currentStart, endDate: args.currentEnd, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.previousStart, endDate: args.previousEnd, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.baselineStart, endDate: args.baselineEnd, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.currentStart, endDate: args.currentEnd, dimensions: ['query', 'page'], rowLimit: 25000 })
    ]);
    const currentMap = rowMap(currentQueries);
    const previousMap = rowMap(previousQueries);
    const baselineMap = rowMap(baselineQueries);
    const pageMap = new Map();
    for (const r of currentQueryPages) {
      const keyword = String(r.keys?.[0] || '').toLowerCase();
      const page = String(r.keys?.[1] || '');
      if (!pageMap.has(keyword)) pageMap.set(keyword, []);
      pageMap.get(keyword).push({ page, clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position ?? null });
    }
    const metric = r => ({ clicks: r?.clicks || 0, impressions: r?.impressions || 0, ctr: r?.ctr || 0, position: r?.position ?? null });
    const report = PRIORITY_KEYWORDS.map(item => {
      const key = item.keyword.toLowerCase();
      const current = metric(currentMap.get(key));
      const previous = metric(previousMap.get(key));
      const baseline = metric(baselineMap.get(key));
      const pages = (pageMap.get(key) || []).sort((a, b) => b.impressions - a.impressions);
      const target = normalizePage(item.targetUrl);
      const targetRow = pages.find(p => normalizePage(p.page) === target) || null;
      return {
        ...item,
        current,
        previous,
        baseline,
        changes: {
          vsPrevious: {
            clicks: metricChange(current.clicks, previous.clicks),
            impressions: metricChange(current.impressions, previous.impressions),
            ctr: metricChange(current.ctr, previous.ctr),
            position: metricChange(current.position ?? 0, previous.position ?? 0)
          },
          vsBaseline: {
            clicks: metricChange(current.clicks, baseline.clicks),
            impressions: metricChange(current.impressions, baseline.impressions),
            ctr: metricChange(current.ctr, baseline.ctr),
            position: metricChange(current.position ?? 0, baseline.position ?? 0)
          }
        },
        rankingUrls: pages,
        targetUrlSeen: Boolean(targetRow),
        targetUrlMetrics: targetRow
      };
    });
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  });

  mcp.tool('seo_daily_brief', 'Produce an action-oriented SEO brief: site movement, query gains/losses, opportunities and cannibalization for two comparable periods.', {
    siteUrl: z.string(),
    currentStart: z.string(), currentEnd: z.string(),
    previousStart: z.string(), previousEnd: z.string(),
    minImpressions: z.number().default(10)
  }, async args => {
    const [currentAgg, previousAgg, currentQueries, previousQueries, currentQueryPages] = await Promise.all([
      queryGsc({ siteUrl: args.siteUrl, startDate: args.currentStart, endDate: args.currentEnd, dimensions: [], rowLimit: 1 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.previousStart, endDate: args.previousEnd, dimensions: [], rowLimit: 1 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.currentStart, endDate: args.currentEnd, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.previousStart, endDate: args.previousEnd, dimensions: ['query'], rowLimit: 25000 }),
      queryGsc({ siteUrl: args.siteUrl, startDate: args.currentStart, endDate: args.currentEnd, dimensions: ['query', 'page'], rowLimit: 25000 })
    ]);
    const previousMap = rowMap(previousQueries);
    const movements = currentQueries
      .filter(r => (r.impressions || 0) >= args.minImpressions || (previousMap.get(String(r.keys?.[0] || '').toLowerCase())?.impressions || 0) >= args.minImpressions)
      .map(r => {
        const query = String(r.keys?.[0] || '');
        const p = previousMap.get(query.toLowerCase());
        return {
          query,
          current: { clicks: r.clicks || 0, impressions: r.impressions || 0, ctr: r.ctr || 0, position: r.position ?? null },
          previous: { clicks: p?.clicks || 0, impressions: p?.impressions || 0, ctr: p?.ctr || 0, position: p?.position ?? null },
          positionDelta: p?.position != null && r.position != null ? p.position - r.position : null,
          impressionsDelta: (r.impressions || 0) - (p?.impressions || 0),
          clicksDelta: (r.clicks || 0) - (p?.clicks || 0)
        };
      });
    const gains = movements.filter(x => x.positionDelta != null && x.positionDelta > 0).sort((a, b) => b.positionDelta - a.positionDelta).slice(0, 25);
    const drops = movements.filter(x => x.positionDelta != null && x.positionDelta < 0).sort((a, b) => a.positionDelta - b.positionDelta).slice(0, 25);
    const opportunities = currentQueries
      .filter(r => (r.impressions || 0) >= args.minImpressions && (((r.position || 0) >= 4 && (r.position || 0) <= 20) || (r.ctr || 0) < 0.02))
      .slice(0, 100);
    const cannibalization = groupCannibalization(currentQueryPages, { minImpressions: args.minImpressions, minPageImpressions: 2, minPages: 2 }).slice(0, 50);
    const report = {
      periods: {
        current: { startDate: args.currentStart, endDate: args.currentEnd },
        previous: { startDate: args.previousStart, endDate: args.previousEnd }
      },
      summary: summarizeComparison(currentAgg, previousAgg),
      gains,
      drops,
      opportunities,
      cannibalization
    };
    return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
  });

  return mcp;
}

export default async function handler(req, res) {
  const url = new URL(req.url, BASE_URL);
  const path = url.pathname;
  if (req.method === 'GET' && path === '/') return res.status(200).json({ name: 'Presa SEO Console', status: 'ok', version: '0.3.0', mcp: '/mcp', googleConnect: '/auth/google' });
  if (req.method === 'GET' && path === '/health') return res.status(200).json({ ok: true, version: '0.3.0', storage: !!process.env.BLOB_READ_WRITE_TOKEN });
  if (req.method === 'GET' && path === '/auth/google') {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return res.status(503).send('Google OAuth credentials are not configured.');
    const target = oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: [SCOPE], state: crypto.randomBytes(24).toString('hex') });
    res.writeHead(302, { Location: target });
    return res.end();
  }
  if (req.method === 'GET' && path === '/auth/google/callback') {
    try {
      const code = url.searchParams.get('code');
      if (!code) throw new Error('Missing OAuth code');
      const { tokens } = await oauthClient().getToken(code);
      if (!tokens.refresh_token) return res.status(200).send('<h1>Google connected, but no refresh token was returned.</h1><p>Please reconnect with consent.</p>');
      await saveGoogleTokens(tokens);
      const auth = oauthClient();
      auth.setCredentials(tokens);
      const sc = google.searchconsole({ version: 'v1', auth });
      const sites = await sc.sites.list();
      const count = (sites.data.siteEntry || []).length;
      return res.status(200).send(`<h1>Google Search Console connected</h1><p>Your authorization has been stored securely in Presa SEO Console private storage.</p><p>${count} Search Console ${count === 1 ? 'property' : 'properties'} available.</p><p>You can close this tab and return to ChatGPT.</p>`);
    } catch (e) {
      return res.status(500).send(`<h1>Connection error</h1><p>${String(e.message).replace(/[<>&]/g, '')}</p>`);
    }
  }
  if (req.method === 'GET' && path === '/auth/status') {
    try {
      const auth = await authFromStore();
      const sc = google.searchconsole({ version: 'v1', auth });
      const r = await sc.sites.list();
      return res.status(200).json({ connected: true, sites: (r.data.siteEntry || []).map(x => ({ siteUrl: x.siteUrl, permissionLevel: x.permissionLevel })) });
    } catch (e) {
      return res.status(200).json({ connected: false, message: e.message });
    }
  }
  if (path === '/mcp' && req.method === 'POST') {
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await makeMcp().connect(transport);
      return await transport.handleRequest(req, res, req.body);
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  if (path === '/mcp' && (req.method === 'GET' || req.method === 'DELETE')) return res.status(405).send('Method not allowed in stateless mode');
  return res.status(404).send('Not found');
}
